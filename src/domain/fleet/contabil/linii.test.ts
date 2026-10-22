// src/domain/fleet/contabil/linii.test.ts
import { describe, expect, it } from "vitest";

import { Constants } from "@/types/database";

import {
  CATEGORIE_CHELTUIALA,
  CATEGORIE_SERVICE,
  DEDUCERE_DUPA_REGIM_FISCAL,
  regimDeclaratLa,
} from "./linii";

describe("cartografierile enum → categorie contabilă", () => {
  it("acoperă exact valorile din bază (o categorie nouă pică aici, nu într-o notă)", () => {
    const enumuri = Constants.public.Enums;
    expect(Object.keys(CATEGORIE_CHELTUIALA).sort()).toEqual(
      [...enumuri.vehicle_expense_category].sort(),
    );
    expect(Object.keys(CATEGORIE_SERVICE).sort()).toEqual([...enumuri.vehicle_service_type].sort());
    expect(Object.keys(DEDUCERE_DUPA_REGIM_FISCAL).sort()).toEqual(
      [...enumuri.vehicle_fiscal_regime].sort(),
    );
  });

  it("pod, TollRo și taxa de drum merg pe aceeași categorie; doar `limitat_50` limitează", () => {
    expect(CATEGORIE_CHELTUIALA.taxa_pod).toBe("taxe_drum");
    expect(CATEGORIE_CHELTUIALA.tollro).toBe("taxe_drum");
    expect(CATEGORIE_CHELTUIALA.combustibil_fara_foaie).toBe("combustibil");
    expect(CATEGORIE_SERVICE.dauna).toBe("daune");
    expect(
      Object.values(DEDUCERE_DUPA_REGIM_FISCAL).filter((r) => r === "limitat_50"),
    ).toHaveLength(1);
  });
});

describe("regimDeclaratLa", () => {
  const perioade = [
    { valabil_de_la: "2026-01-01", regim: "limitat_50" },
    { valabil_de_la: "2026-10-15", regim: "integral_exclusiv_economic" },
  ] as const;

  it("ultimul regim cu `valabil_de_la <= zi`, cu schimbarea la mijlocul lunii", () => {
    expect(regimDeclaratLa(perioade, "2026-10-14")).toBe("limitat_50");
    expect(regimDeclaratLa(perioade, "2026-10-15")).toBe("integral");
    expect(regimDeclaratLa(perioade, "2026-10-31")).toBe("integral");
  });

  it("înaintea primei perioade sau fără perioade: nedeclarat", () => {
    expect(regimDeclaratLa(perioade, "2025-12-31")).toBeNull();
    expect(regimDeclaratLa([], "2026-10-01")).toBeNull();
  });
});
