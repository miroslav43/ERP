// src/domain/maintenance/proiectie.test.ts
import { describe, expect, it } from "vitest";

import { contorInvechit, proiectieScadentaContor, urmatoareaPeGrila } from "./proiectie";

const AZI = "2026-10-07";

describe("proiectieScadentaContor", () => {
  const citiri = [
    { data: "2026-09-07", citire: 1000 },
    { data: "2026-09-22", citire: 1150 },
    { data: "2026-10-07", citire: 1300 },
  ];

  it("ritmul din fereastră și ziua estimată: 10 unități/zi, 200 rămase ⇒ peste 20 de zile", () => {
    const p = proiectieScadentaContor(citiri, 1500, AZI);
    expect(p).not.toBeNull();
    expect(p?.ritmPeZi).toBeCloseTo(10, 5);
    expect(p?.zileRamase).toBe(20);
    expect(p?.dataEstimata).toBe("2026-10-27");
  });

  it("ținta deja atinsă: zile negative și fără dată estimată", () => {
    const p = proiectieScadentaContor(citiri, 1250, AZI);
    expect(p?.dataEstimata).toBeNull();
    expect(p?.zileRamase).toBeLessThan(0);
  });

  it("sub 3 citiri, sub 7 zile, contor care nu avansează sau fără țintă ⇒ null", () => {
    expect(proiectieScadentaContor(citiri.slice(1), 1500, AZI)).toBeNull();
    expect(
      proiectieScadentaContor(
        [
          { data: "2026-10-05", citire: 10 },
          { data: "2026-10-06", citire: 20 },
          { data: "2026-10-07", citire: 30 },
        ],
        100,
        AZI,
      ),
    ).toBeNull();
    expect(
      proiectieScadentaContor(
        citiri.map((c) => ({ ...c, citire: 1000 })),
        1500,
        AZI,
      ),
    ).toBeNull();
    expect(proiectieScadentaContor(citiri, null, AZI)).toBeNull();
  });

  it("citirile mai vechi de 90 de zile nu intră în ritm", () => {
    const cuVechi = [{ data: "2026-01-01", citire: 0 }, ...citiri];
    const p = proiectieScadentaContor(cuVechi, 1500, AZI);
    expect(p?.ritmPeZi).toBeCloseTo(10, 5);
  });

  it("ultima citire mai veche decât azi scade zilele rămase", () => {
    const vechi = citiri.map((c, i) => ({
      ...c,
      data: ["2026-08-28", "2026-09-12", "2026-09-27"][i] ?? c.data,
    }));
    const p = proiectieScadentaContor(vechi, 1500, AZI);
    // 200 rămase / 10 pe zi = 20 de zile de la 27 sept, adică 10 de la 7 oct.
    expect(p?.zileRamase).toBe(10);
    expect(p?.dataEstimata).toBe("2026-10-17");
  });
});

describe("contorInvechit", () => {
  it("fără citire e învechit; peste prag e învechit; la prag nu", () => {
    expect(contorInvechit(null, AZI, 30)).toBe(true);
    expect(contorInvechit("2026-09-01", AZI, 30)).toBe(true);
    expect(contorInvechit("2026-09-07", AZI, 30)).toBe(false);
  });
});

describe("urmatoareaPeGrila", () => {
  it("grila la 91 de zile din 1 ianuarie: a patra dată de pe grilă, prima ≥ 7 octombrie", () => {
    // 1 ian + 3 × 91 = 2 oct (< azi), deci următoarea e 1 ian + 4 × 91 = 31 dec.
    expect(urmatoareaPeGrila("2026-01-01", 91, AZI)).toBe("2026-12-31");
  });

  it("executată cu întârziere: sare la prima dată după execuție, fără instanțe restante", () => {
    // Grilă la 30 de zile din 1 ian; ultima execuție pe 20 sept (întârziată) ⇒
    // următoarea e prima dată de pe grilă strict după 20 sept și ≥ azi.
    expect(urmatoareaPeGrila("2026-01-01", 30, AZI, "2026-09-20")).toBe("2026-10-28");
  });

  it("ancoră în viitor: prima dată e chiar ancora", () => {
    expect(urmatoareaPeGrila("2026-11-15", 30, AZI)).toBe("2026-11-15");
  });

  it("ancoră azi, fără execuție: azi", () => {
    expect(urmatoareaPeGrila(AZI, 30, AZI)).toBe(AZI);
  });
});
