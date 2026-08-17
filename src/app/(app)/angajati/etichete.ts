// src/app/(app)/angajati/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type { StatusAngajat } from "@/schemas/employee";

export const ETICHETE_STATUS: Readonly<Record<StatusAngajat, string>> = {
  candidat: "Candidat",
  activ: "Activ",
  suspendat: "Suspendat",
  preaviz: "În preaviz",
  incetat: "Contract încetat",
  arhivat: "Arhivat",
};

export const CLASE_STATUS: Readonly<Record<StatusAngajat, string>> = {
  candidat: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  activ: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50",
  suspendat: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50",
  preaviz: "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-50",
  incetat: "bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-50",
  arhivat: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
};

export const ETICHETE_CONTRACT: Readonly<Record<string, string>> = {
  proiect: "Proiect",
  activ: "Activ",
  suspendat: "Suspendat",
  incetat: "Încetat",
  anulat: "Anulat",
};

export const ETICHETE_MOD_LUCRU: Readonly<Record<string, string>> = {
  sediu: "La sediu",
  telemunca: "Telemuncă",
  domiciliu: "La domiciliu",
  mixt: "Mixt",
};
