// src/components/forms/filtreaza-caen.test.ts
import { describe, expect, it } from "vitest";
import { etichetaCaen, filtreazaCaen, rezolvaCaen } from "./selector-cod-caen";
import { NOMENCLATOR_CAEN } from "@/domain/organization/caen-nomenclator";

const GOL: ReadonlySet<string> = new Set();

describe("filtreazaCaen", () => {
  it("fără interogare, întoarce primele 20 din nomenclator", () => {
    const rezultat = filtreazaCaen("", GOL);
    expect(rezultat.length).toBe(20);
  });

  it("filtrează după prefixul codului", () => {
    const rezultat = filtreazaCaen("6210", GOL);
    expect(rezultat.some((c) => c.cod === "6210")).toBe(true);
    expect(rezultat.every((c) => c.cod.startsWith("6210"))).toBe(true);
  });

  it("filtrează după denumire, fără diacritice și case-insensitive", () => {
    const rezultat = filtreazaCaen("agricultura", GOL);
    expect(rezultat.length).toBeGreaterThan(0);
    expect(rezultat.every((c) => c.denumire.toLowerCase().includes("agricultur"))).toBe(true);
  });

  it("exclude codurile din setul `exclude`", () => {
    const rezultat = filtreazaCaen("6210", new Set(["6210"]));
    expect(rezultat.some((c) => c.cod === "6210")).toBe(false);
  });

  it("limitează rezultatele la 20", () => {
    const rezultat = filtreazaCaen("Activit", GOL);
    expect(rezultat.length).toBeLessThanOrEqual(20);
  });
});

describe("rezolvaCaen", () => {
  it("acceptă codul scris direct", () => {
    expect(rezolvaCaen("6210", GOL)?.cod).toBe("6210");
  });

  it("acceptă codul cu punct sau spațiu între grupe", () => {
    expect(rezolvaCaen("62.10", GOL)?.cod).toBe("6210");
    expect(rezolvaCaen("62 10", GOL)?.cod).toBe("6210");
  });

  it("acceptă eticheta completă rămasă în casetă", () => {
    const c = NOMENCLATOR_CAEN.find((x) => x.cod === "6210");
    expect(c).toBeDefined();
    expect(rezolvaCaen(etichetaCaen(c!), GOL)?.cod).toBe("6210");
  });

  it("ignoră spațiile din jur", () => {
    expect(rezolvaCaen("  6210  ", GOL)?.cod).toBe("6210");
  });

  it("respinge un cod inexistent în nomenclator", () => {
    expect(rezolvaCaen("9999", GOL)).toBeUndefined();
  });

  it("respinge un text care nu e cod și nu identifică o singură clasă", () => {
    expect(rezolvaCaen("cultivarea", GOL)).toBeUndefined();
    expect(rezolvaCaen("bla bla", GOL)).toBeUndefined();
    expect(rezolvaCaen("", GOL)).toBeUndefined();
  });

  it("acceptă denumirea scrisă complet, fără diacritice", () => {
    const c = NOMENCLATOR_CAEN.find((x) => x.cod === "0112");
    expect(c?.denumire).toBe("Cultivarea orezului");
    expect(rezolvaCaen("cultivarea orezului", GOL)?.cod).toBe("0112");
  });

  it("acceptă o căutare liberă cu un singur rezultat", () => {
    // „orezului” apare într-o singură denumire din nomenclator.
    const potriviri = NOMENCLATOR_CAEN.filter((c) => c.denumire.toLowerCase().includes("orezului"));
    expect(potriviri.length).toBe(1);
    expect(rezolvaCaen("orezului", GOL)?.cod).toBe(potriviri[0]!.cod);
  });
});
