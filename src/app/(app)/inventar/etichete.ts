// src/app/(app)/inventar/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type { StareObiect, StatusObiect } from "@/schemas/inventory";

export const ETICHETE_STATUS: Readonly<Record<StatusObiect, string>> = {
  in_stoc: "În stoc",
  alocat: "Alocat",
  in_reparatie: "În reparație",
  casat: "Casat",
};

export const CLASE_STATUS: Readonly<Record<StatusObiect, string>> = {
  in_stoc: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50",
  alocat: "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-50",
  in_reparatie: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50",
  casat: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
};

export const ETICHETE_STARE: Readonly<Record<StareObiect, string>> = {
  nou: "Nou",
  bun: "Bun",
  uzat: "Uzat",
  defect: "Defect",
};

export const CLASE_STARE: Readonly<Record<StareObiect, string>> = {
  nou: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-50",
  bun: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50",
  uzat: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50",
  defect: "bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-50",
};
