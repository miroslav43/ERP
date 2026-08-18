// src/app/(app)/onboarding/etichete.ts
// Etichete de interfață — separate de actions.ts, care poate exporta doar
// funcții async.

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

export const CLASE_STATUS_INSTANTA: Readonly<Record<ChecklistInstantaStatus, string>> = {
  in_curs: "bg-amber-100 text-amber-900",
  finalizata: "bg-emerald-100 text-emerald-900",
  anulata: "bg-zinc-200 text-zinc-800",
};

export const ETICHETE_STATUS_ITEM: Readonly<Record<ChecklistItemStatus, string>> = {
  de_facut: "De făcut",
  in_lucru: "În lucru",
  bifat: "Bifat",
  neaplicabil: "Neaplicabil",
};

export const CLASE_STATUS_ITEM: Readonly<Record<ChecklistItemStatus, string>> = {
  de_facut: "bg-zinc-200 text-zinc-800",
  in_lucru: "bg-blue-100 text-blue-900",
  bifat: "bg-emerald-100 text-emerald-900",
  neaplicabil: "bg-zinc-100 text-zinc-500",
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
