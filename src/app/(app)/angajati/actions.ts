// src/app/(app)/angajati/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { readRequestMeta, writeAuditLog } from "@/lib/actions/audit";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  amprentaSensibila,
  catreBytea,
  decrypt,
  dinBytea,
  encrypt,
  versiuneCaNumar,
} from "@/lib/crypto/aes-gcm";
import { ultimeleCifreCnp } from "@/domain/hr/cnp";
import { ultimeleCifreIban } from "@/domain/hr/iban";
import { genereazaEvenimenteReges } from "@/lib/reges/genereaza-evenimente";
import {
  actualizeazaAngajatSchema,
  creeazaContractSchema,
  dezvaluieDateSensibileSchema,
  incetareContractSchema,
  modificaSalariuContractSchema,
} from "@/schemas/employee";

interface RandSensibil {
  readonly cnp_ciphertext: string | null;
  readonly cnp_iv: string | null;
  readonly cnp_tag: string | null;
  readonly cnp_key_version: number | null;
  readonly iban_ciphertext: string | null;
  readonly iban_iv: string | null;
  readonly iban_tag: string | null;
  readonly iban_key_version: number | null;
}

/**
 * Scrie sau actualizează blocul criptat prin RPC-ul `hr_write_sensitive`
 * (SECURITY DEFINER) — se apelează doar dacă utilizatorul a trimis valori noi.
 *
 * NU un `.upsert()` direct pe `employee_sensitive_data`: migrarea 0005 a
 * revocat orice grant `authenticated` pe acest tabel, tocmai ca accesul să
 * treacă exclusiv prin RPC. Un upsert direct eșuează mereu cu 42501 — bug
 * confirmat empiric, prezent probabil din prima zi a formularului de angajat.
 */
export async function salveazaDateSensibile(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  employeeId: string,
  cnp: string | null,
  iban: string | null,
  banca: string | null,
): Promise<void> {
  if (cnp === null && iban === null && banca === null) return;

  const bucataCnp =
    cnp === null
      ? {}
      : (() => {
          const criptat = encrypt(cnp);
          return {
            p_cnp_ciphertext: catreBytea(criptat.ciphertext),
            p_cnp_iv: catreBytea(criptat.iv),
            p_cnp_tag: catreBytea(criptat.tag),
            p_cnp_key_version: versiuneCaNumar(criptat.keyVersion),
            p_cnp_last4: ultimeleCifreCnp(cnp),
            p_cnp_hash: amprentaSensibila(cnp),
          };
        })();

  const bucataIban =
    iban === null
      ? {}
      : (() => {
          const criptat = encrypt(iban);
          return {
            p_iban_ciphertext: catreBytea(criptat.ciphertext),
            p_iban_iv: catreBytea(criptat.iv),
            p_iban_tag: catreBytea(criptat.tag),
            p_iban_key_version: versiuneCaNumar(criptat.keyVersion),
            p_iban_last4: ultimeleCifreIban(iban),
            p_iban_hash: amprentaSensibila(iban),
          };
        })();

  const { error } = await db.rpc("hr_write_sensitive", {
    p_employee: employeeId,
    ...bucataCnp,
    ...bucataIban,
    ...(banca === null ? {} : { p_banca: banca }),
  });
  if (error !== null) throw error;
}

export const actualizeazaAngajat = createAction({
  name: "employees.update",
  permission: "employees:update",
  minScope: "team",
  input: actualizeazaAngajatSchema,
  audit: {
    action: "update",
    entityType: "employee",
    entityId: (input) => input.id,
    allow: [
      "id",
      "last_name",
      "first_name",
      "email_personal",
      "telefon",
      "data_nasterii",
      "gen",
      "department_id",
      "job_position_id",
      "hired_on",
    ],
  },
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, cnp, iban, banca, ...fisa } = input;

    const { data, error } = await db
      .from("employees")
      .update({ ...fisa, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (data === null)
      throw notFound("Fișa de angajat nu a fost găsită sau nu vă este accesibilă.");

    await salveazaDateSensibile(db, id, cnp, iban, banca);
    revalidatePath("/angajati");
    revalidatePath(`/angajati/${id}`);
    return { id };
  },
});

export const creeazaContract = createAction({
  name: "employees.contract.create",
  permission: "employees:create",
  minScope: "all",
  input: creeazaContractSchema,
  audit: {
    action: "create",
    entityType: "employment_contract",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "employee_id",
      "parent_contract_id",
      "este_act_aditional",
      "numar",
      "data_contract",
      "valabil_de_la",
      "valabil_pana",
      "contract_duration",
      "motiv_determinat",
      "norma_ore_saptamana",
      "norma_ore_zi",
      "work_mode",
      "special_regime",
      "loc_telemunca",
      "loc_munca",
      "department_id",
      "job_position_id",
      "conditii_munca",
      "moneda",
      "zile_concediu_anual",
      "perioada_proba_zile",
      "preaviz_zile",
    ],
  },
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("employment_contracts")
      // RLS (`contracts_insert`) forțează `status = 'proiect'` la INSERT —
      // orice altă valoare e respinsă de politică, nu doar neconformă cu
      // convenția. Activarea e un al doilea pas, prin UPDATE, mai jos.
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        status: "proiect",
        cod_revisal: null,
        incetat_la: null,
        motiv_incetare: null,
        temei_incetare: null,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw error;

    // "proiect" ar fi rămas definitiv — nimic altundeva în cod nu-l mai schimbă
    // (bug confirmat: fișa angajatului și motorul de salarizare caută mereu
    // status = 'activ', niciodată 'proiect'). `cod_revisal`/`reges_evenimente`
    // urmăresc separat dacă transmiterea la ITM chiar a avut loc — statusul
    // contractului nu mai trebuie să dubleze acea urmărire.
    //
    // Contractul de bază face fișa activă (dacă era „candidat" sau ieșise din
    // efectiv). Un act adițional nu schimbă starea — modifică un contract deja
    // activ, nu creează unul nou.
    // `.select()` după `.update()`, obligatoriu pe o tranziție de status: un
    // UPDATE respins de clauza `USING` a politicii afectează ZERO rânduri și NU
    // ridică eroare (capcana 17). Fără verificarea asta, contractul rămâne
    // „proiect", fișa rămâne „candidat", iar utilizatorul vede „salvat".
    const { data: contractActivat, error: eroareActivare } = await db
      .from("employment_contracts")
      .update({ status: "activ", updated_by: ctx.user.id })
      .eq("id", data.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (eroareActivare !== null) throw eroareActivare;
    if (contractActivat === null) {
      throw businessRule("Contractul a fost creat, dar activarea lui a fost respinsă.");
    }

    if (!input.este_act_aditional) {
      const { data: fisaActivata, error: eroareStatus } = await db
        .from("employees")
        .update({ status: "activ", updated_by: ctx.user.id })
        .eq("id", input.employee_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (eroareStatus !== null) throw eroareStatus;
      if (fisaActivata === null) {
        throw businessRule("Contractul a fost creat, dar fișa angajatului nu a putut fi activată.");
      }
    }

    // Soldul de concediu al anului de angajare.
    //
    // `inroleazaAngajat` îl semăna deja, dar `creeazaContract` NU — iar el e
    // singura cale prin care un angajat IMPORTAT în masă ajunge activ. Un import
    // de 200 de oameni producea 200 de fișe fără drept de concediu, iar soldul
    // apărea abia la prima cerere, prin crearea leneșă din `asigura_sold` — deci
    // ecranul „Sold concedii" arăta gol până când cineva cerea concediu.
    //
    // Numai la contractul propriu-zis, nu la actele adiționale: un act adițional
    // modifică un contract deja activ, iar soldul e deja semănat.
    //
    // Best-effort, ca la REVISAL mai jos: un contract creat corect nu se anulează
    // pentru că semănarea soldului a eșuat, iar `asigura_sold` e idempotentă.
    if (!input.este_act_aditional) {
      try {
        const anulAngajarii = Number(input.valabil_de_la.slice(0, 4));
        const { error: eroareSold } = await db.rpc("seed_leave_balances", {
          p_employee: input.employee_id,
          p_an: anulAngajarii,
          p_zile_odihna_override: input.zile_concediu_anual,
        });
        if (eroareSold !== null) throw eroareSold;
      } catch (eroare) {
        console.error("[concedii] soldul nu a putut fi semănat la crearea contractului", {
          employeeId: input.employee_id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    // REVISAL: angajarea se transmite la Inspecția Muncii într-un termen legal,
    // iar netransmiterea în termen este contravenție PER SALARIAT. Evenimentul
    // se generează AICI, în aceeași acțiune care creează contractul — altfel
    // depinde de cineva care își amintește să deschidă un alt ecran.
    //
    // Generarea nu aruncă: un contract creat cu succes nu trebuie anulat pentru
    // că evidența REVISAL a eșuat. Eșecul se vede în jurnal și evenimentul poate
    // fi regenerat, pentru că `genereazaEvenimenteReges` este idempotentă.
    try {
      await genereazaEvenimenteReges({
        supabase: db,
        organizationId: ctx.tenant.organizationId,
        userId: ctx.user.id,
        evenimente: [
          {
            employeeId: input.employee_id,
            contractId: data.id,
            tip: "angajare",
            dataEvenimentului: input.valabil_de_la,
            valabilDeLa: input.valabil_de_la,
            dataContract: input.data_contract,
            payload: { numar: input.numar, salariu_baza: input.salariu_baza },
          },
        ],
      });
    } catch (eroare) {
      console.error("[revisal] evenimentul de angajare nu a putut fi generat", {
        contractId: data.id,
        requestId: ctx.requestId,
        eroare,
      });
    }

    revalidatePath(`/angajati/${input.employee_id}`);
    revalidatePath("/reges");
    return { id: data.id };
  },
});

export const inceteazaContract = createAction({
  name: "employees.contract.terminate",
  permission: "employees:update",
  minScope: "all",
  input: incetareContractSchema,
  audit: {
    action: "update",
    entityType: "employment_contract",
    entityId: (input) => input.contract_id,
    allow: ["contract_id", "incetat_la", "temei_incetare", "motiv_incetare", "arhiveaza_fisa"],
  },
  handler: async (ctx, input): Promise<Readonly<{ id: string; employee_id: string }>> => {
    const db = await createServerSupabase();
    const { data: contract, error: eroareCitire } = await db
      .from("employment_contracts")
      .select("id, employee_id, status, valabil_de_la, data_contract, este_act_aditional")
      .eq("id", input.contract_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;
    if (contract === null) throw notFound("Contractul selectat nu a fost găsit.");
    if (contract.status === "incetat") {
      throw businessRule("Contractul este deja încetat. Consultați istoricul angajatului.");
    }
    if (input.incetat_la < contract.valabil_de_la) {
      throw businessRule("Data încetării nu poate fi anterioară datei de început a contractului.");
    }

    // Zero rânduri afectate = politica a respins tranziția, fără eroare
    // (capcana 17). Aici ar fi cel mai scump: încetarea „reușește", contractul
    // rămâne activ, iar evenimentul REVISAL de mai jos se generează pentru o
    // încetare care nu s-a întâmplat.
    const { data: contractIncetat, error: eroareContract } = await db
      .from("employment_contracts")
      .update({
        status: "incetat",
        incetat_la: input.incetat_la,
        motiv_incetare: input.motiv_incetare,
        temei_incetare: input.temei_incetare,
        updated_by: ctx.user.id,
      })
      .eq("id", contract.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (eroareContract !== null) throw eroareContract;
    if (contractIncetat === null) {
      throw businessRule("Încetarea contractului a fost respinsă. Verificați dreptul de acces.");
    }

    // Fișa NU se șterge: rămâne cu istoricul complet, doar iese din efectiv.
    const { count, error: eroareRamase } = await db
      .from("employment_contracts")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", contract.employee_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "activ")
      .eq("este_act_aditional", false)
      .is("deleted_at", null);
    if (eroareRamase !== null) throw eroareRamase;

    if ((count ?? 0) === 0) {
      const { data: fisaIncetata, error: eroareFisa } = await db
        .from("employees")
        .update({
          status: input.arhiveaza_fisa ? "arhivat" : "incetat",
          terminated_on: input.incetat_la,
          updated_by: ctx.user.id,
        })
        .eq("id", contract.employee_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .select("id")
        .maybeSingle();
      if (eroareFisa !== null) throw eroareFisa;
      if (fisaIncetata === null) {
        throw businessRule("Contractul a fost încetat, dar fișa angajatului a rămas în efectiv.");
      }
    }

    // Încetarea are termen legal ZERO — „cel târziu la data încetării". Până la
    // 0087, acțiunea asta nu genera NICIUN eveniment, deși comentariul de mai sus
    // vorbea despre unul: raportarea încetării ar fi trebuit făcută complet
    // manual, din portalul ITM, pentru fiecare om. `docs/design/faza-2/2-vanatoare.md:522`
    // îl semnalase, iar cu transmiterea prin API golul devenea o contravenție
    // tăcută la fiecare plecare.
    //
    // Ca la angajare: nu aruncă. Un contract încetat cu succes nu se anulează
    // fiindcă evidența a eșuat, iar generarea e idempotentă pe
    // (angajat, tip, dată), deci se poate relua.
    try {
      await genereazaEvenimenteReges({
        supabase: db,
        organizationId: ctx.tenant.organizationId,
        userId: ctx.user.id,
        evenimente: [
          {
            employeeId: contract.employee_id,
            contractId: contract.id,
            tip: "incetare",
            dataEvenimentului: input.incetat_la,
            valabilDeLa: contract.valabil_de_la,
            dataContract: contract.data_contract,
            payload: { temei_incetare: input.temei_incetare },
          },
        ],
      });
    } catch (eroare) {
      console.error("[reges] evenimentul de încetare nu a putut fi generat", {
        contractId: contract.id,
        requestId: ctx.requestId,
        eroare,
      });
    }

    revalidatePath("/angajati");
    revalidatePath(`/angajati/${contract.employee_id}`);
    revalidatePath("/reges");
    return { id: contract.id, employee_id: contract.employee_id };
  },
});

export const modificaSalariulContractului = createAction({
  name: "employees.contract.update_salary",
  permission: "employees:update",
  minScope: "all",
  input: modificaSalariuContractSchema,
  audit: {
    action: "update",
    entityType: "employment_contract",
    entityId: (input) => input.contract_id,
    // `salariu_baza` deliberat lipsă din allow-list — la fel ca la `creeazaContract`,
    // suma salarială nu intră în jurnalul de audit în clar.
    allow: ["contract_id"],
  },
  handler: async (ctx, input): Promise<Readonly<{ id: string; employee_id: string }>> => {
    const db = await createServerSupabase();
    const { data: contract, error: eroareCitire } = await db
      .from("employment_contracts")
      .select("id, employee_id, status, este_act_aditional")
      .eq("id", input.contract_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;
    if (contract === null) throw notFound("Contractul selectat nu a fost găsit.");
    if (contract.status !== "activ" || contract.este_act_aditional) {
      throw businessRule("Salariul se modifică doar pe contractul principal activ.");
    }

    // Zero rânduri afectate = clauza USING a politicii `contracts_update` a
    // respins tranziția, fără nicio eroare (capcana 17) — între citirea de mai
    // sus și scrierea asta, contractul poate fi încetat sau șters logic de
    // altcineva. Aici tăcerea e cea mai scumpă din modul: contractul e document
    // cu efect legal, iar un salariu raportat ca modificat și nescris intră în
    // statul de plată și în REVISAL cu suma veche, fără ca cineva să afle.
    const { data: contractModificat, error } = await db
      .from("employment_contracts")
      .update({ salariu_baza: input.salariu_baza, updated_by: ctx.user.id })
      .eq("id", contract.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (contractModificat === null) {
      throw businessRule(
        "Salariul NU a fost modificat: contractul a fost încetat sau modificat de altcineva între timp, ori nu aveți dreptul asupra lui. Reîncărcați fișa angajatului și verificați suma aflată acum în contract.",
      );
    }

    revalidatePath("/angajati");
    revalidatePath(`/angajati/${contract.employee_id}`);
    return { id: contract.id, employee_id: contract.employee_id };
  },
});

export const dezvaluieDateSensibile = createAction({
  name: "employees.sensitive.reveal",
  permission: "employees:read",
  minScope: "all",
  input: dezvaluieDateSensibileSchema,
  audit: {
    action: "view",
    entityType: "employee_sensitive_data",
    entityId: (input) => input.employee_id,
    allow: ["employee_id", "camp", "motiv"],
  },
  handler: async (ctx, input): Promise<Readonly<{ camp: "cnp" | "iban"; valoare: string }>> => {
    const db = await createServerSupabase();
    // NU un `.select()` direct pe `employee_sensitive_data`: 0025_fisa_angajat_
    // rezumat_sensibil.sql a acordat explicit grant DOAR pe cele 5 coloane
    // mascate — criptotextul rămâne inaccesibil prin API-ul public „indiferent
    // ce selectează clientul" (comentariul acelei migrări). Un SELECT pe
    // cnp_ciphertext/iv/tag/key_version prin clientul RLS eșuează mereu cu
    // 42501 — bug confirmat, geamănul celui de pe calea de scriere.
    const { data: randuri, error } = await db.rpc("hr_read_sensitive", {
      p_employee: input.employee_id,
    });
    if (error !== null) throw error;
    const data: RandSensibil | undefined = randuri?.[0];
    if (data === undefined) throw notFound("Angajatul nu are date de identificare înregistrate.");

    // Coloanele sunt nullable: un angajat poate exista fără CNP sau fără IBAN.
    // Absența se tratează înainte de decriptare — `decrypt` primește doar valori
    // complete, iar un câmp parțial (criptotext fără IV sau fără tag) înseamnă
    // date corupte, nu date lipsă, și trebuie să se vadă ca atare.
    const brut =
      input.camp === "cnp"
        ? {
            ciphertext: data.cnp_ciphertext,
            iv: data.cnp_iv,
            tag: data.cnp_tag,
            keyVersion: data.cnp_key_version,
          }
        : {
            ciphertext: data.iban_ciphertext,
            iv: data.iban_iv,
            tag: data.iban_tag,
            keyVersion: data.iban_key_version,
          };

    const valoare =
      brut.ciphertext === null || brut.iv === null || brut.tag === null || brut.keyVersion === null
        ? null
        : decrypt({
            ciphertext: dinBytea(brut.ciphertext),
            iv: dinBytea(brut.iv),
            tag: dinBytea(brut.tag),
            keyVersion: String(brut.keyVersion),
          });
    if (valoare === null) {
      throw notFound(
        input.camp === "cnp"
          ? "CNP-ul nu este completat pentru acest angajat."
          : "IBAN-ul nu este completat pentru acest angajat.",
      );
    }

    // Tabela cu criptotext nu are trigger generic de audit (S10) — rândul se scrie explicit.
    await writeAuditLog(ctx.supabase, {
      organizationId: ctx.tenant.organizationId,
      action: "view",
      status: "success",
      entityType: "employee_sensitive_data",
      entityId: input.employee_id,
      before: null,
      after: { camp: input.camp, motiv: input.motiv },
      errorCode: null,
      requestId: ctx.requestId,
      meta: await readRequestMeta(),
    });

    return { camp: input.camp, valoare };
  },
});
