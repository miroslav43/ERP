import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isPermissionKey } from "@/config/permissions";

import { ANGAJATI } from "./lume";
import { angajatiVizibili, poateAproba, poateCrea, ROLURI_DEMO } from "./roluri";

describe("rolurile demonstrației", () => {
  it("are exact trei roluri, fără super_admin", () => {
    expect(ROLURI_DEMO.map((r) => r.cheie)).toEqual(["org_admin", "manager", "employee"]);
  });

  it("administratorul vede toți angajații", () => {
    expect(angajatiVizibili("org_admin")).toHaveLength(ANGAJATI.length);
  });

  it("managerul vede strict mai puțin decât administratorul", () => {
    expect(angajatiVizibili("manager").length).toBeLessThan(ANGAJATI.length);
    expect(angajatiVizibili("manager").length).toBeGreaterThan(0);
  });

  it("angajatul se vede doar pe el", () => {
    expect(angajatiVizibili("employee")).toHaveLength(1);
  });

  it("angajatul NU poate aproba, managerul poate", () => {
    expect(poateAproba("employee")).toBe(false);
    expect(poateAproba("manager")).toBe(true);
    expect(poateAproba("org_admin")).toBe(true);
  });

  it("managerul NU poate crea cereri; angajatul și administratorul pot", () => {
    expect(poateCrea("manager")).toBe(false);
    expect(poateCrea("employee")).toBe(true);
    expect(poateCrea("org_admin")).toBe(true);
  });
});

/**
 * POARTA DE ADEVĂR. Mecanismul e copiat din `matrice-roluri.test.ts`, care
 * parsează aceeași migrare: sursa e seed-ul, nu `permissions.ts` (acolo stă doar
 * vocabularul). Fără poarta asta, comutatorul ar putea minți despre permisiuni
 * exact pe pagina unde izolarea e argumentul de vânzare.
 */
describe("comutatorul corespunde seed-ului din 0002_authz.sql", () => {
  const SEED = readFileSync("supabase/migrations/0002_authz.sql", "utf8");

  /** Are rolul `actiune` pe resursa `leave`, după seed? */
  function areInSeed(rol: string, actiune: string): boolean {
    for (const [, r, resursa, , actiuni] of SEED.matchAll(
      /\('(\w+)','([\w.]+)','(\w+)',\s*'\{([^}]*)\}'\)/g,
    )) {
      if (r !== rol || resursa !== "leave") continue;
      if ((actiuni ?? "").split(",").some((a) => a.trim() === actiune)) return true;
    }
    return false;
  }

  it("cheile despre care raționează comutatorul sunt chei reale", () => {
    for (const cheie of ["leave:read", "leave:create", "leave:approve"]) {
      expect(isPermissionKey(cheie)).toBe(true);
    }
  });

  it("`poateAproba` urmează seed-ul, nu o presupunere", () => {
    expect(poateAproba("manager")).toBe(areInSeed("manager", "approve"));
    expect(poateAproba("employee")).toBe(areInSeed("employee", "approve"));
  });

  it("`poateCrea` urmează seed-ul — managerul NU poate crea cereri", () => {
    expect(poateCrea("manager")).toBe(areInSeed("manager", "create"));
    expect(poateCrea("employee")).toBe(areInSeed("employee", "create"));
  });

  // `org_admin` nu se verifică prin `areInSeed`: primește permisiunile printr-un
  // produs cartezian separat (`from unnest(array[…]) r`, secțiunea „super_admin”/
  // „org_admin: all pe tot”), nu prin lista explicită de rânduri pe care o
  // parsează `areInSeed` mai sus — vezi `domeniulDinSeed` din
  // `matrice-roluri.test.ts`. Pentru el, `poateAproba` și `poateCrea` sunt
  // adevărate prin construcție, nu prin potrivire de regex.

  it("nu demonstrează `super_admin` — nu e rol de organizație", () => {
    expect(ROLURI_DEMO.map((r) => r.cheie)).not.toContain("super_admin");
  });
});
