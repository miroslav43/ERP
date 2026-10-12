// src/domain/permisiuni/plafon-acordare.ts
//
// Cât poate acorda cineva prin suprascrierile per angajat.
//
// `roles:update = all` (administratorul firmei) poate oricum schimba rolul
// oricui, deci n-are plafon. `roles:update = team` (managerul) acordă doar pe
// subordonați și doar până la ce are EL pe aceeași cheie: altfel un manager fără
// `payroll:read` îi dădea subordonatului „Salarizare — Citire = Toată firma”, iar
// cu `employees:read = all` subordonatul vedea CNP-ul și IBAN-ul întregii firme.
// Creștere de drepturi prin interpus, exact ce exclude 0063 pentru `roles`.
//
// Aceeași regulă stă în bază (`role_permissions_insert` / `_update`, 0197),
// în acțiune (refuz cu mesaj) și pe ecran (opțiunile de peste plafon inactive).
// Modulul e PUR: îl folosesc și pagina de server, și acțiunea.
import { RANK, type PermissionScope } from "@/config/permissions";

/**
 * Cel mai larg scope pe care acordantul îl poate da pentru o cheie.
 *
 * @param scopeAcordare scope-ul acordantului pe `roles:update`
 * @param scopeAcordant scope-ul acordantului pe cheia acordată (`null` = n-o are)
 */
export function plafonulAcordarii(
  scopeAcordare: PermissionScope | null | undefined,
  scopeAcordant: PermissionScope | null | undefined,
): PermissionScope {
  if (scopeAcordare === "all") return "all";
  if (scopeAcordare !== "team") return "none";
  return scopeAcordant ?? "none";
}

/**
 * Refuzul explicit (`none`) încape mereu: restrânge un drept, nu-l crește.
 */
export function incapeInPlafon(scope: PermissionScope, plafon: PermissionScope): boolean {
  return scope === "none" || RANK[scope] <= RANK[plafon];
}
