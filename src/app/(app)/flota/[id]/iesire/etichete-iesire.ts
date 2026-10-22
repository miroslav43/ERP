// src/app/(app)/flota/[id]/iesire/etichete-iesire.ts
//
// Etichetele ieșirii din parc (0218, F12h). Fără `"use client"`: le importă și
// pagina (server), și caseta (client). O constantă exportată dintr-un modul
// client și citită pe server devine un proxy care se stringifică (memoria
// „Constantă client importată în server”).
//
// Termenele REALE nu se calculează aici (Decizia 9): catalogul există o singură
// dată, în SQL. Caseta arată doar o descriere statică a ce se va crea.
import type { TonStare } from "@/components/ui/badge";
import type {
  DestinatieEpava,
  MotivRadiere,
  NaturaTermen,
  TipIesire,
} from "@/schemas/flota-iesire";

/** Opțiunile casetei. */
export const ETICHETE_TIP_IESIRE: Readonly<Record<TipIesire, string>> = {
  vanzare: "Vânzare",
  casare: "Casare (dezmembrare)",
  dauna_totala: "Daună totală",
  radiere: "Radiere din circulație",
  restituire_leasing: "Restituire la locator (leasing)",
};

export const ETICHETE_DESTINATIE_EPAVA: Readonly<Record<DestinatieEpava, string>> = {
  instrainata: "Epava s-a vândut",
  casata: "Epava s-a predat la dezmembrare",
};

export const ETICHETE_MOTIV_RADIERE: Readonly<Record<MotivRadiere, string>> = {
  export: "Scoatere din țară (export)",
  furt: "Furt",
  retragere_depozitare: "Retragere din circulație, la cerere",
};

/**
 * Pastila de pe fișă. Statusul intern rămâne `vandut`/`casat` (D1, I-h1), deci
 * pastila spune felul ieșirii, nu statusul: „Radiat — furt”, nu „Casat”.
 */
export function etichetaIesirii(
  tip: TipIesire,
  destinatie: DestinatieEpava | null,
  motivRadiere: MotivRadiere | null,
): string {
  switch (tip) {
    case "vanzare":
      return "Vândut";
    case "casare":
      return "Casat";
    case "dauna_totala":
      return destinatie === "instrainata"
        ? "Daună totală — epava înstrăinată"
        : "Daună totală — epava casată";
    case "radiere":
      if (motivRadiere === "export") return "Radiat — export";
      if (motivRadiere === "furt") return "Radiat — furt";
      return "Retras din circulație";
    case "restituire_leasing":
      return "Predat locatorului";
  }
}

/** Eticheta câmpului de dată: ce zi e „data ieșirii” pentru fiecare fel. */
export function etichetaDatei(tip: TipIesire, motivRadiere: MotivRadiere | null): string {
  switch (tip) {
    case "vanzare":
      return "Data vânzării";
    case "casare":
      return "Data predării la dezmembrare";
    case "dauna_totala":
      return "Data înstrăinării sau a predării epavei";
    case "radiere":
      if (motivRadiere === "export") return "Data scoaterii din țară";
      if (motivRadiere === "furt") return "Data declarării furtului";
      return "Data retragerii din circulație";
    case "restituire_leasing":
      return "Data procesului-verbal de predare către locator";
  }
}

/** Ce termene se vor crea, ca text static (Decizia 9). Cele reale apar pe fișă după salvare. */
export const DESCRIERE_TERMENE_PE_TIP: Readonly<Record<TipIesire, string>> = {
  vanzare:
    "Se vor crea: declarația de scoatere din evidență la primărie (30 de zile), notificarea asigurătorului RCA și denunțarea CASCO, dacă polițele sunt valabile (5 zile), verificarea transcrierii pe numele cumpărătorului (90 de zile) și, la cerere, păstrarea numărului.",
  casare:
    "Se vor crea: cererea de radiere și predarea plăcuțelor (30 de zile), denunțarea CASCO dacă e valabilă (5 zile) și, după ce bifați radierea, declarația la primărie (30 de zile de la radiere) și restituirea primei RCA.",
  dauna_totala:
    "Dacă epava s-a vândut, termenele sunt ca la vânzare; dacă s-a predat la dezmembrare, ca la casare.",
  radiere:
    "Se vor crea: cererea de radiere (30 de zile) și, după ce o bifați, declarația la primărie și restituirea primei RCA. La export și la retragere se adaugă predarea plăcuțelor; la furt, în locul lor se depune dovada furtului.",
  restituire_leasing:
    "Se vor crea: declarația fiscală la încetarea leasingului (30 de zile de la procesul-verbal) și notificarea asigurătorului RCA, dacă polița e valabilă (5 zile).",
};

/**
 * Nota de la vânzare (E18, Codul de procedură fiscală art. 159 alin. 5): o
 * condiție de DINAINTEA contractului, nu un termen de după el, deci doar text.
 */
export const NOTA_VANZARE =
  "Înainte de contract: impozitul pe anul vânzării se plătește, iar certificatul de atestare fiscală se obține de la primărie (nu e necesar dacă folosiți contractul-tip de înstrăinare).";

export const ETICHETE_NATURA_TERMEN: Readonly<Record<NaturaTermen, string>> = {
  legal: "Obligație legală",
  recomandat: "Recomandat",
};

export const TONURI_NATURA_TERMEN: Readonly<Record<NaturaTermen, TonStare>> = {
  legal: "atentie",
  recomandat: "neutru",
};
