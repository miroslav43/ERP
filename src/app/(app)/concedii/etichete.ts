// src/app/(app)/concedii/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar funcții async.

import type { TonStare } from "@/components/ui/badge";
import type {
  CriteriuGrila,
  ModRotunjireAcumulare,
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

/**
 * Tonul pastilei de stare — nu culoarea. Cuvântul din `ETICHETE_STATUS_CERERE`
 * poartă înțelesul; tonul doar îl repetă, pentru cine îl poate percepe.
 */
export const TONURI_STATUS_CERERE: Readonly<Record<StatusCerere, TonStare>> = {
  ciorna: "ciorna",
  // „Trimisă” și „În aprobare” așteaptă un răspuns de la altcineva: atenție, nu
  // succes — cererea încă nu i-a dat omului nimic.
  trimisa: "atentie",
  in_aprobare: "atentie",
  aprobata: "succes",
  respinsa: "pericol",
  anulata: "neutru",
  // Rechemarea din concediu e un eveniment care cere atenție, nu o încheiere
  // liniștită ca „Anulată” — de aceea nu e „neutru”.
  intrerupta: "atentie",
};

export const ETICHETE_STATUS_SARCINA: Readonly<Record<StatusSarcinaAprobare, string>> = {
  in_asteptare: "În așteptare",
  aprobata: "Aprobată",
  respinsa: "Respinsă",
  delegata: "Delegată",
  expirata: "Expirată",
  anulata: "Anulată",
};

/**
 * Pașii unui lanț de aprobare. „Expirată" e singura care primește pictogramă la
 * randare: altfel, pe o listă tipărită alb-negru, nu se distinge de „Respinsă".
 * Înainte, cele șase stări erau turtite într-un ternar cu trei ramuri scris în
 * pagină, iar `expirata` cădea pe ramura `else`, la egalitate cu „În așteptare".
 */
export const TONURI_STATUS_SARCINA: Readonly<Record<StatusSarcinaAprobare, TonStare>> = {
  in_asteptare: "atentie",
  aprobata: "succes",
  respinsa: "pericol",
  delegata: "atentie",
  expirata: "pericol",
  anulata: "neutru",
};

// ── Setări concedii ────────────────────────────────────────────────────────────

export const ETICHETE_MOD_ROTUNJIRE: Readonly<Record<ModRotunjireAcumulare, string>> = {
  fara_rotunjire: "Fără rotunjire",
  zi_in_sus: "La zi întreagă, în sus",
  zi_in_jos: "La zi întreagă, în jos",
  matematic: "Matematic (de la 0,5 în sus)",
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
