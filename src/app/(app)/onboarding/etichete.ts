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
