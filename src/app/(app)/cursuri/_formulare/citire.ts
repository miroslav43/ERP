// src/app/(app)/cursuri/_formulare/citire.ts
// Funcțiile care traduc ce a completat omul în obiectul trimis Server Action-ului.
//
// ── DE CE TRĂIESC AICI, ȘI NU ÎN COMPONENTE ─────────────────────────────────
// Modulul a fost livrat o dată MORT la scriere — material, versiune de fișier,
// atribuire și regulă eșuau întotdeauna — iar 1868 de teste au trecut peste el.
// Motivul e simplu și e singurul care contează: fixture-urile de test
// construiau obiectul de mână, cu `""` pe câmpurile absente, în timp ce
// componentele trimiteau `null`. Testul verifica un contract pe care nicio
// pagină nu-l folosea. „Poarta devine zgomot verde.”
//
// De aceea funcțiile astea sunt PURE, exportate și fără nicio dependență de
// React: testul le rulează pe un `FormData` construit ca în browser și dă
// rezultatul EXACT schemei pe care o va primi serverul. Dacă o componentă începe
// să trimită altceva, testul nu mai măsoară nimic — deci componenta n-are voie
// să construiască obiectul singură. `citire.test.ts` verifică și asta.
//
// Nu poartă `"use server"` și nu importă nimic din `actions.ts`: e un frate pur
// al componentelor client, importabil din ambele părți ale graniței.

import type { CursCriteriu } from "@/schemas/cursuri";

/**
 * `FormData.get()` pe un control randat întoarce ȘIRUL GOL când e golit,
 * niciodată `null` — `null` vine doar pentru un control absent din DOM.
 * Ambele trec prin `optional()` din `@/schemas/comun`, care le normalizează.
 */
const text = (date: FormData, cheie: string): string => String(date.get(cheie) ?? "");

/** Cheile sunt EXACT cele din `creeazaCursSchema`. */
export function citesteCurs(date: FormData) {
  return {
    cod: text(date, "cod"),
    denumire: text(date, "denumire"),
    descriere: text(date, "descriere"),
    obligatoriu: date.get("obligatoriu") === "on",
    valabilitate_luni: text(date, "valabilitate_luni"),
    termen_zile: text(date, "termen_zile"),
    prag_avertizare_zile: text(date, "prag_avertizare_zile"),
  };
}

/** Cheile sunt EXACT cele din `creeazaMaterialSchema`. */
export function citesteMaterial(date: FormData) {
  const procent = text(date, "procent_minim");
  const prag = text(date, "prag_test");
  return {
    cod: text(date, "cod"),
    titlu: text(date, "titlu"),
    descriere: text(date, "descriere"),
    fel: text(date, "fel") || "pdf",
    sursa: text(date, "sursa") || "fisier",
    treapta_dovada: text(date, "treapta_dovada") || "bifa",
    // `null` explicit când treapta nu cere câmpul — controlul nici nu e randat.
    procent_minim: procent === "" ? null : procent,
    prag_test: prag === "" ? null : prag,
    declaratie_text: text(date, "declaratie_text"),
    transcriere: text(date, "transcriere"),
  };
}

/**
 * Cheile sunt EXACT cele din `salveazaVersiuneFisierSchema`.
 *
 * Nu ia `FormData` singur: calea și numele fișierului vin din pasul de
 * încărcare, nu dintr-un control.
 */
export function citesteVersiuneFisier(
  date: FormData,
  incarcare: Readonly<{ materialId: string; cale: string; numeFisier: string; mime: string }>,
) {
  return {
    material_id: incarcare.materialId,
    cale: incarcare.cale,
    nume_fisier: incarcare.numeFisier,
    mime: incarcare.mime,
    subtitrare_cale: null,
    durata_secunde: text(date, "durata_secunde"),
    numar_pagini: text(date, "numar_pagini"),
    nota_versiune: text(date, "nota_versiune"),
  };
}

/** Cheile sunt EXACT cele din `salveazaVersiuneLinkSchema`. */
export function citesteVersiuneLink(date: FormData, materialId: string) {
  return {
    material_id: materialId,
    adresa: text(date, "adresa"),
    durata_secunde: text(date, "durata_secunde"),
    nota_versiune: text(date, "nota_versiune"),
  };
}

/**
 * Cheile sunt EXACT cele din `atribuieCursSchema`.
 *
 * Ecranul de atribuire nu are câmp de termen — fiecare înrolare îl moștenește
 * din curs. `null` spune „fără suprascriere", nu „fără termen".
 */
export function intrareAtribuire(input: Readonly<{ cursId: string; angajati: readonly string[] }>) {
  return { course_id: input.cursId, employee_ids: [...input.angajati], termen: null };
}

/**
 * Cheile sunt EXACT cele din `creeazaRegulaSchema`.
 *
 * Un singur criteriu pe regulă; celelalte patru ținte pleacă `null`. Oglinda
 * lui `course_assignment_rules_criteriu_ck`, care cere exact una completată.
 */
export function intrareRegula(
  input: Readonly<{ cursId: string; criteriu: CursCriteriu; tinta: string; decalaj: string }>,
) {
  const { criteriu, tinta } = input;
  return {
    course_id: input.cursId,
    criteriu,
    department_id: criteriu === "departament" ? tinta : null,
    job_position_id: criteriu === "functie" ? tinta : null,
    rol: criteriu === "rol" ? tinta : null,
    employee_id: criteriu === "angajat" ? tinta : null,
    decalaj_zile: input.decalaj,
    termen_zile: null,
  };
}
