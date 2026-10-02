import { describe, expect, it } from "vitest";

import {
  grilaDeducerePersonala,
  SETARI_SALARIZARE_PUBLICE as S,
  SURSA,
} from "./salarizare-publica";

describe("valorile legale ale calculatorului public", () => {
  it("cotele sunt fracții, nu procente scrise ca 25", () => {
    for (const cota of [S.cotaCas, S.cotaCass, S.cotaImpozit, S.cotaCamAngajator]) {
      expect(cota).toBeGreaterThan(0);
      expect(cota).toBeLessThan(1);
    }
  });

  it("salariul minim e cel din HG 146/2026, în vigoare din 1 iulie 2026", () => {
    expect(S.salariuMinimBrut).toBe(4325);
  });

  it("grila deducerii reproduce celulele din tabelul art. 77 alin. (4)", () => {
    const g = grilaDeducerePersonala(4325);
    const valoare = (persoane: number, brut: number) =>
      [...g]
        .filter(
          (p) =>
            persoane >= p.nrPersoaneIntretinereMin &&
            (p.nrPersoaneIntretinereMax === null || persoane <= p.nrPersoaneIntretinereMax) &&
            brut <= p.venitBrutMax,
        )
        .sort((a, b) => a.venitBrutMax - b.venitBrutMax)[0]?.valoare ?? 0;
    expect(valoare(0, 4325)).toBe(865); // 20% din minim
    expect(valoare(1, 4325 + 530)).toBe(843.38); // +501..550 lei: 19,50%
    expect(valoare(4, 4325 + 1990)).toBe(1081.25); // +1.951..2.000 lei, 4+ persoane: 25%
    expect(valoare(0, 4325 + 1990)).toBe(0); // fără persoane, la capăt: 0%
    expect(valoare(0, 4325 + 2001)).toBe(0); // peste minim + 2.000: nu se acordă
    expect(valoare(7, 4325)).toBe(1946.25); // „4 și peste”: 45%
  });

  it("poarta: calculatorul nu se publică până nu confirmă contabilul", () => {
    expect(S.verificatDeContabil).toBe(false);
    expect(SURSA.length).toBeGreaterThan(10);
  });
});
