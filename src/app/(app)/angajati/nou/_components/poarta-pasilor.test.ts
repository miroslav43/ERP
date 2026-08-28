// src/app/(app)/angajati/nou/_components/poarta-pasilor.test.ts
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import { inroleazaAngajatSchema, type InroleazaAngajatInput } from "@/schemas/employee";

import { CAMPURI_PAS_1 } from "./pas-1-identitate";
import { CAMPURI_PAS_2 } from "./pas-2-contact";
import { CAMPURI_PAS_3 } from "./pas-3-contract";

/**
 * Poarta „Continuă” a asistentului de înrolare, reprodusă fără DOM.
 *
 * ── DEFECTUL ──────────────────────────────────────────────────────────────
 * Butonul „Continuă” nu avansa și nu scria nimic. `mergiInainte()` cheamă
 * `trigger(campurilePasului)`; `zodResolver` validează OBIECTUL ÎNTREG, iar
 * react-hook-form păstrează erorile doar pentru numele cerute. Câmpul care
 * pica era `special_regime`: `<select>`-ul cu `<option value="">— Niciunul —</option>`
 * trimite ȘIRUL GOL prin `register()`, iar `z.enum(X).nullable()` îl respinge.
 * Pasul 3 nu randa niciun mesaj pentru el, deci ecranul tăcea. Același tipar la
 * `stare_civila`, în pasul 1.
 *
 * ── DE CE AICI ────────────────────────────────────────────────────────────
 * `vitest.config.mts` randează în DOM doar `src/components/`; pentru pagini,
 * unealta e Playwright. Dar poarta asta NU are nevoie de DOM: e schema plus
 * resolver-ul, exact perechea care decidea. Testul reproduce valorile pe care
 * le are formularul în clipa deschiderii — `defaultValues` din asistent, plus
 * ce trimit controalele nemodificate.
 */

/** `defaultValues` din `AsistentAngajatNou`, cuvânt cu cuvânt. */
const IMPLICITE = {
  gen: "nedeclarat",
  cetatenie: "RO",
  nr_persoane_intretinere: 0,
  optiune_pilon_ii: true,
  is_primary: true,
  conditii_munca: "normale",
  contract_duration: "nedeterminat",
  norma_ore_saptamana: 40,
  norma_ore_zi: 8,
  work_mode: "sediu",
  moneda: "RON",
  zile_concediu_anual: 21,
  examen_tip: "angajare",
  examen_rezultat: "apt",
} as const;

/**
 * Ce trimite un control randat, dar neatins.
 *
 * `<select>` cu opțiune goală și `<input>` gol dau amândouă ȘIRUL GOL —
 * niciodată `null`, niciodată `undefined`. Aici stă tot defectul.
 */
const GOALE: Readonly<Record<string, string>> = {
  stare_civila: "",
  special_regime: "",
  department_id: "",
  job_position_id: "",
  manager_employee_id: "",
  punct_lucru_id: "",
  permis_tip: "",
  valabil_pana: "",
  motiv_determinat: "",
  loc_munca: "",
  perioada_proba_zile: "",
  preaviz_zile: "",
  iban: "",
  banca: "",
  data_nasterii: "",
  act_valabil_pana: "",
  grad_handicap: "",
  email_personal: "",
  telefon: "",
  // Numărul de contract e OPȚIONAL din 0098: gol înseamnă „alocă-l tu”.
  numar: "",
};

/**
 * Ce a devenit obligatoriu la înrolare (etapa 2).
 *
 * Rămâne opțional în `creeazaAngajatSchema`, deci ecranul de editare și importul
 * în masă acceptă mai departe fișe incomplete — cele 11 din baza reală n-au
 * niciunul dintre câmpurile astea.
 */
const IDENTITATE: Readonly<Record<string, string>> = {
  // Numele intră aici, nu în teste separate: `superRefine` NU rulează dacă
  // obiectul de bază pică, iar un `first_name` lipsă ar fi făcut ca toate
  // regulile încrucișate de mai jos să pară „nedeclanșate" în loc de „netestate".
  first_name: "Ion",
  last_name: "Popescu",
  reges_tip_act: "CarteIdentitate",
  serie_act: "CJ",
  numar_act: "123456",
  act_eliberat_de: "SPCLEP Cluj-Napoca",
  act_eliberat_la: "2020-03-15",
  cnp: "1900101410011",
  adresa_strada: "Str. Exemplu 1",
  adresa_oras: "Cluj-Napoca",
  adresa_judet: "Cluj",
};

/**
 * Un singur punct de cast, deliberat.
 *
 * Testul hrănește EXACT ce trimite DOM-ul: șiruri goale pe câmpuri pe care
 * `InroleazaAngajatInput` le cere completate, și o valoare inventată pe un enum.
 * Dacă valorile ar trece de tip, n-ar mai reproduce defectul — resolver-ul
 * primește la rulare orice are formularul, nu ce promite tipul.
 */
async function valideaza(valori: Record<string, unknown>) {
  return zodResolver(inroleazaAngajatSchema)(valori as InroleazaAngajatInput, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  });
}

async function erorilePasului(
  valori: Record<string, unknown>,
  campuri: readonly string[],
): Promise<readonly string[]> {
  const rezultat = await valideaza(valori);
  // Exact ce face `trigger(names)`: validează tot, păstrează numele cerute.
  return Object.keys(rezultat.errors).filter((camp) => campuri.includes(camp));
}

/** O înrolare completă, exact cum arată formularul înainte de trimitere. */
const CONTRACT: Readonly<Record<string, string>> = {
  data_contract: "2026-08-28",
  valabil_de_la: "2026-08-31",
  hired_on: "2026-08-31",
  salariu_baza: "5000",
};

describe("poarta „Continuă”", () => {
  it("pasul 1 trece cu identitatea completată și restul controalelor goale", async () => {
    // Regresia: `stare_civila` pe „— Nespecificată —” bloca pasul, tăcut.
    const erori = await erorilePasului({ ...IMPLICITE, ...GOALE, ...IDENTITATE }, CAMPURI_PAS_1);
    expect(erori).toEqual([]);
  });

  it("pasul 2 cere adresa de domiciliu, restul rămâne opțional", async () => {
    const erori = await erorilePasului({ ...IMPLICITE, ...GOALE, ...IDENTITATE }, CAMPURI_PAS_2);
    expect(erori).toEqual([]);
  });

  it("pasul 3 trece cu „Regim special” pe „— Niciunul —”", async () => {
    // REGRESIA CENTRALĂ. Înainte, `special_regime: ""` pica, iar butonul părea
    // mort: fără mesaj, fără focus, fără schimbare de pas.
    const erori = await erorilePasului(
      { ...IMPLICITE, ...GOALE, ...IDENTITATE, ...CONTRACT },
      CAMPURI_PAS_3,
    );
    expect(erori).toEqual([]);
  });

  it("pasul 3 trece și cu numărul de contract GOL — se alocă automat", async () => {
    // 0098: câmpul e opțional, iar `public.aloca_numar_contract` îl completează
    // atomic la salvare. Rămas obligatoriu, alocarea automată n-ar fi fost
    // niciodată folosită.
    const erori = await erorilePasului(
      { ...IMPLICITE, ...GOALE, ...IDENTITATE, ...CONTRACT, numar: "" },
      CAMPURI_PAS_3,
    );
    expect(erori).toEqual([]);
  });

  it("„Regim special” ales explicit trece la fel de bine", async () => {
    const erori = await erorilePasului(
      { ...IMPLICITE, ...GOALE, ...IDENTITATE, ...CONTRACT, special_regime: "internship" },
      CAMPURI_PAS_3,
    );
    expect(erori).toEqual([]);
  });

  it("actul de identitate trebuie să se potrivească cu cetățenia", async () => {
    // Un cetățean român cu pașaport ca act de angajare, sau un străin cu carte
    // de identitate românească: amândouă ar fi ieșit abia la REGES, unde
    // `tipActIdentitate` e verificat de server.
    const strainCuCI = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      ...IDENTITATE,
      ...CONTRACT,
      cetatenie: "DE",
    });
    expect(strainCuCI.errors["reges_tip_act"]?.message).toBe(
      "Pentru un cetățean străin alegeți pașaportul, permisul de ședere sau cartea de rezidență.",
    );

    const romanCuPasaport = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      ...IDENTITATE,
      ...CONTRACT,
      reges_tip_act: "Pasaport",
    });
    expect(romanCuPasaport.errors["reges_tip_act"]?.message).toBe(
      "Pentru un cetățean român, actul de identitate este cartea sau buletinul.",
    );
  });

  it("seria e cerută pe actele românești, dar nu pe pașaport", async () => {
    const faraSerie = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      ...IDENTITATE,
      ...CONTRACT,
      serie_act: "",
    });
    expect(faraSerie.errors["serie_act"]?.message).toBe(
      "Seria actului de identitate este obligatorie.",
    );

    const pasaportStrain = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      ...IDENTITATE,
      ...CONTRACT,
      cetatenie: "DE",
      reges_tip_act: "Pasaport",
      serie_act: "",
    });
    expect(pasaportStrain.errors["serie_act"]).toBeUndefined();
  });

  it("vechimea în unitate nu poate începe la mai mult de un an în viitor", async () => {
    // Triggerul `tg_employees_validari` (0004_hr.sql:877) o respinge cu P0001;
    // `valabil_de_la`, din care se precompletează, NU are aceeași limită.
    const peste = new Date();
    peste.setFullYear(peste.getFullYear() + 2);
    const rezultat = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      ...IDENTITATE,
      ...CONTRACT,
      hired_on: peste.toISOString().slice(0, 10),
    });
    expect(rezultat.errors["hired_on"]?.message).toBe(
      "Vechimea în unitate nu poate începe la mai mult de un an în viitor.",
    );
  });

  it("o valoare străină de enum e tot respinsă, cu mesaj în română", async () => {
    // Poarta nu s-a lărgit: doar șirul gol a devenit acceptabil.
    const rezultat = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      ...IDENTITATE,
      special_regime: "inventat",
    });
    expect(rezultat.errors["special_regime"]?.message).toBe("Alegeți un regim special din listă.");
  });

  it("salariul gol spune „lipsește”, nu se scrie tăcut 0 RON", async () => {
    const rezultat = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      ...IDENTITATE,
      salariu_baza: "",
    });
    expect(rezultat.errors["salariu_baza"]?.message).toBe("Salariul de bază este obligatoriu.");
    expect(rezultat.values).toEqual({});
  });

  it("norma golită dă un mesaj în română, nu textul englezesc al lui zod", async () => {
    // `Number("") === 0` pica `min(0.5)` cu „Too small: expected number to be
    // >=0.5”, pe un câmp care nu randa nicio eroare.
    const rezultat = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      ...IDENTITATE,
      norma_ore_saptamana: "",
      norma_ore_zi: "",
    });
    // Golul revine la implicit, deci nici măcar nu mai e o eroare.
    expect(rezultat.errors["norma_ore_saptamana"]).toBeUndefined();
    expect(rezultat.errors["norma_ore_zi"]).toBeUndefined();
  });

  it("câmpurile chiar obligatorii rămân obligatorii", async () => {
    // `numar` NU mai e aici: din 0098 se alocă automat. `hired_on` a intrat:
    // fără el, adeverințele de vechime nu se mai pot emite deloc.
    const erori = await erorilePasului({ ...IMPLICITE, ...GOALE, ...IDENTITATE }, CAMPURI_PAS_3);
    expect([...erori].sort()).toEqual(
      ["data_contract", "hired_on", "salariu_baza", "valabil_de_la"].sort(),
    );
  });
});
