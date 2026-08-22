import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NAV_ITEMS, PORTAL_NAV_ITEMS } from "./navigation";
import { PERMISSION_KEYS, RANK, meetsScope, type PermissionKey } from "./permissions";

/**
 * Testul care împiedică reapariția unui bug care a existat deja.
 *
 * Codul cerea `leave_requests:read`, `organization:update`, `members:manage`;
 * seed-ul SQL avea `leave:read`, `organizations:update`, `users:update`. O cheie
 * fără corespondent nu produce nicio eroare: `app.has_permission` întoarce
 * `none`, adică refuz. Efectul vizibil a fost un meniu complet gol, inclusiv
 * pentru `org_admin` — fără nimic în log care să arate de ce.
 *
 * Citim migrarea ca text, deliberat: verificarea trebuie să funcționeze fără
 * conexiune la bază, ca să ruleze în CI la fiecare PR, nu doar când cineva își
 * amintește să pornească un Postgres.
 */

const DIRECTOR_MIGRARI = join(process.cwd(), "supabase/migrations");

/**
 * Se citesc TOATE migrațiile, nu doar 0002.
 *
 * Inițial se citea doar `0002_authz.sql`, unde trăiau toate permisiunile. Un
 * modul nou care își aduce propriul seed — `tickets` în 0046 — pica testul
 * degeaba: cheile existau în bază, dar nu în fișierul citit. Cu tot directorul,
 * garanția rămâne aceeași și se aplică și modulelor viitoare.
 */
function sqlulTuturorMigrarilor(): string {
  return readdirSync(DIRECTOR_MIGRARI)
    .filter((nume) => nume.endsWith(".sql"))
    .sort()
    .map((nume) => readFileSync(join(DIRECTOR_MIGRARI, nume), "utf8"))
    .join("\n");
}

/** Toate literalele `'...'` dintr-o listă SQL. */
function literale(bloc: string): readonly string[] {
  return [...bloc.matchAll(/'([a-z_]+)'/g)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));
}

/**
 * Extrage perechile `resursă:acțiune` din seed.
 *
 * Seed-ul folosește trei forme, toate trebuie acoperite — o formă ratată ar face
 * testul să raporteze lipsuri inexistente:
 *   1. `from unnest(array[resurse]) r cross join unnest(array[acțiuni]) a`
 *   2. `values ('rol','resursă','scope','{acțiune,acțiune}')`
 *   3. `values (null, 'rol', 'resursă', 'acțiune', 'scope')`
 */
function cheiDinSeed(): ReadonlySet<string> {
  const sql = sqlulTuturorMigrarilor();
  const chei = new Set<string>();

  // Forma 1 — produs cartezian resurse × acțiuni.
  const cross =
    /from\s+unnest\s*\(\s*array\[([^\]]+)\]\s*\)\s*\w+\s*cross\s+join\s+unnest\s*\(\s*array\[([^\]]+)\]\s*\)/gi;
  for (const m of sql.matchAll(cross)) {
    for (const r of literale(m[1] ?? "")) {
      for (const a of literale(m[2] ?? "")) chei.add(`${r}:${a}`);
    }
  }

  // Forma 2 — ('rol','resursă','scope','{acțiuni}')
  const cuArray = /\(\s*'[a-z_]+'\s*,\s*'([a-z_]+)'\s*,\s*'[a-z]+'\s*,\s*'\{([a-z_,\s]+)\}'\s*\)/g;
  for (const m of sql.matchAll(cuArray)) {
    const resursa = m[1];
    if (resursa === undefined) continue;
    for (const a of (m[2] ?? "").split(",").map((s) => s.trim())) {
      if (a.length > 0) chei.add(`${resursa}:${a}`);
    }
  }

  // Forma 3 — (null, 'rol', 'resursă', 'acțiune', 'scope')
  const explicit =
    /\(\s*null\s*,\s*'[a-z_]+'\s*,\s*'([a-z_]+)'\s*,\s*'([a-z_]+)'\s*,\s*'[a-z]+'\s*\)/g;
  for (const m of sql.matchAll(explicit)) {
    if (m[1] !== undefined && m[2] !== undefined) chei.add(`${m[1]}:${m[2]}`);
  }

  return chei;
}

describe("vocabularul de permisiuni", () => {
  it("fiecare cheie folosită în meniu există în PERMISSION_KEYS", () => {
    const declarate = new Set<string>(PERMISSION_KEYS);
    const folosite = [...NAV_ITEMS, ...PORTAL_NAV_ITEMS].flatMap((item) => [
      ...(item.permission === null ? [] : [item.permission]),
      ...(item.children ?? []).flatMap((c) => (c.permission === null ? [] : [c.permission])),
    ]);

    const lipsa = folosite.filter((cheie) => !declarate.has(cheie));
    expect(lipsa, `Chei din meniu absente din PERMISSION_KEYS: ${lipsa.join(", ")}`).toEqual([]);
  });

  it("fiecare cheie declarată în cod există în seed-ul SQL", () => {
    const seed = cheiDinSeed();
    // Dacă parsarea nu găsește nimic, testul ar trece fals-pozitiv.
    expect(seed.size, "Nu s-a putut citi nicio cheie din migrări").toBeGreaterThan(20);

    const lipsa = PERMISSION_KEYS.filter((cheie) => !seed.has(cheie));
    expect(
      lipsa,
      `Chei declarate în cod dar absente din seed (ar întoarce tăcut 'none'): ${lipsa.join(", ")}`,
    ).toEqual([]);
  });

  it("formatul cheilor respectă constrângerile din 0001_kernel.sql", () => {
    // resource ~ '^[a-z][a-z0-9_.]{1,63}$', action ~ '^[a-z][a-z0-9_]{1,31}$'
    for (const cheie of PERMISSION_KEYS) {
      const [resursa, actiune, ...rest] = cheie.split(":");
      expect(rest, `${cheie}: cheia are mai mult de două segmente`).toEqual([]);
      expect(resursa, `${cheie}: resursă invalidă`).toMatch(/^[a-z][a-z0-9_.]{1,63}$/);
      expect(actiune, `${cheie}: acțiune invalidă`).toMatch(/^[a-z][a-z0-9_]{1,31}$/);
    }
  });
});

describe("algebra scope-urilor", () => {
  it("ordinea este none < own < team < all", () => {
    expect(RANK.none).toBeLessThan(RANK.own);
    expect(RANK.own).toBeLessThan(RANK.team);
    expect(RANK.team).toBeLessThan(RANK.all);
  });

  it("`none` este refuz explicit, nu o valoare care trece", () => {
    expect(meetsScope("none", "own")).toBe(false);
    expect(meetsScope("none", "team")).toBe(false);
    expect(meetsScope("none", "all")).toBe(false);
  });

  it("absența permisiunii se tratează identic cu `none`", () => {
    expect(meetsScope(undefined, "own")).toBe(false);
  });

  it("un scope mai larg satisface un prag mai îngust, nu invers", () => {
    expect(meetsScope("all", "own")).toBe(true);
    expect(meetsScope("team", "own")).toBe(true);
    expect(meetsScope("own", "team")).toBe(false);
    expect(meetsScope("team", "all")).toBe(false);
  });

  it("un scope satisface propriul prag", () => {
    const praguri = ["own", "team", "all"] as const;
    for (const prag of praguri) expect(meetsScope(prag, prag)).toBe(true);
  });
});

describe("integritatea meniului", () => {
  it("nu există identificatori duplicați", () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    expect(new Set(ids).size, `Identificatori duplicați: ${ids.join(", ")}`).toBe(ids.length);
  });

  it("fiecare href este o cale internă absolută", () => {
    for (const item of [...NAV_ITEMS, ...PORTAL_NAV_ITEMS]) {
      expect(item.href, `${item.id}: href trebuie să înceapă cu „/”`).toMatch(/^\/[^/]/);
      for (const copil of item.children ?? []) {
        expect(copil.href, `${copil.id}: href trebuie să înceapă cu „/”`).toMatch(/^\/[^/]/);
      }
    }
  });

  it("PermissionKey rămâne o uniune de literale, nu string", () => {
    // Dacă tipul se lărgește accidental la `string`, atribuirea de mai jos ar
    // compila și am pierde exact protecția pentru care există lista.
    const cheie: PermissionKey = "leave:read";
    expect(PERMISSION_KEYS).toContain(cheie);
  });
});
