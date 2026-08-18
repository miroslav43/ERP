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
  candidat: "bg-slate-100 text-slate-800",
  activ: "bg-emerald-100 text-emerald-900",
  suspendat: "bg-amber-100 text-amber-900",
  preaviz: "bg-orange-100 text-orange-900",
  incetat: "bg-rose-100 text-rose-900",
  arhivat: "bg-zinc-200 text-zinc-800",
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
