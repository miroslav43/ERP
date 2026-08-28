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
  permis_tip: "",
  hired_on: "",
  valabil_pana: "",
  motiv_determinat: "",
  loc_munca: "",
  perioada_proba_zile: "",
  preaviz_zile: "",
  iban: "",
  banca: "",
  data_nasterii: "",
  serie_act: "",
  numar_act: "",
  act_eliberat_de: "",
  act_valabil_pana: "",
  tip_act_identitate: "",
  cnp: "",
  grad_handicap: "",
  email_personal: "",
  telefon: "",
  adresa_strada: "",
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

describe("poarta „Continuă”", () => {
  it("pasul 1 trece cu numele completate și restul controalelor goale", async () => {
    // Regresia: `stare_civila` pe „— Nespecificată —” bloca pasul, tăcut.
    const erori = await erorilePasului(
      { ...IMPLICITE, ...GOALE, first_name: "Ion", last_name: "Popescu" },
      CAMPURI_PAS_1,
    );
    expect(erori).toEqual([]);
  });

  it("pasul 2 trece cu toate câmpurile goale — niciunul nu e obligatoriu", async () => {
    const erori = await erorilePasului({ ...IMPLICITE, ...GOALE }, CAMPURI_PAS_2);
    expect(erori).toEqual([]);
  });

  it("pasul 3 trece cu „Regim special” pe „— Niciunul —”", async () => {
    // REGRESIA CENTRALĂ. Înainte, `special_regime: ""` pica, iar butonul părea
    // mort: fără mesaj, fără focus, fără schimbare de pas.
    const erori = await erorilePasului(
      {
        ...IMPLICITE,
        ...GOALE,
        numar: "1",
        data_contract: "2026-08-28",
        valabil_de_la: "2026-08-31",
        salariu_baza: "5000",
      },
      CAMPURI_PAS_3,
    );
    expect(erori).toEqual([]);
  });

  it("„Regim special” ales explicit trece la fel de bine", async () => {
    const erori = await erorilePasului(
      {
        ...IMPLICITE,
        ...GOALE,
        special_regime: "internship",
        numar: "1",
        data_contract: "2026-08-28",
        valabil_de_la: "2026-08-31",
        salariu_baza: "5000",
      },
      CAMPURI_PAS_3,
    );
    expect(erori).toEqual([]);
  });

  it("o valoare străină de enum e tot respinsă, cu mesaj în română", async () => {
    // Poarta nu s-a lărgit: doar șirul gol a devenit acceptabil.
    const rezultat = await valideaza({ ...IMPLICITE, ...GOALE, special_regime: "inventat" });
    expect(rezultat.errors["special_regime"]?.message).toBe("Alegeți un regim special din listă.");
  });

  it("salariul gol spune „lipsește”, nu se scrie tăcut 0 RON", async () => {
    const rezultat = await valideaza({ ...IMPLICITE, ...GOALE, salariu_baza: "" });
    expect(rezultat.errors["salariu_baza"]?.message).toBe("Salariul de bază este obligatoriu.");
    expect(rezultat.values).toEqual({});
  });

  it("norma golită dă un mesaj în română, nu textul englezesc al lui zod", async () => {
    // `Number("") === 0` pica `min(0.5)` cu „Too small: expected number to be
    // >=0.5”, pe un câmp care nu randa nicio eroare.
    const rezultat = await valideaza({
      ...IMPLICITE,
      ...GOALE,
      norma_ore_saptamana: "",
      norma_ore_zi: "",
    });
    // Golul revine la implicit, deci nici măcar nu mai e o eroare.
    expect(rezultat.errors["norma_ore_saptamana"]).toBeUndefined();
    expect(rezultat.errors["norma_ore_zi"]).toBeUndefined();
  });

  it("câmpurile chiar obligatorii rămân obligatorii", async () => {
    const erori = await erorilePasului({ ...IMPLICITE, ...GOALE }, CAMPURI_PAS_3);
    expect([...erori].sort()).toEqual(
      ["data_contract", "numar", "salariu_baza", "valabil_de_la"].sort(),
    );
  });
});
