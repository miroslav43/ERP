// src/lib/documents/context-angajat.ts
// Adună din bază tot ce cer cele cinci documente ale înrolării.
//
// ── DE CE E SCOS DIN ACȚIUNE ────────────────────────────────────────────────
// Bucata asta a trăit în `emiteDocumenteLipsa` — 115 linii de citit angajatul,
// contractul de bază activ, funcția, departamentul și fișa postului, plus
// traducerea lor în forma cerută de `genereazaDocumenteInrolare`. Regenerarea
// are nevoie de EXACT aceleași date. Copiată, a doua oară, ar fi însemnat că un
// câmp nou pe contract se adaugă în două locuri, iar cel uitat se manifestă ca
// un document emis cu „nespecificat" în loc de valoare — fără nicio eroare.
//
// ── DE CE PRIMEȘTE ETICHETELE DIN AFARĂ ─────────────────────────────────────
// `ETICHETE_MOD_LUCRU` stă în `src/app/(app)/angajati/etichete.ts`, iar în tot
// proiectul nu există niciun import din `src/lib` către `src/app`. Harta se dă
// ca argument, în loc să se inverseze straturile pentru o singură constantă.
import { notFound, businessRule } from "@/lib/actions/errors";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import type { ServerSupabase } from "@/lib/supabase/server";

import type { ParametriDocumenteInrolare } from "./inrolare";

/** Ce se adună de aici; restul (`emisDe`, `doarCodurile`) vine de la apelant. */
export type ContextInrolare = Omit<ParametriDocumenteInrolare, "emisDe" | "doarCodurile">;

export type ParametriContext = Readonly<{
  organizationId: string;
  employeeId: string;
  /** `ETICHETE_MOD_LUCRU` din stratul de aplicație. */
  etichetaModLucru: Readonly<Record<string, string>>;
}>;

export async function adunaContextInrolare(
  supabase: ServerSupabase,
  parametri: ParametriContext,
): Promise<ContextInrolare> {
  const { organizationId, employeeId } = parametri;

  const { data: angajat } = await supabase
    .from("employees")
    // Un singur literal, fără concatenare: clientul Supabase deduce tipul
    // rândului DIN ȘIRUL de selecție, iar o expresie `"a" + "b"` îl face să
    // cadă pe `GenericStringError` — adică pe `any` cu alt nume.
    .select(
      "id, full_name, adresa_strada, adresa_oras, adresa_judet, serie_act, numar_act, act_eliberat_de, act_eliberat_la, functie, department_id",
    )
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (angajat === null) throw notFound("Fișa de angajat nu există sau nu îți este accesibilă.");

  // Contractul de bază activ. `contracts_employee_activ_uniq` garantează că e
  // cel mult unul, deci nu e nevoie de nicio departajare aici.
  const { data: contract } = await supabase
    .from("employment_contracts")
    .select(
      "id, numar, data_contract, valabil_de_la, valabil_pana, contract_duration, norma_ore_saptamana, norma_ore_zi, work_mode, loc_munca, loc_telemunca, salariu_baza, zile_concediu_anual",
    )
    .eq("employee_id", employeeId)
    .eq("organization_id", organizationId)
    .eq("este_act_aditional", false)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (contract === null) {
    throw businessRule("Angajatul nu are contract, deci nu se poate emite niciun document.");
  }

  // Funcția NU mai cere o interogare: după 0110 e text pe fișă. Rămân două.
  const [departament, fisaPost] = await Promise.all([
    angajat.department_id === null
      ? Promise.resolve(null)
      : supabase
          .from("departments")
          .select("denumire")
          .eq("id", angajat.department_id)
          .maybeSingle(),
    supabase
      .from("job_descriptions")
      .select("subordonare, atributii, competente")
      .eq("employee_id", employeeId)
      .is("deleted_at", null)
      .order("valabil_de_la", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    organizationId,
    employeeId: angajat.id,
    contractId: contract.id,
    azi: todayInBucharest(),
    angajat: {
      nume: angajat.full_name ?? "",
      adresa: [angajat.adresa_strada, angajat.adresa_oras, angajat.adresa_judet]
        .filter((parte): parte is string => parte !== null)
        .join(", "),
      serieAct: angajat.serie_act,
      numarAct: angajat.numar_act,
      actEliberatDe: angajat.act_eliberat_de,
      actEliberatLa: angajat.act_eliberat_la,
      functie: angajat.functie,
      departament: departament?.data?.denumire ?? null,
    },
    contract: {
      numar: contract.numar,
      dataContract: contract.data_contract,
      dataAngajarii: contract.valabil_de_la,
      durata:
        contract.contract_duration === "determinat" && contract.valabil_pana !== null
          ? `determinată, până la ${formatDate(contract.valabil_pana)}`
          : "nedeterminată",
      normaOreSaptamana: Number(contract.norma_ore_saptamana),
      normaOreZi: Number(contract.norma_ore_zi),
      modLucru: parametri.etichetaModLucru[contract.work_mode] ?? contract.work_mode,
      locMunca: contract.loc_munca,
      locTelemunca: contract.loc_telemunca,
      salariuBrut: Number(contract.salariu_baza),
      zileConcediuAnual: contract.zile_concediu_anual,
    },
    codModLucru: contract.work_mode,
    fisaPostului:
      fisaPost.data === null
        ? null
        : {
            subordonare: fisaPost.data.subordonare,
            atributii: (fisaPost.data.atributii as string[] | null) ?? [],
            competente: (fisaPost.data.competente as string[] | null) ?? [],
          },
  };
}
