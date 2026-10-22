// src/domain/fleet/contabil/configurare.ts
//
// Conturile și opțiunile exportului contabil al flotei (F12g).
//
// ── CONTURILE SUNT O PROPUNERE ⚠ ────────────────────────────────────────────
// Toate conturile de mai jos sunt ⚠ DE CONFIRMAT DE CONTABIL (decizia D9). Sunt
// punctul de plecare din planul general de conturi, OMFP 1802/2014, forma
// publicată de ANAF (https://static.anaf.ro/static/10/Anaf/legislatie/OMFP_1802_2014.pdf,
// citită pe 12 oct 2026, forma inițială; consolidarea curentă nu a fost căutată):
//   401 Furnizori · 4426 TVA deductibil · 5125 Sume în curs de decontare ·
//   5311 Casa în lei · 542 Avansuri de trezorerie · 6022 Cheltuieli privind
//   combustibilii · 6024 Cheltuieli privind piesele de schimb · 611 Cheltuieli
//   cu întreținerea și reparațiile · 628 Alte cheltuieli cu serviciile executate
//   de terți · 635 Cheltuieli cu alte impozite, taxe și vărsăminte asimilate ·
//   6588 Alte cheltuieli de exploatare.
//
// Nu sunt în bază (decizia D1, implicita I-g1): formularul le arată mereu, iar
// fiecare fișier scrie maparea folosită, deci nu există „conturi ascunse”.
import type { CategorieContabila, RegimDeducere } from "./linii";

/** „standard” = cota din `cote-tva.ts` la data documentului; „zero” = fără TVA. */
export type CoeficientTva = "standard" | "zero";

export type TratamentTvaNedeductibil = "pe_cheltuiala" | "cont_separat";

export interface ConfigurareExport {
  /** Contul de cheltuială (debit) al fiecărei categorii. */
  readonly conturi: Readonly<Record<CategorieContabila, string>>;
  /** Contul de decontare (credit) al tuturor articolelor. */
  readonly contDecontare: string;
  readonly contTvaDeductibil: string;
  /** Partea nedeductibilă a TVA-ului: pe contul cheltuielii sau pe un cont separat (L12). */
  readonly tvaNedeductibila: TratamentTvaNedeductibil;
  readonly contTvaNedeductibila: string;
  /** Regimul vehiculului fără regim declarat și cu masa sub prag (L11, D3). */
  readonly regimImplicit: RegimDeducere;
  /** Doar alimentările de pe foile aprobate intră în note (L6, D5). */
  readonly doarAprobate: boolean;
  /** Facturile de service intră și în note (L4, D2: implicit nu). */
  readonly includeService: boolean;
  readonly coeficientTva: Readonly<Record<CategorieContabila, CoeficientTva>>;
}

export const CONFIGURARE_IMPLICITA: ConfigurareExport = {
  conturi: {
    // „Cheltuieli privind combustibilii”.
    combustibil: "6022",
    // „Cheltuieli cu întreținerea și reparațiile”.
    revizie_reparatii: "611",
    // „Cheltuieli privind piesele de schimb”; unii contabili folosesc 6028 sau 611 ⚠.
    anvelope: "6024",
    // Reparația după daună; despăgubirile primite nu intră aici ⚠.
    daune: "611",
    // „Alte cheltuieli cu serviciile executate de terți” ⚠.
    parcare: "628",
    spalatorie: "628",
    // „Cheltuieli cu alte impozite, taxe…”; unii contabili folosesc 628 pentru peaj ⚠.
    taxe_drum: "635",
    // „Alte cheltuieli de exploatare”.
    altele: "6588",
  },
  // Avansuri de trezorerie: bonul plătit de șofer și decontat. Alternative în
  // formular: 5311, 5125, 401 ⚠.
  contDecontare: "542",
  contTvaDeductibil: "4426",
  tvaNedeductibila: "pe_cheltuiala",
  contTvaNedeductibila: "635",
  regimImplicit: "limitat_50",
  doarAprobate: true,
  includeService: false,
  // ⚠ Cota de TVA pe rovinietă și pe peaj NU a fost verificată: toate categoriile
  // pornesc de la cota standard, iar contabilul vede separarea în jurnal.
  coeficientTva: {
    combustibil: "standard",
    revizie_reparatii: "standard",
    anvelope: "standard",
    daune: "standard",
    parcare: "standard",
    spalatorie: "standard",
    taxe_drum: "standard",
    altele: "standard",
  },
};

/** Conturile de decontare propuse în formular, cu explicația lor. */
export const CONTURI_DECONTARE_PROPUSE: readonly Readonly<{ cont: string; eticheta: string }>[] = [
  { cont: "542", eticheta: "542 — Avansuri de trezorerie (decontul șoferului)" },
  { cont: "5311", eticheta: "5311 — Casa în lei" },
  { cont: "5125", eticheta: "5125 — Sume în curs de decontare (card bancar)" },
  { cont: "401", eticheta: "401 — Furnizori" },
];

/** Firma care exportă: CIF-ul intră în XML-ul Saga, iar `platitorTva` decide separarea TVA-ului. */
export interface FirmaExport {
  readonly denumire: string;
  /** Doar cifre (`organizations.cui_normalizat`). */
  readonly cui: string;
  /** Starea de AZI a firmei, nu cea istorică (avertisment în jurnal). */
  readonly platitorTva: boolean;
}
