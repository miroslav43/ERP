// src/domain/bani.test.ts
import { describe, expect, it } from "vitest";

import {
  ZERO_BANI,
  aduna,
  bani,
  celPutinZero,
  dinLei,
  fractieDin,
  imparte,
  inLei,
  inmulteste,
  laLeuIntreg,
  maxim,
  minim,
  rotunjesteLaBani,
  scade,
} from "./bani";

describe("rotunjirea — regula unică a aplicației", () => {
  it("2,675 se rotunjește la 2,68, nu la 2,67", () => {
    // Cazul care despărțea cele două formule istorice: `money.ts` dădea 2,68,
    // `calc.ts` dădea 2,67. În virgulă mobilă 2,675 e de fapt 2,67499999...
    expect(rotunjesteLaBani(2.675)).toBe(2.68);
    expect(dinLei(2.675)).toBe(268);
  });

  it("rotunjirea e simetrică față de zero", () => {
    // `Math.round(-0.5)` dă -0 în JavaScript: jumătățile merg spre plus infinit.
    // O reținere negativă trebuie tratată la fel ca una pozitivă.
    expect(dinLei(2.675)).toBe(268);
    expect(dinLei(-2.675)).toBe(-268);
    expect(dinLei(0.005)).toBe(1);
    expect(dinLei(-0.005)).toBe(-1);
  });

  it("nu e „half to even”", () => {
    // Rotunjirea bancherului ar da 2,68 și 2,68; cea aritmetică dă 2,68 și 2,69.
    expect(rotunjesteLaBani(2.685)).toBe(2.69);
    expect(rotunjesteLaBani(2.675)).toBe(2.68);
  });

  it("refuză valorile care nu sunt numere finite", () => {
    expect(() => dinLei(Number.NaN)).toThrow(RangeError);
    expect(() => dinLei(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("conversia lei ↔ bani", () => {
  it("dus-întors păstrează suma", () => {
    for (const lei of [0, 0.01, 1, 1234.56, 5000, 99999.99]) {
      expect(inLei(dinLei(lei))).toBe(lei);
    }
  });

  it("banii sunt întregi, deci fără eroare de reprezentare", () => {
    expect(dinLei(5000)).toBe(500000);
    expect(Number.isInteger(dinLei(1234.56))).toBe(true);
  });

  it("`bani()` refuză un neîntreg — altfel eroarea intră tăcut în sistem", () => {
    expect(() => bani(1.5)).toThrow(RangeError);
    expect(bani(268)).toBe(268);
  });
});

describe("aritmetica", () => {
  it("adunarea nu pierde bani, spre deosebire de virgula mobilă", () => {
    // 0,1 + 0,2 !== 0,3 în virgulă mobilă. În bani, 10 + 20 === 30, exact.
    expect(aduna(dinLei(0.1), dinLei(0.2))).toBe(dinLei(0.3));
    expect(inLei(aduna(dinLei(0.1), dinLei(0.2)))).toBe(0.3);
  });

  it("o sută de sume de un ban fac exact un leu", () => {
    const suta = Array.from({ length: 100 }, () => dinLei(0.01));
    expect(inLei(aduna(...suta))).toBe(1);
  });

  it("adunarea unei liste goale dă zero", () => {
    expect(aduna()).toBe(ZERO_BANI);
  });

  it("scăderea poate da negativ — o reținere depășește netul", () => {
    expect(inLei(scade(dinLei(100), dinLei(150)))).toBe(-50);
  });

  it("cota se aplică drept FRACȚIE, nu procent", () => {
    // 25% din 5238,10 = 1309,525 → 1309,53 (aritmetic, nu 1309,52).
    expect(inLei(fractieDin(dinLei(5238.1), 0.25))).toBe(1309.53);
  });

  it("CAPCANĂ: o RATĂ nu se materializează niciodată în bani", () => {
    // Tariful orar (salariu / (zile x ore)) NU e o sumă, e o rată. Rotunjit la
    // ban înainte de înmulțire, pierde precizie și rezultatul e mai mic:
    //   29,7619 -> 29,76 (rotunjit) -> x8 = 238,08 lei   GREȘIT
    //   5000 x (8 / 168)            ->      238,10 lei   CORECT
    // Pe un singur angajat sunt doi bani; pe o firmă cu 200 de oameni și 12
    // luni, e o diferență pe care contabilul o vede în balanță.
    const gresit = inmulteste(dinLei(29.7619), 8);
    const corect = inmulteste(dinLei(5000), 8 / (21 * 8));
    expect(inLei(gresit)).toBe(238.08);
    expect(inLei(corect)).toBe(238.1);
    expect(gresit).not.toBe(corect);
  });

  it("înmulțirea cu un factor fracționar rotunjește o singură dată, la final", () => {
    // 2 ore suplimentare cu spor 75%, la salariu 5000 și normă 21x8:
    // 5000 x (2 / 168) x 1,75 = 104,166... -> 104,17 lei.
    expect(inLei(inmulteste(dinLei(5000), (2 / (21 * 8)) * 1.75))).toBe(104.17);
  });

  it("împărțirea la zero e refuzată, nu produce Infinity", () => {
    expect(() => imparte(dinLei(5000), 0)).toThrow(RangeError);
  });

  it("salariul pe zi: 5000 lei / 21 de zile", () => {
    expect(inLei(imparte(dinLei(5000), 21))).toBe(238.1);
  });
});

describe("plafoane și limite", () => {
  it("maxim și minim aleg suma corectă", () => {
    expect(maxim(dinLei(10), dinLei(20))).toBe(dinLei(20));
    expect(minim(dinLei(10), dinLei(20))).toBe(dinLei(10));
    expect(maxim(dinLei(-10), dinLei(-20))).toBe(dinLei(-10));
  });

  it("celPutinZero taie negativul — baza de impozit nu coboară sub zero", () => {
    expect(celPutinZero(dinLei(-50))).toBe(ZERO_BANI);
    expect(celPutinZero(dinLei(50))).toBe(dinLei(50));
  });

  it("rotunjirea la leu întreg păstrează unitatea de măsură", () => {
    // Rezultatul rămâne în BANI, nu în lei — altfel s-ar împărți de două ori.
    expect(laLeuIntreg(dinLei(1234.56))).toBe(123500);
    expect(inLei(laLeuIntreg(dinLei(1234.56)))).toBe(1235);
    expect(inLei(laLeuIntreg(dinLei(1234.49)))).toBe(1234);
  });
});

describe("invariantul care contează pentru contabil", () => {
  it("suma coloanelor rotunjite închide cu totalul, la ban", () => {
    // Cu virgulă mobilă, fiecare coloană se rotunjește separat și suma lor
    // poate să difere de totalul rotunjit. În bani, egalitatea e exactă.
    const componente = [
      dinLei(5000),
      dinLei(238.1),
      dinLei(119.05),
      dinLei(59.52),
      dinLei(1250.33),
    ];
    const total = aduna(...componente);
    const sumaAfisata = componente.reduce((s, c) => s + inLei(c), 0);
    expect(inLei(total)).toBeCloseTo(sumaAfisata, 10);
    expect(Number.isInteger(total)).toBe(true);
  });
});
