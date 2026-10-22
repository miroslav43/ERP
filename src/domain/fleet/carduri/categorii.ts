// src/domain/fleet/carduri/categorii.ts
//
// Ce a cumpărat cardul, după numele produsului din extras. Doar `combustibil`
// cere o alimentare pe foaie; tot restul (taxe de drum, spălătorie, parcare,
// magazin) e `necombustibil` la potrivire.
//
// AdBlue NU e combustibil (F12b, Decizia pentru Miro 6, implicita (b)):
// `fuel_entries` n-are tip de produs, iar `consumLa100Km` adună toți litrii
// foii — litrii de AdBlue ar umfla consumul de motorină pe documentul semnat.
// Produsul necunoscut nu e nici el combustibil: n-ar trebui să ceară o
// alimentare pe foaie.

import { cheieCautare } from "@/lib/text/diacritice";

export const CATEGORII_TRANZACTIE = [
  "combustibil",
  "adblue",
  "taxa_drum",
  "spalatorie",
  "parcare",
  "magazin",
  "corectie",
  "altele",
] as const;
export type CategorieTranzactie = (typeof CATEGORII_TRANZACTIE)[number];

/** Valorile enum-ului `fuel_type` (0012) pe care le poate cumpăra un card. */
export type TipCombustibilCard = "benzina" | "motorina" | "gpl" | "gnc";

export type CategorieProdus = Readonly<{
  categorie: CategorieTranzactie;
  tipCombustibil: TipCombustibilCard | null;
}>;

type Regula = readonly [RegExp, CategorieTranzactie, TipCombustibilCard | null];

/**
 * Ordinea contează: AdBlue și taxele înaintea combustibililor („Diesel
 * AdBlue” e AdBlue), motorina înaintea benzinei („Super Diesel” e motorină).
 * Tiparele lucrează pe textul fără diacritice, cu litere mici.
 */
const REGULI: readonly Regula[] = [
  [/ad ?blue|\bdef\b|\barla\b/u, "adblue", null],
  [
    /rovinieta|vigneta|vignette|\btoll|\bpeaj|taxa pod|taxa de pod|\bmaut\b|\bpod\b/u,
    "taxa_drum",
    null,
  ],
  [/spalare|spalatorie|\bwash|waschanlage|autowash/u, "spalatorie", null],
  [/parcare|parking|parken/u, "parcare", null],
  [
    /motorina|diesel|eurodiesel|\bdsl\b|gasoil|gazole|v-?power diesel|maxxmotion diesel/u,
    "combustibil",
    "motorina",
  ],
  [/\bgpl\b|\blpg\b|autogas|autogaz/u, "combustibil", "gpl"],
  [/\bcng\b|\bgnc\b/u, "combustibil", "gnc"],
  [
    /benzina|unleaded|bleifrei|\bsuper\b|\bpremium\b|\b(?:95|98|100)\b|v-?power|maxxmotion|efix|\bron ?9[58]\b/u,
    "combustibil",
    "benzina",
  ],
  [/shop|magazin|\bmarfa\b|cafea|coffee|\bfood\b/u, "magazin", null],
];

export function categorieProdus(produs: string): CategorieProdus {
  const text = cheieCautare(produs).replace(/[_/]+/gu, " ").replace(/\s+/gu, " ").trim();
  for (const [tipar, categorie, tipCombustibil] of REGULI) {
    if (tipar.test(text)) return { categorie, tipCombustibil };
  }
  return { categorie: "altele", tipCombustibil: null };
}
