// src/app/(app)/inventar/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type { TonStare } from "@/components/ui/badge";
import type { StareObiect, StatusObiect } from "@/schemas/inventory";

export const ETICHETE_STATUS: Readonly<Record<StatusObiect, string>> = {
  in_stoc: "În stoc",
  alocat: "Alocat",
  in_reparatie: "În reparație",
  casat: "Casat",
};

export const TONURI_STATUS: Readonly<Record<StatusObiect, TonStare>> = {
  in_stoc: "succes",
  // „Alocat” e o stare în curs, nu un succes: obiectul e la cineva și se așteaptă
  // înapoi. Același ton ca „În lucru” din ticketing.
  alocat: "atentie",
  in_reparatie: "atentie",
  casat: "neutru",
};

export const ETICHETE_STARE: Readonly<Record<StareObiect, string>> = {
  nou: "Nou",
  bun: "Bun",
  uzat: "Uzat",
  defect: "Defect",
};

export const TONURI_STARE: Readonly<Record<StareObiect, TonStare>> = {
  // „Nou” înseamnă neîntrebuințat, nu „în regulă” — dacă ar fi tot „succes”, s-ar
  // confunda cu „Bun”. Bulina goală a tonului „ciorna” spune exact „încă nefolosit”.
  nou: "ciorna",
  bun: "succes",
  uzat: "atentie",
  defect: "pericol",
};
