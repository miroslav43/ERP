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
// Inclusiv la RETRAGERE: „ca la rol” e și el un drept acordat — implicitul
// rolului —, deci trece prin același plafon (`poateReveniLaRol`).
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

/**
 * Ce ar avea membrul FĂRĂ suprascrierea lui, din rândurile de rol (fără
 * `member_id`) ale rolului lui: rândul organizației bate implicitul global —
 * aceeași precedență ca `app.has_permission` (0063) și
 * `app.implicitul_rolului_membrului` (0197). `null` = rolul nu dă nimic.
 */
export function implicitulRolului(
  randuri: readonly Readonly<{ organization_id: string | null; scope: PermissionScope }>[],
): PermissionScope | null {
  const alOrganizatiei = randuri.find((r) => r.organization_id !== null);
  if (alOrganizatiei !== undefined) return alOrganizatiei.scope;
  return randuri.find((r) => r.organization_id === null)?.scope ?? null;
}

/**
 * Retragerea unei suprascrieri („ca la rol”) NU e neutră: membrul cade pe
 * implicitul rolului. Un refuz explicit pus de administrator pe un `hr`
 * (`payroll:read = none`, rolul dă `all`), retras de un manager fără
 * salarizare, i-ar redeschide subordonatului toate salariile. Retragerea trece
 * deci doar dacă implicitul încape în plafon; un implicit care nu dă nimic
 * încape mereu.
 */
export function poateReveniLaRol(
  implicit: PermissionScope | null,
  plafon: PermissionScope,
): boolean {
  return incapeInPlafon(implicit ?? "none", plafon);
}
