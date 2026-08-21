// src/domain/organization/caen-nomenclator.test.ts
import { describe, expect, it } from "vitest";
import { CODURI_CAEN_VALIDE, NOMENCLATOR_CAEN } from "./caen-nomenclator";

describe("NOMENCLATOR_CAEN", () => {
  it("conține exact 651 de clase (verificat împotriva PDF-ului oficial)", () => {
    expect(NOMENCLATOR_CAEN.length).toBe(651);
  });

  it("fiecare cod are exact 4 cifre și o denumire nevidă", () => {
    for (const clasa of NOMENCLATOR_CAEN) {
      expect(clasa.cod).toMatch(/^\d{4}$/);
      expect(clasa.denumire.length).toBeGreaterThan(0);
    }
  });

  it("nu conține coduri duplicate", () => {
    const coduri = NOMENCLATOR_CAEN.map((c) => c.cod);
    expect(new Set(coduri).size).toBe(coduri.length);
  });

  it("conține codurile interzise pentru SRL-D cu denumirea corectă", () => {
    const gasesteDenumire = (cod: string) =>
      NOMENCLATOR_CAEN.find((c) => c.cod === cod)?.denumire;

    expect(gasesteDenumire("9200")).toBe("Activităţi de jocuri de noroc şi pariuri");
    expect(gasesteDenumire("1105")).toBe("Fabricarea berii");
    expect(gasesteDenumire("6811")).toBe("Cumpărarea şi vânzarea de bunuri imobiliare proprii");
  });
});

describe("CODURI_CAEN_VALIDE", () => {
  it("conține exact aceleași coduri ca NOMENCLATOR_CAEN", () => {
    expect(CODURI_CAEN_VALIDE.size).toBe(NOMENCLATOR_CAEN.length);
    for (const clasa of NOMENCLATOR_CAEN) {
      expect(CODURI_CAEN_VALIDE.has(clasa.cod)).toBe(true);
    }
  });

  it("respinge un cod inexistent", () => {
    expect(CODURI_CAEN_VALIDE.has("0000")).toBe(false);
  });
});
