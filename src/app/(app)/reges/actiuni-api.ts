// src/app/(app)/reges/actiuni-api.ts
"use server";

/**
 * Acțiunile care vorbesc cu API-ul REGES-Online.
 *
 * Separate de `actions.ts` (care ține evidența locală și exportul CSV) fiindcă
 * au altă natură: fiecare dintre ele produce un efect IREVERSIBIL în registrul
 * oficial al Inspecției Muncii. Separarea face vizibil, la citirea listei de
 * fișiere, unde se trece granița către exterior.
 *
 * DE CE MESAJELE DE SALARIAT PLEACĂ DE AICI, ȘI NU DIN CICLUL AUTOMAT
 * Un mesaj `Salariat` conține CNP-ul în clar. Aici rulăm sub identitatea
 * utilizatorului real, deci decriptarea trece prin `hr_read_sensitive`, care
 * cere `employees:read = all` și scrie rândul de audit. Ciclul de reconciliere
 * rulează cu `service_role` și ar ocoli exact acel audit — de aceea el trimite
 * doar contracte și acțiuni, care nu conțin date personale.
 */

import { revalidatePath } from "next/cache";

import { compuneSalariat } from "@/lib/reges/compune";
import { mascheazaText } from "@/domain/reges/mascare";
import { idNomenclatorDinRaspuns } from "@/domain/reges/nomenclator-raspuns";
import { pregatesteMesaje } from "@/lib/reges/coada";
import {
  citesteCredentiale,
  citesteRezumatCredentiale,
  scrieCredentiale,
} from "@/lib/reges/credentiale";
import { jetonValid } from "@/lib/reges/jeton";
import { sincronizeazaNomenclatoare } from "@/lib/reges/nomenclatoare";
import { cheamaReges, type Mediu } from "@/lib/reges/client";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import type { ActionResult } from "@/lib/actions/types";
// ⚠ OCOLEȘTE RLS. Necesar pentru DOUĂ lucruri, ambele imposibile altfel:
//   1. `reges_credentiale` n-are nicio politică și niciun privilegiu pentru
//      `authenticated` — jetonul se citește și se scrie doar cu service_role;
//   2. rândurile de jurnal și actualizarea stării mesajului se fac în aceeași
//      tranzacție logică cu apelul extern.
// Fiecare interogare de mai jos filtrează EXPLICIT pe `organization_id` luat din
// `ctx.tenant`, niciodată dintr-un argument venit de la client.
import { createAdminSupabase } from "@/lib/supabase/admin";
import { decrypt, dinBytea } from "@/lib/crypto/aes-gcm";
import { idOrganizatie } from "@/lib/queries/reges";

import {
  activeazaSchema,
  clasificareSchema,
  credentialeSchema,
  propunePlecareSchema,
  raspundePropuneriiSchema,
  pregatesteSchema,
  transmiteSchema,
  anuleazaMesajSchema,
  sporAngajatorSchema,
  type ActiveazaInput,
  type AnuleazaMesajInput,
  type ClasificareInput,
  type CredentialeInput,
  type PregatesteInput,
  type PropunePlecareInput,
  type RaspundePropuneriiInput,
  type SporAngajatorInput,
  type TransmiteInput,
} from "./constante";

const RUTE = ["/reges", "/reges/setari", "/reges/propuneri"];

// ── Pregătirea cozii ────────────────────────────────────────────────────────

const actiunePregateste = createAction<typeof pregatesteSchema, { mesaje: number }>({
  name: "reges.pregateste",
  feature: "reges",
  permission: "reges:create",
  minScope: "all",
  input: pregatesteSchema,
  audit: { action: "create", entityType: "reges_mesaje", allow: ["evenimentId"] },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    const organizationId = idOrganizatie(ctx.tenant);

    const { data: eveniment, error } = await ctx.supabase
      .from("reges_evenimente")
      .select("id, event_type, employee_id, contract_id")
      .eq("id", input.evenimentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) throw error;
    if (eveniment === null) throw notFound("Evenimentul REGES nu a fost găsit.");

    const [{ data: angajat }, { data: contract }] = await Promise.all([
      ctx.supabase
        .from("employees")
        .select("reges_salariat_id")
        .eq("id", eveniment.employee_id)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      eveniment.contract_id === null
        ? Promise.resolve({ data: null })
        : ctx.supabase
            .from("employment_contracts")
            .select("reges_contract_id")
            .eq("id", eveniment.contract_id)
            .eq("organization_id", organizationId)
            .maybeSingle(),
    ]);

    const rezultat = await pregatesteMesaje(ctx.supabase, {
      organizationId,
      evenimentId: eveniment.id,
      employeeId: eveniment.employee_id,
      contractId: eveniment.contract_id,
      tipEveniment: eveniment.event_type,
      regesSalariatId: angajat?.reges_salariat_id ?? null,
      regesContractId: contract?.reges_contract_id ?? null,
    });
    if (!rezultat.ok) throw businessRule(rezultat.motiv);

    return { mesaje: rezultat.mesajeCreate };
  },
});

export async function pregatesteTransmiterea(
  input: PregatesteInput,
): Promise<ActionResult<{ mesaje: number }>> {
  return actiunePregateste(input);
}

// ── Trimiterea ──────────────────────────────────────────────────────────────

const actiuneTransmite = createAction<typeof transmiteSchema, { stare: string; mesaj: string }>({
  name: "reges.transmite",
  feature: "reges",
  permission: "reges:transmit",
  minScope: "all",
  input: transmiteSchema,
  audit: {
    action: "update",
    entityType: "reges_mesaje",
    entityId: (i) => i.mesajId,
    allow: ["mesajId"],
  },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    const organizationId = idOrganizatie(ctx.tenant);
    const admin = createAdminSupabase();

    const { data: mesaj, error } = await ctx.supabase
      .from("reges_mesaje")
      .select(
        "id, tip, operatie, stare, message_id, employee_id, contract_id, depinde_de, incercari",
      )
      .eq("id", input.mesajId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) throw error;
    if (mesaj === null) throw notFound("Mesajul nu a fost găsit.");
    if (mesaj.stare !== "de_transmis") {
      throw businessRule("Mesajul a plecat deja sau a fost anulat. Reîncărcați pagina.");
    }

    const cred = await citesteCredentiale(ctx.supabase, organizationId);
    if (cred === null) {
      throw businessRule(
        "Cheile API REGES nu sunt configurate pentru firma aceasta. Completați-le în „REGES-Online → Setări”.",
      );
    }

    const jeton = await jetonValid(admin, cred);
    if (!jeton.ok) throw businessRule(jeton.mesaj);

    if (mesaj.tip !== "salariat") {
      throw businessRule(
        "Mesajele de contract pleacă din ciclul de reconciliere, nu de aici. Apăsați „Verifică răspunsurile” ca să-l pornească acum.",
      );
    }
    if (mesaj.employee_id === null) throw businessRule("Mesajul nu are angajat asociat.");

    // CNP-ul se citește prin RPC-ul care AUDITEAZĂ citirea. Un `select` direct
    // pe `employee_sensitive_data` e refuzat de granturi (0007), iar ocolirea cu
    // `service_role` ar sări peste rândul de audit — exact ce nu vrem pentru
    // datele care pleacă la o autoritate.
    const { data: sensibile, error: eroareCnp } = await ctx.supabase.rpc("hr_read_sensitive", {
      p_employee: mesaj.employee_id,
    });
    if (eroareCnp !== null) throw eroareCnp;
    const brut = Array.isArray(sensibile) ? sensibile[0] : null;
    if (
      brut === null ||
      brut === undefined ||
      brut.cnp_ciphertext === null ||
      brut.cnp_iv === null ||
      brut.cnp_tag === null ||
      brut.cnp_key_version === null
    ) {
      throw businessRule("Angajatul nu are CNP înregistrat, iar REGES îl cere obligatoriu.");
    }
    const cnp = decrypt({
      ciphertext: dinBytea(brut.cnp_ciphertext),
      iv: dinBytea(brut.cnp_iv),
      tag: dinBytea(brut.cnp_tag),
      keyVersion: String(brut.cnp_key_version),
    });

    const { data: angajat } = await ctx.supabase
      .from("employees")
      // prettier-ignore
      .select(
        "first_name, last_name, adresa_strada, adresa_oras, adresa_judet, adresa_cod_postal, cetatenie, data_nasterii, reges_tip_act, reges_salariat_id",
      )
      .eq("id", mesaj.employee_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (angajat === null || angajat === undefined)
      throw notFound("Fișa angajatului nu mai există.");

    const compus = await compuneSalariat(ctx.supabase, angajat, cnp, {
      messageId: mesaj.message_id,
      autorId: ctx.user.id,
      sesiuneId: ctx.requestId,
      utilizator: ctx.user.email ?? "operator",
    });
    if (!compus.ok) {
      throw businessRule(
        `Fișa nu poate fi transmisă încă: ${compus.probleme.map((p) => p.mesaj).join(" ")}`,
      );
    }

    const raspuns = await cheamaReges<{ responseId?: string }>({
      mediu: cred.mediu as Mediu,
      cale: "/api/Salariat",
      metoda: "POST",
      jeton: jeton.jeton,
      corp: compus.mesaj,
    });

    await admin.from("reges_apeluri").insert({
      organization_id: organizationId,
      mesaj_id: mesaj.id,
      metoda: "POST",
      cale: "/api/Salariat",
      http_status: raspuns.status,
      durata_ms: raspuns.durataMs,
      consumer_id: cred.consumerId,
      eroare: raspuns.ok ? null : mascheazaText(raspuns.mesaj),
    });

    if (!raspuns.ok) {
      await admin
        .from("reges_mesaje")
        .update({
          // Un 400 nu se mai reîncearcă: același mesaj primește același refuz.
          ...(raspuns.motiv === "validare"
            ? { stare: "esuat" as const, trimis_la: new Date().toISOString() }
            : { incercari: mesaj.incercari + 1 }),
          eroare: mascheazaText(raspuns.mesaj),
          http_status: raspuns.status,
        })
        .eq("id", mesaj.id)
        .eq("organization_id", organizationId);
      throw businessRule(`Inspecția Muncii a respins mesajul: ${raspuns.mesaj}`);
    }

    await admin
      .from("reges_mesaje")
      .update({
        stare: "asteapta_raspuns",
        response_id: raspuns.date?.responseId ?? null,
        trimis_la: new Date().toISOString(),
        trimis_de: ctx.user.id,
        incercari: mesaj.incercari + 1,
        http_status: raspuns.status,
        eroare: null,
      })
      .eq("id", mesaj.id)
      .eq("organization_id", organizationId);

    return {
      stare: "asteapta_raspuns",
      mesaj:
        "Mesajul a intrat în coada Inspecției Muncii. Rezultatul apare aici după procesare — de obicei în câteva minute.",
    };
  },
});

export async function transmiteMesajul(
  input: TransmiteInput,
): Promise<ActionResult<{ stare: string; mesaj: string }>> {
  return actiuneTransmite(input);
}

// ── Anularea ────────────────────────────────────────────────────────────────

const actiuneAnuleaza = createAction<typeof anuleazaMesajSchema, { id: string }>({
  name: "reges.anuleaza_mesaj",
  feature: "reges",
  permission: "reges:update",
  minScope: "all",
  input: anuleazaMesajSchema,
  audit: {
    action: "update",
    entityType: "reges_mesaje",
    entityId: (i) => i.mesajId,
    allow: ["mesajId", "motiv"],
  },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    const organizationId = idOrganizatie(ctx.tenant);

    // Un mesaj plecat NU se poate anula la noi: e deja în coada ITM. Corectarea
    // lui se face transmițând o operație de corecție, care rămâne în istoricul
    // Inspecției Muncii — asta e regula lor, nu alegerea noastră.
    const { data, error } = await ctx.supabase
      .from("reges_mesaje")
      .update({ stare: "anulat", eroare: input.motiv })
      .eq("id", input.mesajId)
      .eq("organization_id", organizationId)
      .eq("stare", "de_transmis")
      .is("deleted_at", null)
      .select("id");
    if (error !== null) throw error;
    // Zero rânduri = politica a respins, sau starea s-a schimbat între timp.
    // Un UPDATE respins de `USING` nu produce nicio eroare (capcana 17).
    if (data === null || data.length === 0) {
      throw businessRule(
        "Mesajul nu mai poate fi anulat: a plecat deja sau altcineva l-a schimbat.",
      );
    }
    return { id: input.mesajId };
  },
});

export async function anuleazaMesajul(
  input: AnuleazaMesajInput,
): Promise<ActionResult<{ id: string }>> {
  return actiuneAnuleaza(input);
}

// ── Credențiale ─────────────────────────────────────────────────────────────

const actiuneSalveazaCredentiale = createAction<typeof credentialeSchema, { ok: true }>({
  name: "reges.salveaza_credentiale",
  feature: "reges",
  permission: "reges:configure",
  minScope: "all",
  input: credentialeSchema,
  audit: {
    action: "update",
    entityType: "reges_credentiale",
    // Secretele NU apar în allow-list. Chiar dacă ar apărea, deny-list-ul din
    // `redactPayload` le-ar tăia după `secret` și `parol` — dar allow-list-ul e
    // prima barieră, și singura care nu depinde de numele câmpului.
    allow: ["mediu", "cuiAngajator", "clientId", "utilizator"],
  },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    await scrieCredentiale(ctx.supabase, {
      organizationId: idOrganizatie(ctx.tenant),
      mediu: input.mediu,
      cuiAngajator: input.cuiAngajator,
      clientId: input.clientId,
      utilizator: input.utilizator,
      clientSecret:
        input.clientSecret === undefined || input.clientSecret === "" ? null : input.clientSecret,
      parola: input.parola === undefined || input.parola === "" ? null : input.parola,
    });
    return { ok: true as const };
  },
});

export async function salveazaCredentialele(
  input: CredentialeInput,
): Promise<ActionResult<{ ok: true }>> {
  return actiuneSalveazaCredentiale(input);
}

const schemaGoala = credentialeSchema.pick({});

/**
 * Testul de conexiune: `GET /api/Profile` cu jetonul firmei.
 *
 * E singurul apel din modul care nu schimbă nimic la ITM, deci singurul care se
 * poate face oricând fără consecințe. Rezultatul se scrie pe rândul de
 * credențiale, ca ecranul să arate ULTIMA verificare, nu doar cea din sesiunea
 * curentă.
 */
const actiuneTesteaza = createAction<typeof schemaGoala, { ok: boolean; mesaj: string }>({
  name: "reges.testeaza_conexiunea",
  feature: "reges",
  permission: "reges:configure",
  minScope: "all",
  input: schemaGoala,
  audit: { action: "view", entityType: "reges_credentiale", allow: [] },
  revalidate: RUTE,
  handler: async (ctx) => {
    const organizationId = idOrganizatie(ctx.tenant);
    const admin = createAdminSupabase();

    const cred = await citesteCredentiale(ctx.supabase, organizationId);
    if (cred === null) {
      return { ok: false, mesaj: "Completați și salvați întâi Client Secret și parola." };
    }

    const jeton = await jetonValid(admin, cred);
    let ok = false;
    let mesaj: string;

    if (!jeton.ok) {
      mesaj = jeton.mesaj;
    } else {
      const profil = await cheamaReges<unknown>({
        mediu: cred.mediu as Mediu,
        cale: "/api/Profile",
        metoda: "GET",
        jeton: jeton.jeton,
      });
      ok = profil.ok;
      mesaj = profil.ok
        ? "Legătura cu Inspecția Muncii funcționează."
        : `Autentificarea a reușit, dar /api/Profile a răspuns: ${profil.mesaj}`;

      await admin.from("reges_apeluri").insert({
        organization_id: organizationId,
        mesaj_id: null,
        metoda: "GET",
        cale: "/api/Profile",
        http_status: profil.status,
        durata_ms: profil.durataMs,
        consumer_id: cred.consumerId,
        eroare: profil.ok ? null : mascheazaText(profil.mesaj),
      });
    }

    await admin
      .from("reges_credentiale")
      .update({
        verificat_la: new Date().toISOString(),
        verificat_ok: ok,
        verificat_mesaj: mascheazaText(mesaj),
      })
      .eq("organization_id", organizationId);

    return { ok, mesaj };
  },
});

export async function testeazaConexiunea(): Promise<ActionResult<{ ok: boolean; mesaj: string }>> {
  return actiuneTesteaza({});
}

const actiuneActiveaza = createAction<typeof activeazaSchema, { activ: boolean }>({
  name: "reges.activeaza",
  feature: "reges",
  permission: "reges:configure",
  minScope: "all",
  input: activeazaSchema,
  audit: { action: "update", entityType: "reges_credentiale", allow: ["activ"] },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    const organizationId = idOrganizatie(ctx.tenant);

    if (input.activ) {
      const rezumat = await citesteRezumatCredentiale(ctx.supabase, organizationId);
      if (rezumat === null || !rezumat.areSecret || !rezumat.areParola) {
        throw businessRule("Completați Client Secret și parola înainte de a porni transmiterea.");
      }
      if (rezumat.verificatOk !== true) {
        throw businessRule(
          "Testați întâi conexiunea. Pornirea transmiterii cu chei neverificate umple coada cu erori.",
        );
      }
    }

    const admin = createAdminSupabase();
    const { error } = await admin
      .from("reges_credentiale")
      .update({ activ: input.activ })
      .eq("organization_id", organizationId);
    if (error !== null) throw error;
    return { activ: input.activ };
  },
});

export async function comutaActivarea(
  input: ActiveazaInput,
): Promise<ActionResult<{ activ: boolean }>> {
  return actiuneActiveaza(input);
}

// ── Nomenclatoare ───────────────────────────────────────────────────────────

const actiuneSincronizeaza = createAction<typeof schemaGoala, { tipuri: number; randuri: number }>({
  name: "reges.sincronizeaza_nomenclatoare",
  feature: "reges",
  permission: "reges:configure",
  minScope: "all",
  input: schemaGoala,
  audit: { action: "update", entityType: "reges_nomenclatoare", allow: [] },
  revalidate: RUTE,
  handler: async (ctx) => {
    const organizationId = idOrganizatie(ctx.tenant);
    const admin = createAdminSupabase();

    const cred = await citesteCredentiale(ctx.supabase, organizationId);
    if (cred === null) throw businessRule("Configurați întâi cheile API REGES.");

    const jeton = await jetonValid(admin, cred);
    if (!jeton.ok) throw businessRule(jeton.mesaj);

    const rezultat = await sincronizeazaNomenclatoare(admin, cred, jeton.jeton);
    if (!rezultat.ok) throw businessRule(rezultat.mesaj);
    return { tipuri: rezultat.tipuri, randuri: rezultat.randuri };
  },
});

export async function sincronizeazaNomenclatoarele(): Promise<
  ActionResult<{ tipuri: number; randuri: number }>
> {
  return actiuneSincronizeaza({});
}

// ── Propuneri de detașare și de mutare ──────────────────────────────────────

/**
 * Răspunsul la o propunere PRIMITĂ.
 *
 * Fluxul diferă de vechiul Revisal: angajatorul sursă nu transmite o detașare,
 * ci o PROPUNERE, iar angajatorul destinație o acceptă sau o respinge printr-un
 * mesaj propriu. Rândul local se mută în starea finală abia după ce Inspecția
 * Muncii a primit mesajul — altfel ecranul ar arăta „acceptată" pentru ceva ce
 * n-a plecat niciodată.
 */
const actiuneRaspundePropunerii = createAction<typeof raspundePropuneriiSchema, { stare: string }>({
  name: "reges.raspunde_propunerii",
  feature: "reges",
  permission: "reges:transmit",
  minScope: "all",
  input: raspundePropuneriiSchema,
  audit: {
    action: "update",
    entityType: "reges_propuneri",
    entityId: (i) => i.propunereId,
    allow: ["propunereId", "raspuns", "observatii"],
  },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    const organizationId = idOrganizatie(ctx.tenant);
    const admin = createAdminSupabase();

    const { data: propunere, error } = await ctx.supabase
      .from("reges_propuneri")
      .select("id, fel, directie, stare, reges_propunere_id, reges_contract_id")
      .eq("id", input.propunereId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) throw error;
    if (propunere === null) throw notFound("Propunerea nu a fost găsită.");
    if (propunere.directie !== "primita") {
      throw businessRule("Doar propunerile PRIMITE se acceptă sau se resping de aici.");
    }
    if (propunere.stare !== "noua") {
      throw businessRule("Propunerii i s-a răspuns deja. Reîncărcați pagina.");
    }
    if (propunere.reges_propunere_id === null) {
      throw businessRule("Propunerea nu are identificator REGES: nu se poate răspunde la ea.");
    }

    const cred = await citesteCredentiale(ctx.supabase, organizationId);
    if (cred === null) throw businessRule("Configurați întâi cheile API REGES.");
    const jeton = await jetonValid(admin, cred);
    if (!jeton.ok) throw businessRule(jeton.mesaj);

    const fel = propunere.fel === "mutare" ? "Mutare" : "Detasare";
    const operatie =
      input.raspuns === "acceptata"
        ? `AcceptarePropunere${fel}Contract`
        : `RespingerePropunere${fel}Contract`;
    const cale = propunere.fel === "mutare" ? "/api/Mutare/Propuneri" : "/api/Detasare/Propuneri";

    const corp = {
      $type: propunere.fel === "mutare" ? "propunereMutareContract" : "propunereDetasareContract",
      header: {
        messageId: crypto.randomUUID(),
        clientApplication: "Administrativo",
        version: "5",
        operation: operatie,
        authorId: ctx.user.id,
        sessionId: ctx.requestId,
        user: ctx.user.email ?? "operator",
        timestamp: new Date().toISOString(),
      },
      referintaPropunere: { $type: "referinta", id: propunere.reges_propunere_id },
      ...(input.observatii === undefined || input.observatii === ""
        ? {}
        : { explicatie: input.observatii }),
    };

    const raspuns = await cheamaReges<{ responseId?: string }>({
      mediu: cred.mediu as Mediu,
      cale,
      metoda: "POST",
      jeton: jeton.jeton,
      parametri: { consumerId: cred.consumerId },
      corp,
    });

    await admin.from("reges_apeluri").insert({
      organization_id: organizationId,
      mesaj_id: null,
      metoda: "POST",
      cale,
      http_status: raspuns.status,
      durata_ms: raspuns.durataMs,
      consumer_id: cred.consumerId,
      eroare: raspuns.ok ? null : mascheazaText(raspuns.mesaj),
    });

    if (!raspuns.ok) {
      throw businessRule(`Inspecția Muncii a respins răspunsul: ${raspuns.mesaj}`);
    }

    // `.select()` după `.update()`: un UPDATE respins de `USING` afectează zero
    // rânduri fără nicio eroare (capcana 17), iar noi tocmai am trimis mesajul.
    const { data: actualizat, error: eroareStare } = await ctx.supabase
      .from("reges_propuneri")
      .update({
        stare: input.raspuns,
        raspuns_la: new Date().toISOString(),
        raspuns_de: ctx.user.id,
        ...(input.observatii === undefined ? {} : { observatii: input.observatii }),
      })
      .eq("id", propunere.id)
      .eq("organization_id", organizationId)
      .eq("stare", "noua")
      .select("id");
    if (eroareStare !== null) throw eroareStare;
    if (actualizat === null || actualizat.length === 0) {
      throw businessRule(
        "Răspunsul a plecat la Inspecția Muncii, dar starea locală nu s-a putut actualiza. Reîncărcați pagina.",
      );
    }

    return { stare: input.raspuns };
  },
});

export async function raspundePropunerii(
  input: RaspundePropuneriiInput,
): Promise<ActionResult<{ stare: string }>> {
  return actiuneRaspundePropunerii(input);
}

/**
 * Propune o detașare sau o mutare către alt angajator.
 *
 * Scrie DOUĂ rânduri legate: propunerea (cu datele pe care REGES le cere și pe
 * care contractul nostru nu le are — CUI-ul destinației, perioada, temeiul) și
 * mesajul care o va duce acolo. Trimiterea rămâne a ciclului de reconciliere:
 * mesajul nu conține date personale, deci nu are ce căuta pe drumul care
 * decriptează CNP-uri.
 */
const actiunePropunePlecare = createAction<typeof propunePlecareSchema, { id: string }>({
  name: "reges.propune_plecare",
  feature: "reges",
  permission: "reges:create",
  minScope: "all",
  input: propunePlecareSchema,
  audit: {
    action: "create",
    entityType: "reges_propuneri",
    allow: [
      "contractId",
      "fel",
      "cuiDestinatie",
      "numeDestinatie",
      "dataInceput",
      "dataSfarsit",
      "temeiLegal",
    ],
  },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    const organizationId = idOrganizatie(ctx.tenant);

    const { data: contract, error } = await ctx.supabase
      .from("employment_contracts")
      .select("id, employee_id, status, reges_contract_id")
      .eq("id", input.contractId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) throw error;
    if (contract === null) throw notFound("Contractul nu a fost găsit.");
    if (contract.status !== "activ") {
      throw businessRule("Doar un contract activ poate fi propus spre detașare.");
    }
    // Propunerea merge PRIN REFERINȚĂ la contractul de la ITM. Fără el, mesajul
    // ar fi respins asincron cu „referință inexistentă".
    if (contract.reges_contract_id === null) {
      throw businessRule(
        "Contractul nu are încă identificator REGES. Transmiteți întâi adăugarea lui la Inspecția Muncii.",
      );
    }
    if (input.dataSfarsit !== undefined && input.dataSfarsit < input.dataInceput) {
      throw businessRule("Data de sfârșit e înaintea celei de început.");
    }

    const operatie =
      input.fel === "mutare" ? "PropunereMutareContract" : "PropunereDetasareContract";

    const { data: mesaj, error: eroareMesaj } = await ctx.supabase
      .from("reges_mesaje")
      .insert({
        organization_id: organizationId,
        employee_id: contract.employee_id,
        contract_id: contract.id,
        tip: input.fel === "mutare" ? "propunere_mutare" : "propunere_detasare",
        operatie,
        cerere_rezumat: { fel: input.fel, cuiDestinatie: input.cuiDestinatie },
      })
      .select("id")
      .single();
    if (eroareMesaj !== null) throw eroareMesaj;

    const { data: propunere, error: eroarePropunere } = await ctx.supabase
      .from("reges_propuneri")
      .insert({
        organization_id: organizationId,
        directie: "trimisa",
        fel: input.fel,
        contract_id: contract.id,
        mesaj_id: mesaj.id,
        reges_contract_id: contract.reges_contract_id,
        angajator_partener_cui: input.cuiDestinatie,
        angajator_partener_nume: input.numeDestinatie ?? null,
        data_inceput: input.dataInceput,
        data_sfarsit: input.dataSfarsit ?? null,
        temei_legal: input.temeiLegal,
      })
      .select("id")
      .single();
    if (eroarePropunere !== null) throw eroarePropunere;

    return { id: propunere.id };
  },
});

export async function propunePlecarea(
  input: PropunePlecareInput,
): Promise<ActionResult<{ id: string }>> {
  return actiunePropunePlecare(input);
}

// ── Clasificarea REGES a contractului ───────────────────────────────────────

/**
 * Salvează cele patru valori de protocol pe care REGES le cere și modelul nostru
 * nu le are: tipul de contract, tipul de normă, norma de timp și repartizarea.
 *
 * Compunerea mesajului le deduce din normă și din modul de lucru dacă lipsesc —
 * dar deducția e o PROPUNERE. `RaportDeServiciu` sau `ContractDeManagement` nu se
 * pot deduce din nimic din ce ținem, iar `NormaOUG132` (Kurzarbeit) nu se distinge
 * de timpul parțial obișnuit după numărul de ore: e o decizie administrativă.
 * Alegerea explicită de aici bate întotdeauna deducția.
 */
const actiuneClasifica = createAction<typeof clasificareSchema, { id: string }>({
  name: "reges.clasifica_contract",
  feature: "reges",
  permission: "reges:update",
  minScope: "all",
  input: clasificareSchema,
  audit: {
    action: "update",
    entityType: "employment_contract",
    entityId: (i) => i.contractId,
    allow: ["contractId", "tipContract", "tipNorma", "normaTimp", "repartizare", "temeiIncetare"],
  },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    const organizationId = idOrganizatie(ctx.tenant);

    const { data, error } = await ctx.supabase
      .from("employment_contracts")
      .update({
        reges_tip_contract: input.tipContract,
        reges_tip_norma: input.tipNorma,
        reges_norma_timp: input.normaTimp,
        reges_repartizare: input.repartizare,
        ...(input.temeiIncetare === undefined
          ? {}
          : { reges_temei_incetare: input.temeiIncetare === "" ? null : input.temeiIncetare }),
        updated_by: ctx.user.id,
      })
      .eq("id", input.contractId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("id");
    if (error !== null) throw error;
    // Politica de UPDATE pe contracte cere `employees:update = all`, nu
    // `reges:update`. Cine are dreptul de a corecta coada, dar nu și pe cel de a
    // atinge dosarul de personal, primește zero rânduri ȘI NICIO EROARE
    // (capcana 17) — de aceea `.select()`, nu încrederea în absența erorii.
    if (data === null || data.length === 0) {
      throw businessRule(
        "Clasificarea nu a putut fi salvată: modificarea contractului cere și dreptul „Angajați — modificare”.",
      );
    }

    return { id: input.contractId };
  },
});

export async function salveazaClasificarea(
  input: ClasificareInput,
): Promise<ActionResult<{ id: string }>> {
  return actiuneClasifica(input);
}

// ── Sporurile proprii firmei ────────────────────────────────────────────────

/**
 * Endpoint-ul pe care se înregistrează un spor specific angajatorului.
 *
 * Sporurile din nomenclatorul NAȚIONAL (`TipSpor`) se citesc prin
 * `/api/Nomenclator?tip=toate` și se mapează direct. Cele negociate intern —
 * „spor de fidelitate" și rudele lui — nu există acolo: trebuie mai întâi
 * create în registrul firmei, iar apelul întoarce UUID-ul cu care abia apoi pot
 * fi referențiate în `referintaTipSpor`.
 */
const CALE_SPOR_ANGAJATOR = "/api/Nomenclatoare/SporAngajator";

const actiuneSporAngajator = createAction<typeof sporAngajatorSchema, { regesId: string }>({
  name: "reges.spor_angajator.creeaza",
  feature: "reges",
  // Aceeași poartă ca sincronizarea nomenclatoarelor și ca profilul: e un act de
  // configurare a registrului firmei, nu o transmitere de contract.
  permission: "reges:configure",
  minScope: "all",
  input: sporAngajatorSchema,
  audit: {
    action: "create",
    entityType: "reges_nomenclator",
    entityId: (_input, data) => data.regesId,
    allow: ["componentTypeId", "dataInceputValabilitate"],
  },
  revalidate: RUTE,
  handler: async (ctx, input) => {
    const organizationId = idOrganizatie(ctx.tenant);
    const admin = createAdminSupabase();

    /*
     * Tipul trebuie să fie AL FIRMEI, nu unul de platformă.
     *
     * `salary_component_types` cu `organization_id is null` sunt împărțite de
     * toate firmele: scris acolo, un UUID obținut de o firmă ar fi folosit de
     * toate celelalte în mesajele lor — o scurgere între chiriași, tăcută și
     * imposibil de observat din ecran. Filtrul e egalitate strictă, nu
     * `or(is.null)`.
     */
    const { data: tip, error: eroareTip } = await admin
      .from("salary_component_types")
      .select("id, denumire, kind, reges_tip_spor_id")
      .eq("id", input.componentTypeId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareTip !== null) throw eroareTip;
    if (tip === null) {
      throw businessRule(
        "Sporul nu a fost găsit printre tipurile proprii firmei. Sporurile de platformă se mapează la nomenclatorul național, nu se înregistrează ca sporuri de angajator.",
      );
    }
    if (tip.kind !== "spor_procent" && tip.kind !== "spor_suma") {
      throw businessRule(
        "Doar sporurile se înregistrează în REGES. Indemnizațiile, primele recurente și beneficiile în natură sunt componente de salarizare internă.",
      );
    }
    if (tip.reges_tip_spor_id !== null) {
      throw businessRule(
        "Sporul are deja un identificator REGES. Înregistrarea lui a doua oară ar crea un duplicat în registrul firmei.",
      );
    }

    const cred = await citesteCredentiale(ctx.supabase, organizationId);
    if (cred === null) {
      throw businessRule("Completați întâi credențialele REGES în Setări.");
    }
    const jeton = await jetonValid(admin, cred);
    if (!jeton.ok) throw businessRule(jeton.mesaj);

    // Schema cere un moment complet, nu o zi: ziua aleasă se ancorează la
    // miezul nopții UTC, ca `ziCaMoment` peste tot altundeva în modul.
    const raspuns = await cheamaReges<unknown>({
      mediu: cred.mediu as Mediu,
      cale: CALE_SPOR_ANGAJATOR,
      metoda: "POST",
      jeton: jeton.jeton,
      corp: {
        denumire: tip.denumire,
        dataInceputValabilitate: `${input.dataInceputValabilitate}T00:00:00Z`,
      },
    });

    await admin.from("reges_apeluri").insert({
      organization_id: organizationId,
      mesaj_id: null,
      metoda: "POST",
      cale: CALE_SPOR_ANGAJATOR,
      http_status: raspuns.status,
      durata_ms: raspuns.durataMs,
      consumer_id: cred.consumerId,
      eroare: raspuns.ok ? null : mascheazaText(raspuns.mesaj),
    });

    if (!raspuns.ok) throw businessRule(raspuns.mesaj);

    const regesId = idNomenclatorDinRaspuns(raspuns.date);
    if (regesId === null) {
      throw businessRule(
        "Inspecția Muncii a acceptat sporul, dar nu a întors identificatorul lui. Verificați în portalul REGES dacă a fost creat, apoi completați maparea manual.",
      );
    }

    /*
     * Două scrieri, în ordinea asta: întâi oglinda nomenclatorului, apoi
     * maparea. Invers, o cădere între ele ar lăsa un tip care trimite o
     * referință pe care oglinda n-o cunoaște — iar ecranul de setări ar arăta
     * un spor mapat la nimic.
     */
    const { error: eroareNomenclator } = await admin.from("reges_nomenclatoare").upsert(
      {
        organization_id: organizationId,
        tip: "SporAngajator",
        reges_id: regesId,
        cod: null,
        nume: tip.denumire,
        activ: true,
        continut: { dataInceputValabilitate: input.dataInceputValabilitate },
        sincronizat_la: new Date().toISOString(),
      },
      { onConflict: "organization_id,tip,reges_id" },
    );
    if (eroareNomenclator !== null) throw eroareNomenclator;

    const { data: mapat, error: eroareMapare } = await admin
      .from("salary_component_types")
      .update({ reges_tip_spor_id: regesId })
      .eq("id", tip.id)
      .eq("organization_id", organizationId)
      // Gardă împotriva unei curse: dacă altcineva a mapat între timp, nu
      // suprascriem cu un al doilea UUID pentru același spor.
      .is("reges_tip_spor_id", null)
      .select("id")
      .maybeSingle();
    if (eroareMapare !== null) throw eroareMapare;
    if (mapat === null) {
      throw businessRule(
        "Sporul a fost creat în REGES, dar maparea locală a fost făcută între timp de altcineva. Verificați în Setări ce identificator poartă acum.",
      );
    }

    return { regesId };
  },
});

export async function creeazaSporAngajator(
  input: SporAngajatorInput,
): Promise<ActionResult<{ regesId: string }>> {
  return actiuneSporAngajator(input);
}

export async function revalideazaReges(): Promise<void> {
  for (const ruta of RUTE) revalidatePath(ruta);
}
