import { describe, expect, it } from "vitest";

import {
  FACILITATE_SALARIU_MINIM,
  grilaDeducerePersonala,
  SETARI_SALARIZARE_PUBLICE as S,
  VERIFICARE,
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
    expect(valoare(1, 4325 + 530)).toBe(843); // +501..550 lei: 19,50% = 843,375, rotunjit la leu
    expect(valoare(4, 4325 + 1990)).toBe(1081); // +1.951..2.000 lei, 4+ persoane: 25%
    expect(valoare(0, 4325 + 1990)).toBe(0); // fără persoane, la capăt: 0%
    expect(valoare(0, 4325 + 2001)).toBe(0); // peste minim + 2.000: nu se acordă
    expect(valoare(7, 4325)).toBe(1946); // „4 și peste”: 45% = 1.946,25, rotunjit la leu
  });

  it("poarta: valorile au data verificării și sursele, iar contribuțiile se rotunjesc la leu", () => {
    expect(VERIFICARE.la).toBe("2026-10-03");
    expect(VERIFICARE.surse.length).toBeGreaterThanOrEqual(4);
    expect(S.rotunjireLei).toBe(true);
  });

  it("facilitatea de la salariul minim e cea pentru iulie–decembrie 2026", () => {
    expect(FACILITATE_SALARIU_MINIM).toEqual({
      suma: 200,
      plafonVenitBrut: 4600,
      valabilDeLa: "2026-07-01",
      valabilPana: "2026-12-31",
    });
  });
});

describe("data de expirare a valorilor", () => {
  it("pică după 31 decembrie 2026, ca valorile să fie reverificate înainte să mintă", () => {
    // Facilitatea de 200 de lei se aplică doar veniturilor din 2026 (OUG 89/2025
    // art. III alin. (6)); din 2027 calculatorul ar arăta un net prea mare la
    // salariul minim. Testul ăsta e alarma: când pică, se recitesc sursele.
    expect(new Date().toISOString().slice(0, 10) <= FACILITATE_SALARIU_MINIM.valabilPana).toBe(
      true,
    );
  });
});
