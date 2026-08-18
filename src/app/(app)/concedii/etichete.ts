// src/app/(app)/concedii/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type { PortiuneZi, StatusCerere, StatusSarcinaAprobare } from "@/schemas/leave";

export const ETICHETE_STATUS_CERERE: Readonly<Record<StatusCerere, string>> = {
  ciorna: "Ciornă",
  trimisa: "Trimisă",
  in_aprobare: "În aprobare",
  aprobata: "Aprobată",
  respinsa: "Respinsă",
  anulata: "Anulată",
  intrerupta: "Întreruptă",
};

export const CLASE_STATUS_CERERE: Readonly<Record<StatusCerere, string>> = {
  ciorna: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  trimisa: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50",
  in_aprobare: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50",
  aprobata: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50",
  respinsa: "bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-50",
  anulata: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  intrerupta: "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-50",
};

export const ETICHETE_STATUS_SARCINA: Readonly<Record<StatusSarcinaAprobare, string>> = {
  in_asteptare: "În așteptare",
  aprobata: "Aprobată",
  respinsa: "Respinsă",
  delegata: "Delegată",
  expirata: "Expirată",
  anulata: "Anulată",
};

export const ETICHETE_PORTIUNE: Readonly<Record<PortiuneZi, string>> = {
  zi_intreaga: "Zi întreagă",
  prima_jumatate: "Prima jumătate a zilei",
  a_doua_jumatate: "A doua jumătate a zilei",
};
