// src/app/(app)/angajati/nou/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { formatDate } from "@/lib/format/date";
import { genereazaEvenimenteRevisal } from "@/lib/revisal/genereaza-evenimente";
import { genereazaContractDeMunca } from "@/lib/documents/contract-munca";
import { genereazaFisaPostului } from "@/lib/documents/fisa-postului";
import { inroleazaAngajatSchema } from "@/schemas/employee";
import { predaObiect } from "@/app/(app)/inventar/actions";
import { adaugaAutorizatieNominala, adaugaFisaAptitudine } from "@/app/(app)/ssm/actions";

import { ETICHETE_MOD_LUCRU } from "../etichete";
import { salveazaDateSensibile } from "../actions";

interface RezultatInrolare {
  readonly id: string;
  readonly contractId: string;
  readonly documentContractId: string | null;
  readonly documentFisaPostuluiId: string | null;
  /**
   * Ce NU s-a putut face, deși înrolarea a reușit.
   *
   * Pașii opționali — bunul de inventar, fișa de aptitudine, autorizația,
   * documentele, evenimentul REVISAL — sunt fiecare într-un `try/catch` care
   * doar loga, fiindcă fiecare are propriul prag de permisiune, diferit de
   * `employees:create`. Principiul e corect: un `hr` fără `inventory:update` nu
   * trebuie să rateze înrolarea din cauza unui laptop.
   *
   * Dar până acum utilizatorul NU AFLA NICIODATĂ. Ecranul spunea „angajat
   * înrolat", iar laptopul rămânea nepredat, fișa medicală neînregistrată și
   * contractul negenerat — tăcut. Exact „gap-ul care generează muncă în plus"
   * pe care modulul își propune să-l închidă.
   */
  readonly avertismente: readonly string[];
}

const CAMPURI_ANGAJAT = [
  "last_name",
  "first_name",
  "email_personal",
  "telefon",
  "adresa_strada",
  "adresa_oras",
  "adresa_judet",
  "adresa_cod_postal",
  "adresa_resedinta_strada",
  "adresa_resedinta_oras",
  "adresa_resedinta_judet",
  "adresa_resedinta_cod_postal",
  "email_serviciu",
  "telefon_serviciu",
  "stare_civila",
  "data_nasterii",
  "gen",
  "cetatenie",
  "tip_act_identitate",
  "serie_act",
  "numar_act",
  "act_eliberat_de",
  "act_valabil_pana",
  "department_id",
  "job_position_id",
  "manager_employee_id",
  "hired_on",
  "conditii_munca",
  "grad_handicap",
  "nr_persoane_intretinere",
  "optiune_pilon_ii",
  "is_primary",
  "contact_urgenta_nume",
  "contact_urgenta_telefon",
  "contact_urgenta_relatie",
  "observatii",
] as const;

const CAMPURI_CONTRACT = [
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
  "conditii_munca",
  "moneda",
  "zile_concediu_anual",
  "perioada_proba_zile",
  "preaviz_zile",
] as const;

function textAtribuiri(text: string | null): readonly string[] {
  if (text === null) return [];
  return text
    .split("\n")
    .map((linie) => linie.trim())
    .filter((linie) => linie.length > 0);
}

export const inroleazaAngajat = createAction<typeof inroleazaAngajatSchema, RezultatInrolare>({
  name: "employees.enroll",
  permission: "employees:create",
  minScope: "all",
  input: inroleazaAngajatSchema,
  audit: {
    action: "create",
    entityType: "employee",
    entityId: (_input, data) => data.id,
    // Salariul rămâne deliberat în afara jurnalului de audit, ca la `creeazaContract`.
    allow: [...CAMPURI_ANGAJAT, ...CAMPURI_CONTRACT],
  },
  handler: async (ctx, input): Promise<RezultatInrolare> => {
    const db = ctx.supabase;
    const avertismente: string[] = [];

    const { data: marca, error: eroareMarca } = await db.rpc("urmatoarea_marca", {
      p_organization_id: ctx.tenant.organizationId,
    });
    if (eroareMarca !== null) throw eroareMarca;

    const {
      cnp,
      iban,
      banca,
      subordonare,
      atributii,
      competente,
      numar,
      data_contract,
      valabil_de_la,
      valabil_pana,
      contract_duration,
      motiv_determinat,
      norma_ore_saptamana,
      norma_ore_zi,
      work_mode,
      special_regime,
      loc_telemunca,
      loc_munca,
      moneda,
      salariu_baza,
      zile_concediu_anual,
      perioada_proba_zile,
      preaviz_zile,
      inventory_item_ids,
      examen_data,
      examen_tip,
      examen_rezultat,
      examen_valabil_pana,
      examen_medic,
      examen_unitate_medicala,
      examen_numar_fisa,
      autorizatii,
      permis_tip,
      permis_numar,
      permis_emis_de,
      permis_valabil_de_la,
      permis_valabil_pana,
      numar_pasaport,
      ...fisa
    } = input;

    const { data: angajat, error: eroareAngajat } = await db
      .from("employees")
      .insert({
        ...fisa,
        marca,
        organization_id: ctx.tenant.organizationId,
        status: "activ",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, full_name")
      .single();
    if (eroareAngajat !== null) throw eroareAngajat;

    await salveazaDateSensibile(db, angajat.id, cnp, iban, banca);

    // RLS (`contracts_insert`) forțează status = 'proiect' la INSERT — vezi
    // comentariul identic din `creeazaContract` (../actions.ts). Activarea e
    // un al doilea pas, prin UPDATE.
    const { data: contract, error: eroareContract } = await db
      .from("employment_contracts")
      .insert({
        employee_id: angajat.id,
        parent_contract_id: null,
        este_act_aditional: false,
        numar,
        data_contract,
        valabil_de_la,
        valabil_pana,
        contract_duration,
        motiv_determinat,
        norma_ore_saptamana,
        norma_ore_zi,
        work_mode,
        special_regime,
        loc_telemunca,
        loc_munca,
        department_id: fisa.department_id,
        job_position_id: fisa.job_position_id,
        conditii_munca: fisa.conditii_munca,
        salariu_baza,
        moneda,
        zile_concediu_anual,
        perioada_proba_zile,
        preaviz_zile,
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
    if (eroareContract !== null) throw eroareContract;

    // `.select()` obligatoriu: un UPDATE respins de clauza `USING` afectează
    // zero rânduri FĂRĂ eroare (capcana 17). Contractul ar rămâne „proiect",
    // iar înrolarea ar raporta succes cu un angajat care nu e angajat.
    const { data: contractActivat, error: eroareActivare } = await db
      .from("employment_contracts")
      .update({ status: "activ", updated_by: ctx.user.id })
      .eq("id", contract.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (eroareActivare !== null) throw eroareActivare;
    if (contractActivat === null) {
      throw businessRule("Contractul a fost creat, dar activarea lui a fost respinsă.");
    }

    const anulAngajarii = Number(valabil_de_la.slice(0, 4));
    const { error: eroareSold } = await db.rpc("seed_leave_balances", {
      p_employee: angajat.id,
      p_an: anulAngajarii,
      p_zile_odihna_override: zile_concediu_anual,
    });
    if (eroareSold !== null) throw eroareSold;

    let jobDescriptionId: string | null = null;
    const listaAtributii = textAtribuiri(atributii);
    const listaCompetente = textAtribuiri(competente);
    if (listaAtributii.length > 0 || listaCompetente.length > 0 || subordonare !== null) {
      const { data: fisaPost, error: eroareFisaPost } = await db
        .from("job_descriptions")
        .insert({
          organization_id: ctx.tenant.organizationId,
          employee_id: angajat.id,
          job_position_id: fisa.job_position_id,
          contract_id: contract.id,
          titlu: `Fișa postului — ${angajat.full_name ?? ""}`,
          atributii: [...listaAtributii],
          competente: [...listaCompetente],
          subordonare,
          valabil_de_la,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })
        .select("id")
        .single();
      if (eroareFisaPost !== null) throw eroareFisaPost;
      jobDescriptionId = fisaPost.id;
    }

    // Bunuri și certificări existente — pași opționali ai formularului.
    // `predaObiect`/`adaugaFisaAptitudine`/`adaugaAutorizatieNominala` verifică
    // FIECARE propriul prag de permisiune (inventory:update / ssm:create),
    // diferit de employees:create — dacă actorul nu-l are, eșecul nu trebuie
    // să anuleze o înrolare deja reușită (același principiu ca la documente).
    // Fiecare bun se predă SEPARAT, cu propriul try/catch: dacă al doilea din
    // trei eșuează, primul rămâne predat și al treilea se încearcă oricum.
    // Un singur try în jurul buclei ar fi transformat un eșec într-o listă
    // predată pe jumătate, fără să se vadă unde s-a rupt.
    for (const itemId of inventory_item_ids) {
      try {
        await predaObiect({
          item_id: itemId,
          employee_id: angajat.id,
          predat_la: null,
          stare_la_predare: "bun",
          observatii: null,
          pv_document_path: null,
        });
      } catch (eroare) {
        avertismente.push(
          "Un bun de inventar nu a putut fi predat. Predați-l manual din fișa angajatului — poate fi nevoie de dreptul „inventar: modificare”.",
        );
        console.error("[inventar] bunul nu a putut fi predat la înrolare", {
          employeeId: angajat.id,
          itemId,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    if (examen_data !== null) {
      try {
        await adaugaFisaAptitudine({
          employee_id: angajat.id,
          tip: examen_tip,
          data_examinarii: examen_data,
          medic: examen_medic,
          unitate_medicala: examen_unitate_medicala,
          rezultat: examen_rezultat,
          valabil_pana: examen_valabil_pana,
          numar_fisa: examen_numar_fisa,
          cost: null,
        });
      } catch (eroare) {
        avertismente.push(
          "Fișa de aptitudine (medicina muncii) nu a putut fi înregistrată. Adăugați-o din SSM → Medicina muncii.",
        );
        console.error("[ssm] fișa de aptitudine nu a putut fi înregistrată la înrolare", {
          employeeId: angajat.id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    // Permisul de muncă, pentru cetățenii non-RO. `work_permits` exista din
    // 0004 cu politici RLS și index de expirare, dar NICIUN cod nu o atingea:
    // un angajat străin se înrola fără aviz, iar expirarea nu apărea nicăieri.
    //
    // Scriere directă, nu printr-o acțiune vecină: nu există una. Pragul e
    // `employees:create`, deja verificat de `createAction` — iar RLS-ul tabelei
    // rămâne bariera.
    if (permis_numar !== null && permis_valabil_de_la !== null && permis_valabil_pana !== null) {
      try {
        const { error: eroarePermis } = await db.from("work_permits").insert({
          organization_id: ctx.tenant.organizationId,
          employee_id: angajat.id,
          tip_permis: permis_tip ?? "aviz",
          numar: permis_numar,
          emis_de: permis_emis_de,
          valabil_de_la: permis_valabil_de_la,
          valabil_pana: permis_valabil_pana,
          numar_pasaport,
          cetatenie: (fisa.cetatenie ?? "RO").toUpperCase(),
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        });
        if (eroarePermis !== null) throw eroarePermis;
      } catch (eroare) {
        avertismente.push(
          "Permisul de muncă nu a putut fi înregistrat. ATENȚIE: munca fără permis valabil e contravenție pentru angajator.",
        );
        console.error("[hr] permisul de muncă nu a putut fi înregistrat la înrolare", {
          employeeId: angajat.id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    for (const autorizatie of autorizatii) {
      try {
        await adaugaAutorizatieNominala({
          employee_id: angajat.id,
          tip: autorizatie.tip,
          grupa: null,
          numar: autorizatie.numar,
          emitent: autorizatie.emitent,
          emis_la: null,
          valabil_pana: autorizatie.valabil_pana,
          suspendata_la: null,
          observatii: null,
        });
      } catch (eroare) {
        avertismente.push(
          `Autorizația „${autorizatie.tip}" nu a putut fi înregistrată. Adăugați-o din SSM → Autorizații.`,
        );
        console.error("[ssm] autorizația nominală nu a putut fi înregistrată la înrolare", {
          employeeId: angajat.id,
          numar: autorizatie.numar,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    // Generarea documentelor nu blochează înrolarea deja reușită — eșecul se
    // vede în jurnalul serverului, iar datele rămân disponibile pentru
    // regenerare manuală (același principiu ca la evenimentele REVISAL, mai jos).
    const [randFunctie, randDepartament] = await Promise.all([
      fisa.job_position_id === null
        ? Promise.resolve(null)
        : db.from("job_positions").select("denumire").eq("id", fisa.job_position_id).maybeSingle(),
      fisa.department_id === null
        ? Promise.resolve(null)
        : db.from("departments").select("denumire").eq("id", fisa.department_id).maybeSingle(),
    ]);
    const denumireFunctie = randFunctie?.data?.denumire ?? null;
    const denumireDepartament = randDepartament?.data?.denumire ?? null;

    let documentContractId: string | null = null;
    try {
      const documentContract = await genereazaContractDeMunca(db, {
        organizationId: ctx.tenant.organizationId,
        employeeId: angajat.id,
        contractId: contract.id,
        emisDe: ctx.user.id,
        numarContract: numar,
        dataContract: data_contract,
        angajatNume: angajat.full_name ?? "",
        angajatAdresa: [fisa.adresa_strada, fisa.adresa_oras, fisa.adresa_judet]
          .filter((v): v is string => v !== null)
          .join(", "),
        functie: denumireFunctie,
        departament: denumireDepartament,
        dataAngajarii: valabil_de_la,
        durataContract:
          contract_duration === "determinat" && valabil_pana !== null
            ? `determinată, până la ${formatDate(valabil_pana)}`
            : "nedeterminată",
        normaOreSaptamana: norma_ore_saptamana,
        normaOreZi: norma_ore_zi,
        modLucru: ETICHETE_MOD_LUCRU[work_mode] ?? work_mode,
        salariuBrut: salariu_baza,
        zileConcediuAnual: zile_concediu_anual,
      });
      documentContractId = documentContract.id;
    } catch (eroare) {
      avertismente.push(
        "Contractul de muncă nu a putut fi generat. Îl puteți genera din fișa angajatului, secțiunea Documente.",
      );
      console.error("[documente] contractul de muncă nu a putut fi generat", {
        employeeId: angajat.id,
        requestId: ctx.requestId,
        eroare,
      });
    }

    let documentFisaPostuluiId: string | null = null;
    if (jobDescriptionId !== null) {
      try {
        const documentFisaPost = await genereazaFisaPostului(db, {
          organizationId: ctx.tenant.organizationId,
          employeeId: angajat.id,
          emisDe: ctx.user.id,
          angajatNume: angajat.full_name ?? "",
          functie: denumireFunctie,
          departament: denumireDepartament,
          subordonare,
          atributii: listaAtributii,
          competente: listaCompetente,
        });
        documentFisaPostuluiId = documentFisaPost.id;
      } catch (eroare) {
        avertismente.push(
          "Fișa postului nu a putut fi generată. O puteți genera din fișa angajatului, secțiunea Documente.",
        );
        console.error("[documente] fișa postului nu a putut fi generată", {
          employeeId: angajat.id,
          requestId: ctx.requestId,
          eroare,
        });
      }
    }

    // REVISAL: aceeași generare idempotentă, mutată din `creeazaContract` —
    // vezi comentariul identic acolo.
    try {
      await genereazaEvenimenteRevisal({
        supabase: db,
        organizationId: ctx.tenant.organizationId,
        userId: ctx.user.id,
        evenimente: [
          {
            employeeId: angajat.id,
            contractId: contract.id,
            tip: "angajare",
            dataEvenimentului: valabil_de_la,
            valabilDeLa: valabil_de_la,
            dataContract: data_contract,
            payload: { numar, salariu_baza },
          },
        ],
      });
    } catch (eroare) {
      avertismente.push(
        "Evenimentul REVISAL de angajare nu a fost generat. ATENȚIE: transmiterea la ITM are termen legal — cel târziu în ziua lucrătoare anterioară începerii activității. Verificați în ecranul REVISAL.",
      );
      console.error("[revisal] evenimentul de angajare nu a putut fi generat", {
        contractId: contract.id,
        requestId: ctx.requestId,
        eroare,
      });
    }

    revalidatePath("/angajati");
    revalidatePath(`/angajati/${angajat.id}`);
    revalidatePath("/revisal");
    revalidatePath("/concedii/sold");

    return {
      id: angajat.id,
      contractId: contract.id,
      documentContractId,
      documentFisaPostuluiId,
      avertismente,
    };
  },
});
