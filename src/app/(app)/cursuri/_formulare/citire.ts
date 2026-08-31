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

/**
 * Cele trei feluri de material, ca o singură alegere.
 *
 * Felul și sursa merg împreună — un PDF vine mereu din fișier — iar asistentul
 * le cere ca pe un singur card. Traducerea în cele două coloane stă aici, ca
 * ecranul și testul să folosească exact aceeași funcție.
 */
export type FelAles = "pdf" | "video_fisier" | "video_link";

export const felDinAlegere = (ales: FelAles) =>
  ({
    pdf: { fel: "pdf" as const, sursa: "fisier" as const },
    video_fisier: { fel: "video" as const, sursa: "fisier" as const },
    video_link: { fel: "video" as const, sursa: "link" as const },
  })[ales];

export type StareMaterial = Readonly<{
  ales: FelAles;
  cod: string;
  titlu: string;
  descriere: string;
  treapta: "bifa" | "parcurgere" | "test" | "declaratie";
  procentMinim: string;
  pragTest: string;
  declaratieText: string;
  transcriere: string;
  faraVorbire: boolean;
}>;

/**
 * Cheile sunt EXACT cele din `creeazaMaterialSchema`.
 *
 * Câmpurile treptelor NEALESE pleacă `null`, nu absent: controlul nici măcar nu
 * e randat, iar `optional()` din `@/schemas/comun` normalizează toate cele trei
 * forme ale absenței. Aici a stat defectul care a ținut modulul mort.
 */
export function intrareMaterial(stare: StareMaterial) {
  const { fel, sursa } = felDinAlegere(stare.ales);
  return {
    cod: stare.cod,
    titlu: stare.titlu,
    descriere: stare.descriere,
    fel,
    sursa,
    treapta_dovada: stare.treapta,
    procent_minim: stare.treapta === "parcurgere" ? stare.procentMinim : null,
    prag_test: stare.treapta === "test" ? stare.pragTest : null,
    declaratie_text: stare.treapta === "declaratie" ? stare.declaratieText : "",
    // Bifa „filmul nu conține vorbire" scrie chiar propoziția în coloană: nu e
    // un substituent, e conținutul corect pentru cazul respectiv.
    transcriere: stare.faraVorbire ? "Filmul nu conține vorbire." : stare.transcriere,
  };
}

/**
 * Drumul invers al lui `felDinAlegere`, pentru ecranul de EDITARE.
 *
 * Cele trei valori acoperă exact combinațiile legale: `pdf` + `link` e respins
 * de `validareMaterial` („un document PDF se încarcă în aplicație"), deci nu
 * există a patra ramură de acoperit.
 */
export function alegereDinFel(fel: "pdf" | "video", sursa: "fisier" | "link"): FelAles {
  if (fel === "pdf") return "pdf";
  return sursa === "link" ? "video_link" : "video_fisier";
}

/** Cheile sunt EXACT cele din `actualizeazaMaterialSchema`. */
export function intrareActualizareMaterial(id: string, stare: StareMaterial) {
  return { id, ...intrareMaterial(stare) };
}

const TREPTE = ["bifa", "parcurgere", "test", "declaratie"] as const;

/**
 * Varianta pe `FormData` a actualizării.
 *
 * `ales` NU vine din formular, ci din props: felul și sursa sunt înghețate la
 * editare — versiunile deja încărcate depind de ele, iar baza nu apără asta
 * (`cursuri_protejeaza_catalogul` se uită doar la ștergere). Fiindcă valoarea
 * nici măcar nu e randată ca `<input type="hidden">`, nu există ce trimite
 * altfel: singurul drum până la acțiune trece pe aici.
 */
export function citesteMaterialEditat(date: FormData, id: string, ales: FelAles) {
  const trimisa = text(date, "treapta_dovada");
  const treapta = (TREPTE as readonly string[]).includes(trimisa)
    ? (trimisa as StareMaterial["treapta"])
    : "bifa";
  return intrareActualizareMaterial(id, {
    ales,
    cod: text(date, "cod"),
    titlu: text(date, "titlu"),
    descriere: text(date, "descriere"),
    treapta,
    procentMinim: text(date, "procent_minim"),
    pragTest: text(date, "prag_test"),
    declaratieText: text(date, "declaratie_text"),
    transcriere: text(date, "transcriere"),
    faraVorbire: date.get("fara_vorbire") === "on",
  });
}

export type Incarcare = Readonly<{
  materialId: string;
  cale: string;
  numeFisier: string;
  mime: string;
}>;

/**
 * Cheile sunt EXACT cele din `salveazaVersiuneFisierSchema`.
 *
 * Forma de bază e cea pe STARE, nu pe `FormData`: asistentul n-are formular la
 * pasul de conținut, are stare React. Varianta pe `FormData` de mai jos e un
 * înveliș peste ea, ca cele două drumuri — asistentul și pagina materialului —
 * să nu poată trimite lucruri diferite.
 */
export function intrareVersiuneFisier(
  incarcare: Incarcare,
  campuri: Readonly<{ durata: string; numarPagini: string; nota: string }>,
) {
  return {
    material_id: incarcare.materialId,
    cale: incarcare.cale,
    nume_fisier: incarcare.numeFisier,
    mime: incarcare.mime,
    subtitrare_cale: null,
    durata_secunde: campuri.durata,
    numar_pagini: campuri.numarPagini,
    nota_versiune: campuri.nota,
  };
}

export function citesteVersiuneFisier(date: FormData, incarcare: Incarcare) {
  return intrareVersiuneFisier(incarcare, {
    durata: text(date, "durata_secunde"),
    numarPagini: text(date, "numar_pagini"),
    nota: text(date, "nota_versiune"),
  });
}

/** Cheile sunt EXACT cele din `salveazaVersiuneLinkSchema`. */
export function intrareVersiuneLink(
  materialId: string,
  campuri: Readonly<{ adresa: string; durata: string; nota: string }>,
) {
  return {
    material_id: materialId,
    adresa: campuri.adresa,
    durata_secunde: campuri.durata,
    nota_versiune: campuri.nota,
  };
}

export function citesteVersiuneLink(date: FormData, materialId: string) {
  return intrareVersiuneLink(materialId, {
    adresa: text(date, "adresa"),
    durata: text(date, "durata_secunde"),
    nota: text(date, "nota_versiune"),
  });
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
    cod_cor: criteriu === "functie" ? tinta : null,
    rol: criteriu === "rol" ? tinta : null,
    employee_id: criteriu === "angajat" ? tinta : null,
    decalaj_zile: input.decalaj,
    termen_zile: null,
  };
}
