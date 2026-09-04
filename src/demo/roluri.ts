/**
 * Cele trei roluri demonstrate, și ce văd.
 *
 * ── DE CE E PARTEA CARE VINDE ─────────────────────────────────────────────
 * Orice produs din categorie SPUNE „roluri și permisiuni". Aici vizitatorul le
 * VEDE: același calendar, alți oameni pe el, alte butoane. Pentru un produs în
 * care izolarea E produsul, ăsta e argumentul.
 *
 * ── DE CE NU APARE `super_admin` ──────────────────────────────────────────
 * Nu e rol de organizație — sursa lui e `platform_admins`, niciodată
 * `organization_members`. Un comutator care i-ar arăta coloana i-ar spune unui
 * patron „furnizorul are un rol care vede tot". Aceeași decizie e luată deja în
 * `src/content/landing/matrice-roluri.ts`, din același motiv.
 *
 * ── CE E ADEVĂRAT AICI ────────────────────────────────────────────────────
 * `employee` are `leave:read = own` și `leave:create = own`; `manager` are
 * `leave:approve = team`, dar NU `leave:create` — poate citi și aproba cererile
 * echipei, nu poate depune el una. Sursa de adevăr rămâne seed-ul din
 * `0002_authz.sql`; testul păzește corespondența, pe tiparul lui
 * `matrice-roluri.test.ts`.
 */
import type { RandAngajatPlanificator } from "@/app/(app)/concedii/calendar/planificator-concedii";

import { ANGAJATI } from "./lume";

export type RolDemo = "org_admin" | "manager" | "employee";

export const ROLURI_DEMO: readonly Readonly<{ cheie: RolDemo; eticheta: string }>[] = [
  { cheie: "org_admin", eticheta: "Administrator" },
  { cheie: "manager", eticheta: "Manager" },
  { cheie: "employee", eticheta: "Angajat" },
];

/** Echipa managerului demonstrat: primii patru din lume. */
const ECHIPA_MANAGERULUI = ["d1", "d2", "d3", "d4"];

/** Angajatul care „e" vizitatorul, când comutatorul stă pe `employee`. */
const EU = "d1";

export function angajatiVizibili(rol: RolDemo): readonly RandAngajatPlanificator[] {
  switch (rol) {
    case "org_admin":
      return ANGAJATI;
    case "manager":
      return ANGAJATI.filter((a) => ECHIPA_MANAGERULUI.includes(a.id));
    case "employee":
      return ANGAJATI.filter((a) => a.id === EU);
  }
}

/** `leave:approve` există pentru manager (pe echipă) și administrator, nu pentru angajat. */
export function poateAproba(rol: RolDemo): boolean {
  return rol !== "employee";
}

/**
 * `leave:create` există pentru administrator și angajat, dar NU pentru manager.
 *
 * Seed-ul (`0002_authz.sql:1179`) dă managerului doar `{read,approve}` pe
 * `leave` — vede și aprobă cererile echipei, dar n-are cum să depună una a
 * lui prin acest rol. Angajatul (`:1208`) și administratorul (produsul
 * cartezian de la `:1162`) au `create`.
 */
export function poateCrea(rol: RolDemo): boolean {
  return rol !== "manager";
}
