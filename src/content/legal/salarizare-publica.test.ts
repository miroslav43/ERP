import { describe, expect, it } from "vitest";

import { toBucharestDateString } from "@/lib/format/date";

import {
  FACILITATE_SALARIU_MINIM,
  grilaDeducerePersonala,
  PERIOADE_2026,
  perioadaPentruZi,
  SETARI_SALARIZARE_PUBLICE as S,
  valoriExpirate,
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
    expect(VERIFICARE.la).toBe("2026-10-09");
    expect(VERIFICARE.surse.map((s) => s.eticheta)).toContain(
      "HG 1506/2024 — salariul minim până la 30 iunie 2026",
    );
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

describe("cele două perioade ale lui 2026", () => {
  it("ianuarie–iunie: 4.050 lei (HG 1506/2024), 300 de lei scutiți, plafon 4.300", () => {
    const v = PERIOADE_2026["2026-1"];
    expect(v.salariuMinim).toBe(4050);
    expect(v.facilitate).toEqual({ suma: 300, plafonVenitBrut: 4300 });
    expect(v.setari.salariuMinimBrut).toBe(4050);
    // Primul prag al grilei: fără persoane, venit până la minim — 20% × 4.050 = 810.
    expect(v.setari.deducerePersonala[0]?.valoare).toBe(810);
    expect([v.oreLunaMedie, v.leiPeOra, v.actSalariuMinim]).toEqual([
      "165,334",
      "24,496",
      "HG 1506/2024",
    ]);
  });

  it("iulie–decembrie: 4.325 lei (HG 146/2026), 200 de lei, plafon 4.600 — aceleași setări ca până acum", () => {
    const v = PERIOADE_2026["2026-2"];
    expect(v.salariuMinim).toBe(4325);
    expect(v.facilitate).toEqual({ suma: 200, plafonVenitBrut: 4600 });
    expect(v.setari).toBe(S);
    expect([v.oreLunaMedie, v.leiPeOra, v.actSalariuMinim]).toEqual([
      "166,667",
      "25,949",
      "HG 146/2026",
    ]);
  });

  it("ziua alege perioada; după 31 decembrie 2026 valorile sunt expirate", () => {
    expect(perioadaPentruZi("2026-06-30")).toBe("2026-1");
    expect(perioadaPentruZi("2026-07-01")).toBe("2026-2");
    expect(perioadaPentruZi("2027-01-01")).toBe("2026-2");
    expect(valoriExpirate("2026-12-31")).toBe(false);
    expect(valoriExpirate("2027-01-01")).toBe(true);
  });

  it("ziua e cea din România: 30 iunie, 22:30 UTC, e deja 1 iulie la București", () => {
    expect(perioadaPentruZi(toBucharestDateString(new Date("2026-06-30T22:30:00Z")))).toBe(
      "2026-2",
    );
  });
});
