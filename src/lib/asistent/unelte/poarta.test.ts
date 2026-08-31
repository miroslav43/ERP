// src/lib/asistent/unelte/poarta.test.ts
/**
 * Poarta uneltelor e singurul loc din asistent unde un refuz trebuie să fie
 * IMPOSIBIL de ocolit, nu doar improbabil. Modelul poate cere orice; ce se
 * execută decide fișierul ăsta.
 */
import { describe, expect, it } from "vitest";

import type { FeatureKey } from "@/config/features";
import type { PermissionMap } from "@/lib/auth/permissions";

import { uneltelePermise, verificaAcces } from "./poarta";
import type { ContextUnealta, Unealta } from "./tip";

const unealta = (partial: Partial<Unealta> = {}): Unealta => ({
  nume: "test",
  descriere: "Unealtă de test.",
  parametri: {} as never,
  featureKey: null,
  permission: null,
  minScope: "own",
  executa: async () => ({ text: "" }),
  ...partial,
});

const context = (partial: Partial<ContextUnealta> = {}): ContextUnealta => ({
  organizationId: "org-1",
  memberId: "membru-1",
  role: "employee",
  employeeId: "fisa-1",
  numeUtilizator: "Ana Popescu",
  permisiuni: new Map() as PermissionMap,
  features: new Set<FeatureKey>(["nucleu", "leave", "attendance"]),
  aziISO: "2026-08-31",
  ...partial,
});

const harta = (intrari: Readonly<Record<string, "own" | "team" | "all">>): PermissionMap =>
  new Map(Object.entries(intrari)) as PermissionMap;

describe("verificaAcces", () => {
  it("lasă să treacă o unealtă fără modul și fără permisiune", () => {
    expect(verificaAcces(unealta(), context()).permis).toBe(true);
  });

  it("refuză când modulul e stins", () => {
    const acces = verificaAcces(
      unealta({ featureKey: "payroll" }),
      context({ features: new Set<FeatureKey>(["nucleu"]) }),
    );
    expect(acces.permis).toBe(false);
    expect(acces.permis ? "" : acces.motiv).toContain("modulul");
  });

  it("refuză când cheia de permisiune lipsește din hartă", () => {
    const acces = verificaAcces(
      unealta({ permission: "payroll:read", minScope: "all" }),
      context(),
    );
    expect(acces.permis).toBe(false);
  });

  it("refuză când scope-ul e sub pragul cerut", () => {
    const acces = verificaAcces(
      unealta({ permission: "employees:read", minScope: "all" }),
      context({ permisiuni: harta({ "employees:read": "team" }) }),
    );
    expect(acces.permis).toBe(false);
  });

  it("acceptă exact la prag", () => {
    const acces = verificaAcces(
      unealta({ permission: "employees:read", minScope: "team" }),
      context({ permisiuni: harta({ "employees:read": "team" }) }),
    );
    expect(acces.permis).toBe(true);
  });

  it("refuză o unealtă care cere fișă proprie unui cont fără fișă", () => {
    // Un `org_admin` care e doar administrator chiar nu are sold de concediu.
    const acces = verificaAcces(
      unealta({ cereFisaProprie: true }),
      context({ employeeId: null, role: "org_admin" }),
    );
    expect(acces.permis).toBe(false);
    expect(acces.permis ? "" : acces.motiv).toContain("fișă de angajat");
  });

  it("nu confundă `none` cu absența — ambele sunt refuz", () => {
    // `getPermissionMap` scoate deja `none` din hartă, fiindcă e refuz explicit.
    // Poarta nu compară niciodată direct cu „none”, tocmai ca absența să nu
    // treacă printr-o ramură scrisă pentru cealaltă.
    const absent = verificaAcces(unealta({ permission: "leave:read" }), context());
    expect(absent.permis).toBe(false);
  });
});

describe("uneltelePermise", () => {
  it("întoarce doar ce poate chema omul, păstrând ordinea", () => {
    const toate = [
      unealta({ nume: "libera" }),
      unealta({ nume: "salarizare", permission: "payroll:read", minScope: "all" }),
      unealta({ nume: "concedii", permission: "leave:read", minScope: "own" }),
    ];
    const permise = uneltelePermise(toate, context({ permisiuni: harta({ "leave:read": "own" }) }));
    expect(permise.map((u) => u.nume)).toEqual(["libera", "concedii"]);
  });

  it("poate întoarce lista goală", () => {
    const toate = [unealta({ permission: "payroll:read", minScope: "all" })];
    expect(uneltelePermise(toate, context())).toEqual([]);
  });
});
