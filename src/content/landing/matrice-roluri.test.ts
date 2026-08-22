import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isPermissionKey } from "@/config/permissions";

import { MATRICE, ROLURI_MATRICE, type Domeniu, type RolMatrice } from "./matrice-roluri";

const SEED = readFileSync("supabase/migrations/0002_authz.sql", "utf8");

/**
 * Recompune domeniul EFECTIV de citire din seed, respectând ordinea reală a
 * inserărilor. Contează, fiindcă fiecare `insert` se termină cu
 * `on conflict … do nothing`: rândul care ajunge PRIMUL câștigă. Produsul
 * cartezian al lui `org_admin` rulează înaintea listei explicite, de aceea
 * `organizations` și `features` sunt scoase din el în migrare — altfel refuzurile
 * lor n-ar mai fi intrat niciodată.
 */
function domeniulDinSeed(rol: RolMatrice, resursa: string): Domeniu {
  if (rol === "org_admin") {
    const cartezian = SEED.match(
      /'org_admin'::public\.app_role[\s\S]*?from unnest\(array\[([\s\S]*?)\]\) r/,
    );
    const resurse = [...(cartezian?.[1] ?? "").matchAll(/'([\w.]+)'/g)].map((m) => m[1]);
    if (resurse.includes(resursa)) return "all";
  }

  for (const [, r, res, scop, actiuni] of SEED.matchAll(
    /\('(\w+)','([\w.]+)','(\w+)',\s*'\{([^}]*)\}'\)/g,
  )) {
    if (r !== rol || res !== resursa) continue;
    if (!(actiuni ?? "").split(",").some((a) => a.trim() === "read")) continue;
    return scop as Domeniu;
  }

  // Absența rândului este REFUZ, nu implicit permisiv.
  return "none";
}

describe("matricea publicată corespunde bazei", () => {
  for (const rand of MATRICE) {
    for (const rol of ROLURI_MATRICE) {
      it(`${rand.resursa} × ${rol.cheie}`, () => {
        expect(rand.domenii[rol.cheie]).toBe(domeniulDinSeed(rol.cheie, rand.resursa));
      });
    }
  }

  it("fiecare resursă publicată are o cheie de permisiune reală", () => {
    for (const rand of MATRICE) {
      expect(isPermissionKey(`${rand.resursa}:read`)).toBe(true);
    }
  });

  it("nu publică `super_admin` — nu e rol de organizație", () => {
    expect(ROLURI_MATRICE.map((r) => r.cheie)).not.toContain("super_admin");
  });

  it("cele trei refuzuri care poartă argumentul sunt încă adevărate", () => {
    const de = (resursa: string) => MATRICE.find((r) => r.resursa === resursa)?.domenii;
    // Angajatul nu-și vede propria fișă în modulul de personal.
    expect(de("employees")?.employee).toBe("none");
    // Managerul nu are salarizare — refuz EXPLICIT în seed, nu absență.
    expect(de("payroll")?.manager).toBe("none");
    // HR administrează SSM, dar lista de scadențe îi întoarce zero rânduri.
    expect(de("ssm")?.hr).toBe("all");
    expect(de("compliance")?.hr).toBe("none");
  });

  it("jurnalul de audit nu poate fi șters de nimeni: nicio politică DELETE în produs", () => {
    const migrari = readFileSync("supabase/migrations/0002_authz.sql", "utf8");
    expect(/create\s+policy\s+\w+\s+on\s+public\.audit_logs\s+for\s+delete/i.test(migrari)).toBe(
      false,
    );
  });
});
