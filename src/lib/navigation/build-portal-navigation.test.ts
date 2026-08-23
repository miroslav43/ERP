import { describe, expect, it } from "vitest";

import { FEATURE_KEYS } from "@/config/features";
import type { PermissionScope } from "@/config/permissions";

import { buildPortalNavigation } from "./build-portal-navigation";

/**
 * Matricea reală a rolului `employee`, copiată din seed — nu citită din bază,
 * ca testul să ruleze în CI fără Postgres. Surse: `0002_authz.sql:1206-1219`,
 * `0023_portal_angajat.sql:50-63`, `0046_ticketing_it_reguli.sql:207-209`.
 */
const ANGAJAT: ReadonlyMap<string, PermissionScope> = new Map([
  ["attendance:read", "own"],
  ["attendance:create", "own"],
  ["attendance:update", "own"],
  ["leave:read", "own"],
  ["leave:create", "own"],
  ["leave:update", "own"],
  ["leave:delete", "own"],
  ["per_diem:read", "own"],
  ["per_diem:create", "own"],
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

const TOATE: ReadonlySet<string> = new Set(FEATURE_KEYS);

/** Doar `nucleu` — cazul real al unei firme abia înrolate. */
const DOAR_NUCLEU: ReadonlySet<string> = new Set(["nucleu"]);

describe("buildPortalNavigation", () => {
  it("„Acasă” există în orice combinație de module, și e mereu prima", () => {
    for (const modulePornite of [TOATE, DOAR_NUCLEU, new Set<string>()]) {
      const { grupuri, bara } = buildPortalNavigation({
        features: modulePornite,
        permissions: ANGAJAT,
      });

      expect(grupuri[0]?.items[0]?.id, "primul element al primului grup").toBe("portal-acasa");
      expect(bara.primare[0]?.id, "primul slot al barei").toBe("portal-acasa");
    }
  });

  it("o firmă cu doar `nucleu` primește totuși un portal folosibil", () => {
    // Motivul pentru care „Acasă” are `featureKey: null`. `employee_portal` nu e
    // modul de nucleu, iar înrolarea activează doar nucleul — deci majoritatea
    // firmelor îl au stins. Dacă „Acasă” ar depinde de el, angajatul ar primi un
    // portal cu bara goală și niciun drum înainte.
    const { grupuri, bara } = buildPortalNavigation({
      features: DOAR_NUCLEU,
      permissions: ANGAJAT,
    });

    expect(bara.primare.map((i) => i.id)).toEqual(["portal-acasa"]);
    // „Echipa mea" (0070) are și ea `featureKey: "nucleu"`, deliberat: ierarhia
    // e din modulul de bază, iar angajatul e adus în portal de poarta de rol
    // indiferent dacă firma a activat `employee_portal`. Un portal cu DOUĂ
    // intrări e mai folosibil decât unul cu una singură.
    expect(bara.secundare.map((i) => i.id)).toEqual(["portal-echipa"]);
    expect(grupuri).toHaveLength(2);
  });

  it("cu toate modulele, bara are patru sloturi și restul trece în „Mai multe”", () => {
    const { bara } = buildPortalNavigation({ features: TOATE, permissions: ANGAJAT });

    expect(bara.primare).toHaveLength(4);
    expect(bara.primare.map((i) => i.id)).toEqual([
      "portal-acasa",
      "portal-pontaj",
      "portal-concedii",
      "portal-salariul",
    ]);
    expect(bara.secundare.map((i) => i.id)).toContain("portal-documente");
  });

  it("un modul stins promovează următoarea intrare în slotul rămas liber", () => {
    // Slotul nu e fix: dacă ar fi, cu `payroll` stins bara ar avea trei ținte și
    // un gol. Prioritatea îl umple cu următoarea intrare disponibilă.
    const faraSalarizare = new Set(TOATE);
    faraSalarizare.delete("payroll");

    const { bara } = buildPortalNavigation({
      features: faraSalarizare,
      permissions: ANGAJAT,
    });

    expect(bara.primare).toHaveLength(4);
    expect(bara.primare.map((i) => i.id)).not.toContain("portal-salariul");
    expect(bara.primare.map((i) => i.id)).toContain("portal-documente");
  });

  it("bara nu depășește niciodată patru sloturi principale", () => {
    const { bara } = buildPortalNavigation({ features: TOATE, permissions: ANGAJAT });
    expect(bara.primare.length).toBeLessThanOrEqual(4);
  });

  it("nicio intrare nu apare de două ori între primare și secundare", () => {
    const { bara } = buildPortalNavigation({ features: TOATE, permissions: ANGAJAT });
    const toate = [...bara.primare, ...bara.secundare].map((i) => i.id);
    expect(new Set(toate).size).toBe(toate.length);
  });

  it("pragul `minScope` se aplică, nu doar prezența cheii", () => {
    // `employees:read = none` e refuz explicit: „Documentele mele” dispare, deși
    // cheia există în hartă.
    const cuRefuz = new Map(ANGAJAT).set("employees:read", "none" as PermissionScope);
    const { bara, grupuri } = buildPortalNavigation({ features: TOATE, permissions: cuRefuz });

    const toate = [...bara.primare, ...bara.secundare, ...grupuri.flatMap((g) => g.items)];
    expect(toate.map((i) => i.id)).not.toContain("portal-documente");
  });

  it("numai „Acasă” cere potrivire exactă a căii", () => {
    const { grupuri } = buildPortalNavigation({ features: TOATE, permissions: ANGAJAT });
    const exacte = grupuri.flatMap((g) => g.items).filter((i) => i.exact);

    // `/portal` e prefix pentru toate celelalte rute: cu potrivire pe prefix ar
    // apărea activă pe fiecare ecran al portalului.
    expect(exacte.map((i) => i.id)).toEqual(["portal-acasa"]);
  });

  it("grupurile rămase fără intrări dispar", () => {
    const { grupuri } = buildPortalNavigation({
      features: DOAR_NUCLEU,
      permissions: ANGAJAT,
    });
    // „bani" dispare — nicio intrare a lui nu ține de nucleu. „munca" rămâne cu
    // «Acasă», iar „firma" cu «Echipa mea» (0070), amândouă de nucleu.
    expect(grupuri.map((g) => g.id)).toEqual(["munca", "firma"]);
  });
});
