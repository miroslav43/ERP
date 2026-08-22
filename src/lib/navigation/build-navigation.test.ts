import { describe, expect, it } from "vitest";

import { FEATURE_KEYS } from "@/config/features";
import type { PermissionScope } from "@/config/permissions";

import { buildNavigation } from "./build-navigation";

/**
 * Testul care ține pragurile în viață.
 *
 * `NAV_ITEMS` declară pentru fiecare intrare un `minScope`, iar `esteVizibil` îl
 * ignora: verifica doar dacă cheia EXISTĂ în hartă. Diferența dintre „are cheia"
 * și „o are destul de larg" e exact rolul `employee`, care are `payroll:read`,
 * `employees:read`, `checklists:read` și `maintenance:read` — toate la `own`, deci
 * niciuna suficientă pentru intrările care cer `team` sau `all`. Rezultatul vizibil:
 * șase intrări de administrare în meniul unui angajat, fiecare ducând într-un
 * `AccesRestricționat`.
 *
 * Matricea de mai jos e copiată din seed, nu citită din bază: testul trebuie să
 * ruleze în CI fără Postgres. Sursele — `0002_authz.sql:1206-1219`, patch-ul
 * `0023_portal_angajat.sql:50-63` (care a mutat `employees:read` de la `none` la
 * `own`) și `0046_ticketing_it_reguli.sql:207-209` (modulul de tichete).
 */
const MATRICE_ANGAJAT: ReadonlyMap<string, PermissionScope> = new Map([
  ["attendance:read", "own"],
  ["attendance:create", "own"],
  ["attendance:update", "own"],
  ["leave:read", "own"],
  ["leave:create", "own"],
  ["leave:update", "own"],
  ["leave:delete", "own"],
  ["per_diem:read", "own"],
  ["per_diem:create", "own"],
  ["per_diem:update", "own"],
  ["per_diem:delete", "own"],
  ["payroll:read", "own"],
  ["payroll:export", "own"],
  ["tickets:read", "own"],
  ["tickets:create", "own"],
  ["tickets:update", "own"],
  ["inventory:read", "own"],
  ["checklists:read", "own"],
  ["checklists:update", "own"],
  ["ssm:read", "own"],
  ["announcements:read", "all"],
  ["maintenance:create", "all"],
  ["maintenance:read", "own"],
  ["users:read", "own"],
  ["employees:read", "own"],
]);

/** Toate modulele pornite — cazul cel mai permisiv, deci cel mai revelator. */
const TOATE_MODULELE: ReadonlySet<string> = new Set(FEATURE_KEYS);

function idurile(input: {
  features: ReadonlySet<string>;
  permissions: ReadonlyMap<string, PermissionScope>;
}): readonly string[] {
  return buildNavigation(input).flatMap((grup) => grup.items.map((item) => item.id));
}

describe("buildNavigation — pragul minScope", () => {
  it("angajatul nu vede intrările care cer `team` sau `all`, deși are cheia", () => {
    const vizibile = new Set(idurile({ features: TOATE_MODULELE, permissions: MATRICE_ANGAJAT }));

    // Fiecare pereche: intrarea, și pragul pe care angajatul nu-l atinge.
    const interzise: readonly (readonly [string, string])[] = [
      ["angajati", "employees:read cere team, are own"],
      ["evaluari", "employees:read cere team, are own"],
      ["onboarding", "checklists:read cere team, are own"],
      ["mentenanta", "maintenance:read cere team, are own"],
      ["salarizare", "payroll:read cere team, are own"],
      ["componente-salariale", "payroll:read cere team, are own"],
      ["flota", "vehicles:read — cheie absentă cu totul"],
      ["functii", "departments:read — cheie absentă cu totul"],
      ["rapoarte", "organizations:update cere all"],
      ["setari", "organizations:update cere all"],
      ["audit", "audit:read cere all"],
    ];

    for (const [id, motiv] of interzise) {
      expect(vizibile.has(id), `„${id}" nu are ce căuta în meniul unui angajat: ${motiv}`).toBe(
        false,
      );
    }
  });

  it("angajatul vede exact ce poate deschide", () => {
    const vizibile = new Set(idurile({ features: TOATE_MODULELE, permissions: MATRICE_ANGAJAT }));

    for (const id of [
      "dashboard", // permission: null — orice membru activ
      "pontaj",
      "concedii",
      "organigrama", // employees:read own — pragul e chiar `own`
      "ssm",
      "inventar",
      "anunturi",
      "ticketing",
      "diurna",
    ]) {
      expect(vizibile.has(id), `„${id}" ar trebui să fie vizibilă pentru angajat`).toBe(true);
    }
  });

  it("sub-intrarea cu prag mai strict decât părintele se filtrează separat", () => {
    const grupuri = buildNavigation({
      features: TOATE_MODULELE,
      permissions: MATRICE_ANGAJAT,
    });
    const ticketing = grupuri.flatMap((g) => g.items).find((i) => i.id === "ticketing");

    expect(ticketing, "intrarea `ticketing` ar trebui să fie vizibilă").toBeDefined();
    const idCopii = (ticketing?.children ?? []).map((c) => c.id);

    // `tickets:read = own` deschide părintele și „Tichetele mele", dar coada
    // cere `team`. Înainte de filtrarea copiilor, apărea și ea.
    expect(idCopii).toContain("ticketing-nou");
    expect(idCopii).not.toContain("ticketing-coada");
  });

  it("`scope = none` e refuz explicit, nu absența cheii", () => {
    const cuRefuz = new Map(MATRICE_ANGAJAT).set("announcements:read", "none" as PermissionScope);
    const vizibile = new Set(idurile({ features: TOATE_MODULELE, permissions: cuRefuz }));

    expect(vizibile.has("anunturi")).toBe(false);
  });

  it("modulul stins ascunde intrarea chiar dacă permisiunea trece", () => {
    const faraPontaj = new Set(TOATE_MODULELE);
    faraPontaj.delete("attendance");
    const vizibile = new Set(idurile({ features: faraPontaj, permissions: MATRICE_ANGAJAT }));

    expect(vizibile.has("pontaj")).toBe(false);
    expect(vizibile.has("concedii"), "restul rămâne neatins").toBe(true);
  });

  it("fără nicio permisiune rămâne doar ce nu cere niciuna", () => {
    const vizibile = idurile({ features: TOATE_MODULELE, permissions: new Map() });
    expect(vizibile).toEqual(["dashboard"]);
  });

  it("un grup rămas fără intrări dispare cu totul", () => {
    const grupuri = buildNavigation({ features: TOATE_MODULELE, permissions: new Map() });
    expect(grupuri.map((g) => g.id)).toEqual(["operatiuni"]);
  });
});
