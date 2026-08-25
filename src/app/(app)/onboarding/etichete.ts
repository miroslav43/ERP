// src/app/(app)/onboarding/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar
// funcții async.

import type { TonStare } from "@/components/ui/badge";
import type {
  ChecklistInstantaStatus,
  ChecklistItemStatus,
  ChecklistResponsabilTip,
  ChecklistTip,
  ChecklistTipDovada,
  RolResponsabil,
  ChecklistVerificare,
} from "@/schemas/checklist";

export const ETICHETE_TIP: Readonly<Record<ChecklistTip, string>> = {
  onboarding: "Integrare",
  offboarding: "Ieșire din organizație",
  transfer: "Transfer",
  altul: "Altul",
};

export const ETICHETE_STATUS_INSTANTA: Readonly<Record<ChecklistInstantaStatus, string>> = {
  in_curs: "În curs",
  finalizata: "Finalizată",
  anulata: "Anulată",
};

export const TONURI_STATUS_INSTANTA: Readonly<Record<ChecklistInstantaStatus, TonStare>> = {
  // „În curs” cere atenție, nu e o reușită: checklistul e deschis și are pași neterminați.
  in_curs: "atentie",
  finalizata: "succes",
  // Anulată = s-a încheiat fără urmări; nu e nici pericol, nici ciornă.
  anulata: "neutru",
};

export const ETICHETE_STATUS_ITEM: Readonly<Record<ChecklistItemStatus, string>> = {
  de_facut: "De făcut",
  in_lucru: "În lucru",
  bifat: "Bifat",
  neaplicabil: "Neaplicabil",
};

export const TONURI_STATUS_ITEM: Readonly<Record<ChecklistItemStatus, TonStare>> = {
  // Pasul există și nu s-a atins încă — ciornă, nu neutru: bulina goală spune exact asta.
  de_facut: "ciorna",
  // „În lucru” e început, dar nu terminat — atenție, nu succes.
  in_lucru: "atentie",
  bifat: "succes",
  // Neaplicabil = pas scos din calcul; nuanța veche de gri pe gri pica WCAG (4,46:1).
  neaplicabil: "neutru",
};

export const ETICHETE_TIP_DOVADA: Readonly<Record<ChecklistTipDovada, string>> = {
  niciuna: "Fără dovadă",
  bifa: "Bifă simplă",
  document: "Document justificativ",
  semnatura: "Semnătură",
};

/**
 * Selectorul afișa până acum valorile brute din enum („inventar_returnat").
 * Trei dintre cele patru sunt oricum de evitat: `acces_revocat` și
 * `documente_semnate` există în enum din 0014 dar n-au NICIO implementare —
 * un pas pus pe ele nu se bifează niciodată singur și, fiind obligatoriu prin
 * CHECK, face instanța imposibil de finalizat. Le numim ca atare.
 */
export const ETICHETE_VERIFICARE: Readonly<Record<ChecklistVerificare, string>> = {
  inventar_returnat: "Toate bunurile returnate",
  curs_finalizat: "Un curs a fost parcurs",
  acces_revocat: "Acces revocat (neimplementat)",
  documente_semnate: "Documente semnate (neimplementat)",
};

/** Care verificări chiar au un mecanism în spate. Restul se oferă dezactivate. */
export const VERIFICARI_IMPLEMENTATE: readonly ChecklistVerificare[] = [
  "inventar_returnat",
  "curs_finalizat",
];

export const ETICHETE_RESPONSABIL_TIP: Readonly<Record<ChecklistResponsabilTip, string>> = {
  rol: "Un rol anume",
  angajat: "Un angajat anume",
  manager_direct: "Managerul direct",
};

export const ETICHETE_ROL: Readonly<Record<RolResponsabil, string>> = {
  super_admin: "Administrator platformă",
  org_admin: "Administrator organizație",
  manager: "Manager",
  hr: "HR",
  employee: "Angajat",
};
