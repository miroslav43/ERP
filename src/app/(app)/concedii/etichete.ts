// src/app/(app)/concedii/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type {
  CriteriuGrila,
  ModRotunjireAcumulare,
  PortiuneZi,
  StatusCerere,
  StatusSarcinaAprobare,
} from "@/schemas/leave";

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
  ciorna: "bg-slate-100 text-slate-800",
  trimisa: "bg-amber-100 text-amber-900",
  in_aprobare: "bg-amber-100 text-amber-900",
  aprobata: "bg-emerald-100 text-emerald-900",
  respinsa: "bg-rose-100 text-rose-900",
  anulata: "bg-zinc-200 text-zinc-800",
  intrerupta: "bg-orange-100 text-orange-900",
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

// ── Setări concedii ────────────────────────────────────────────────────────────

export const ETICHETE_MOD_ROTUNJIRE: Readonly<Record<ModRotunjireAcumulare, string>> = {
  fara_rotunjire: "Fără rotunjire",
  jumatate_in_sus: "La jumătate de zi, în sus",
  jumatate_in_jos: "La jumătate de zi, în jos",
  zi_in_sus: "La zi întreagă, în sus",
  zi_in_jos: "La zi întreagă, în jos",
  matematic: "Matematic (0,5 rotunjește în sus)",
};

export const ETICHETE_CRITERIU_GRILA: Readonly<Record<CriteriuGrila, string>> = {
  vechime: "Vechime în muncă",
  conditii_munca: "Condiții de muncă",
  grad_handicap: "Grad de handicap",
  varsta_sub_18: "Sub 18 ani",
  departament: "Departament",
  functie: "Funcție",
};

export const ETICHETE_VALOARE_CONDITII_MUNCA: Readonly<Record<string, string>> = {
  deosebite: "Condiții deosebite",
  speciale: "Condiții speciale",
};

export const ETICHETE_VALOARE_GRAD_HANDICAP: Readonly<Record<string, string>> = {
  accentuat: "Handicap accentuat",
  grav: "Handicap grav",
};
