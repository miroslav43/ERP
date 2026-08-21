// src/components/forms/filtreaza-caen.test.ts
import { describe, expect, it } from "vitest";
import { filtreazaCaen } from "./selector-cod-caen";

describe("filtreazaCaen", () => {
  it("fără interogare, întoarce primele 20 din nomenclator", () => {
    const rezultat = filtreazaCaen("", new Set());
    expect(rezultat.length).toBe(20);
  });

  it("filtrează după prefixul codului", () => {
    const rezultat = filtreazaCaen("6210", new Set());
    expect(rezultat.some((c) => c.cod === "6210")).toBe(true);
    expect(rezultat.every((c) => c.cod.startsWith("6210"))).toBe(true);
  });

  it("filtrează după denumire, fără diacritice și case-insensitive", () => {
    const rezultat = filtreazaCaen("agricultura", new Set());
    expect(rezultat.length).toBeGreaterThan(0);
    expect(rezultat.every((c) => c.denumire.toLowerCase().includes("agricultur"))).toBe(true);
  });

  it("exclude codurile din setul `exclude`", () => {
    const rezultat = filtreazaCaen("6210", new Set(["6210"]));
    expect(rezultat.some((c) => c.cod === "6210")).toBe(false);
  });

  it("limitează rezultatele la 20", () => {
    const rezultat = filtreazaCaen("Activit", new Set());
    expect(rezultat.length).toBeLessThanOrEqual(20);
  });
});
