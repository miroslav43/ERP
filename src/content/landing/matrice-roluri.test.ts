import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isPermissionKey } from "@/config/permissions";

import { MATRICE, ROLURI_MATRICE, type Domeniu, type RolMatrice } from "./matrice-roluri";

const SEED = readFileSync("supabase/migrations/0002_authz.sql", "utf8");

/**
 * Migrările de DUPĂ seed, în ordinea aplicării. Un drept mutat ulterior — cum a
 * mutat `0023_portal_angajat.sql` fișele angajatului de la `none` la `own` — nu
 * se vede în `0002`. Până la 7 oct 2026 testul citea doar seed-ul, iar pagina
 * publica „—" acolo unde baza spunea `own` de luni de zile.
 */
const ULTERIOARE = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql") && f > "0002_authz.sql")
  .sort()
  .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"));

/** Ultimul `update … set scope` global pe `read`, dacă vreo migrare ulterioară îl mută. */
function suprascriere(rol: RolMatrice, resursa: string): Domeniu | undefined {
  let gasit: Domeniu | undefined;
  for (const sql of ULTERIOARE) {
    for (const [, scop, r, res] of sql.matchAll(
      /update\s+public\.role_permissions\s+set\s+scope\s*=\s*'(\w+)'[^;]*?where\s+role\s*=\s*'(\w+)'\s+and\s+resource\s*=\s*'([\w.]+)'\s+and\s+action\s*=\s*'read'[^;]*?organization_id\s+is\s+null/gi,
    )) {
      if (r === rol && res === resursa) gasit = scop as Domeniu;
    }
  }
  return gasit;
}

/**
 * Recompune domeniul EFECTIV de citire din seed, respectând ordinea reală a
 * inserărilor. Contează, fiindcă fiecare `insert` se termină cu
 * `on conflict … do nothing`: rândul care ajunge PRIMUL câștigă. Produsul
 * cartezian al lui `org_admin` rulează înaintea listei explicite, de aceea
 * `organizations` și `features` sunt scoase din el în migrare — altfel refuzurile
 * lor n-ar mai fi intrat niciodată.
 */
function domeniulDinSeed(rol: RolMatrice, resursa: string): Domeniu {
  const mutat = suprascriere(rol, resursa);
  if (mutat !== undefined) return mutat;

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

  it("limitele care poartă argumentul sunt încă adevărate", () => {
    const de = (resursa: string) => MATRICE.find((r) => r.resursa === resursa)?.domenii;
    // Angajatul își vede DOAR propria fișă (0023) — `own`, nu `all`, deci CNP-ul
    // și IBAN-ul rămân închise: `hr_read_sensitive` cere `= 'all'` exact.
    expect(de("employees")?.employee).toBe("own");
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
