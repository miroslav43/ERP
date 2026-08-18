// src/domain/per-diem/ferestre.test.ts
import { describe, expect, it } from "vitest";
import { calculeazaZileDiurna, type ParametriiFerestre } from "./ferestre";
import type { PunctTara } from "./ore-pe-tara";

const RO = "11111111-1111-1111-1111-111111111111";
const DE = "22222222-2222-2222-2222-222222222222";
const AT = "33333333-3333-3333-3333-333333333333";

const FARA_BAREM = (): number | null => null;

const PARAMETRI_DE_BAZA: Omit<ParametriiFerestre, "plecare" | "sosire"> = {
  pragOreMinim: 12,
  pragOreZiIntreaga: 24,
  fractiuneZiPartiala: 0.5,
  acordaZiuaTrecerii: true,
  regulaTrecere: "tara_sosire",
  taraImplicitaId: RO,
  etape: [],
  cautaValoareBarem: FARA_BAREM,
};

describe("calculeazaZileDiurna", () => {
  it("nu acordă nimic sub pragul minim: 22:00 → 06:00 (8 ore) ⇒ 0 ferestre", () => {
    const ferestre = calculeazaZileDiurna({
      ...PARAMETRI_DE_BAZA,
      plecare: new Date("2026-03-10T22:00:00Z"),
      sosire: new Date("2026-03-11T06:00:00Z"),
    });
    expect(ferestre).toEqual([]);
  });

  it("72 de ore exact ⇒ 3 ferestre, toate cu fracțiunea 1.0", () => {
    const ferestre = calculeazaZileDiurna({
      ...PARAMETRI_DE_BAZA,
      plecare: new Date("2026-03-10T08:00:00Z"),
      sosire: new Date("2026-03-13T08:00:00Z"),
    });
    expect(ferestre).toHaveLength(3);
    expect(ferestre.map((f) => f.fractiune)).toEqual([1, 1, 1]);
    expect(ferestre.every((f) => f.taraId === RO)).toBe(true);
  });

  it("64 de ore (2 zile întregi + rest de 16h ≥ prag minim) ⇒ 1.0 + 1.0 + 0.5", () => {
    const ferestre = calculeazaZileDiurna({
      ...PARAMETRI_DE_BAZA,
      plecare: new Date("2026-03-10T08:00:00Z"),
      sosire: new Date("2026-03-13T00:00:00Z"),
    });
    expect(ferestre).toHaveLength(3);
    expect(ferestre.map((f) => f.fractiune)).toEqual([1, 1, 0.5]);
  });

  it("restul peste pragul de zi întreagă ⇒ ultima fereastră primește 1.0, nu fracțiunea parțială", () => {
    const ferestre = calculeazaZileDiurna({
      ...PARAMETRI_DE_BAZA,
      pragOreZiIntreaga: 18,
      plecare: new Date("2026-03-10T08:00:00Z"),
      // 44 ore = 1 fereastră întreagă (24h) + rest de 20h ≥ 18h.
      sosire: new Date("2026-03-12T04:00:00Z"),
    });
    expect(ferestre).toHaveLength(2);
    expect(ferestre.map((f) => f.fractiune)).toEqual([1, 1]);
  });

  it("sosirea nu e după plecare ⇒ listă goală", () => {
    const acelasiMoment = new Date("2026-03-10T08:00:00Z");
    expect(
      calculeazaZileDiurna({ ...PARAMETRI_DE_BAZA, plecare: acelasiMoment, sosire: acelasiMoment }),
    ).toEqual([]);
    expect(
      calculeazaZileDiurna({
        ...PARAMETRI_DE_BAZA,
        plecare: new Date("2026-03-10T08:00:00Z"),
        sosire: new Date("2026-03-09T08:00:00Z"),
      }),
    ).toEqual([]);
  });

  describe("trecerea frontierei", () => {
    const plecare = new Date("2026-03-10T00:00:00Z");
    const sosire = new Date("2026-03-11T00:00:00Z");
    const etape: readonly PunctTara[] = [
      { deLa: plecare, countryId: RO },
      { deLa: new Date("2026-03-10T14:00:00Z"), countryId: DE },
    ];

    it("cu acordaZiuaTrecerii=true, fereastra rămâne UNA, atribuită unei singure țări", () => {
      const ferestre = calculeazaZileDiurna({
        ...PARAMETRI_DE_BAZA,
        acordaZiuaTrecerii: true,
        regulaTrecere: "tara_sosire",
        plecare,
        sosire,
        etape,
      });
      expect(ferestre).toHaveLength(1);
      expect(ferestre[0]?.fractiune).toBe(1);
      // 'tara_sosire' = țara cu ultimul moment (DE, care ține până la sosire).
      expect(ferestre[0]?.taraId).toBe(DE);
      expect(ferestre[0]?.motiv).toContain("trecere de frontieră");
    });

    it("cu acordaZiuaTrecerii=false, fracțiunea zilei trecerii devine 0", () => {
      const ferestre = calculeazaZileDiurna({
        ...PARAMETRI_DE_BAZA,
        acordaZiuaTrecerii: false,
        plecare,
        sosire,
        etape,
      });
      expect(ferestre).toHaveLength(1);
      expect(ferestre[0]?.fractiune).toBe(0);
      expect(ferestre[0]?.motiv).toBe(
        "trecere de frontieră — politica firmei nu acordă diurnă în această zi",
      );
    });

    it("'tara_plecare' alege țara cu cel mai devreme moment din fereastră", () => {
      const ferestre = calculeazaZileDiurna({
        ...PARAMETRI_DE_BAZA,
        regulaTrecere: "tara_plecare",
        plecare,
        sosire,
        etape,
      });
      expect(ferestre[0]?.taraId).toBe(RO);
    });

    it("'durata_maxima' alege țara cu cele mai multe ore în fereastră", () => {
      // RO: 00:00–14:00 (14h) · DE: 14:00–24:00 (10h) ⇒ RO câștigă.
      const ferestre = calculeazaZileDiurna({
        ...PARAMETRI_DE_BAZA,
        regulaTrecere: "durata_maxima",
        plecare,
        sosire,
        etape,
      });
      expect(ferestre[0]?.taraId).toBe(RO);
    });

    it("'tara_cu_valoare_mai_mare' alege țara cu baremul mai mare", () => {
      const baremuri: Readonly<Record<string, number>> = { [RO]: 10, [DE]: 35 };
      const ferestre = calculeazaZileDiurna({
        ...PARAMETRI_DE_BAZA,
        regulaTrecere: "tara_cu_valoare_mai_mare",
        cautaValoareBarem: (countryId) => baremuri[countryId] ?? null,
        plecare,
        sosire,
        etape,
      });
      expect(ferestre[0]?.taraId).toBe(DE);
    });

    it("'tara_cu_valoare_mai_mare' fără barem departajează pe ore (nulls last)", () => {
      const ferestre = calculeazaZileDiurna({
        ...PARAMETRI_DE_BAZA,
        regulaTrecere: "tara_cu_valoare_mai_mare",
        cautaValoareBarem: FARA_BAREM,
        plecare,
        sosire,
        etape,
      });
      // Fără niciun barem, toate valorile sunt „egale” (lipsă) ⇒ tiebreak pe ore: RO (14h) > DE (10h).
      expect(ferestre[0]?.taraId).toBe(RO);
    });

    it("o singură țară în fereastră nu declanșează logica de trecere", () => {
      const ferestre = calculeazaZileDiurna({
        ...PARAMETRI_DE_BAZA,
        plecare,
        sosire,
        etape: [{ deLa: plecare, countryId: AT }],
      });
      expect(ferestre[0]?.taraId).toBe(AT);
      expect(ferestre[0]?.motiv).not.toContain("trecere de frontieră");
    });
  });
});
