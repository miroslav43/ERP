// src/app/(app)/angajati/nou/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { createAction } from "@/lib/actions/create-action";
import { formatDate } from "@/lib/format/date";
import { genereazaEvenimenteRevisal } from "@/lib/revisal/genereaza-evenimente";
import { genereazaContractDeMunca } from "@/lib/documents/contract-munca";
import { genereazaFisaPostului } from "@/lib/documents/fisa-postului";
import { inroleazaAngajatSchema } from "@/schemas/employee";

import { ETICHETE_MOD_LUCRU } from "../etichete";
import { salveazaDateSensibile } from "../actions";

interface RezultatInrolare {
  readonly id: string;
  readonly contractId: string;
  readonly documentContractId: string | null;
  readonly documentFisaPostuluiId: string | null;
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

    const { error: eroareActivare } = await db
      .from("employment_contracts")
      .update({ status: "activ", updated_by: ctx.user.id })
      .eq("id", contract.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (eroareActivare !== null) throw eroareActivare;

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
    };
  },
});
