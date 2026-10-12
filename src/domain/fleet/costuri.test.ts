import { describe, expect, it } from "vitest";

import {
  consumRealPerioada,
  costPeKm,
  costTotal,
  dataDeLaLuni,
  defalcarePeCategorii,
  sumaLei,
} from "./costuri";

describe("sumaLei", () => {
  it("adună în bani, nu în virgulă mobilă", () => {
    // 0,1 + 0,2 = 0,30000000000000004 în virgulă mobilă; pe ecran trebuie 0,30.
    expect(sumaLei([0.1, 0.2])).toBe(0.3);
    expect(sumaLei([300.5, 15, 28.5])).toBe(344);
  });

  it("ignoră valorile lipsă, nu le numără ca zero greșit", () => {
    expect(sumaLei([null, 10, undefined, 5.25])).toBe(15.25);
    expect(sumaLei([])).toBe(0);
  });
});

describe("costTotal", () => {
  it("adună cele patru părți: service, combustibil de pe foi, cheltuieli, documente", () => {
    expect(
      costTotal({ service: 750, combustibilFoi: 1200.4, cheltuieli: 344, documente: 1800 }),
    ).toBe(4094.4);
  });

  it("o parte lipsă e zero, nu rupe totalul", () => {
    expect(costTotal({ service: 0, combustibilFoi: 0, cheltuieli: 0, documente: 0 })).toBe(0);
  });
});

describe("costPeKm", () => {
  it("împarte costul la kilometri, rotunjit la bani", () => {
    expect(costPeKm(4094.4, 8000)).toBe(0.51);
    expect(costPeKm(1000, 3)).toBe(333.33);
  });

  it("fără kilometri nu există cifră: null, nu Infinity și nu 0", () => {
    expect(costPeKm(500, null)).toBeNull();
    expect(costPeKm(500, 0)).toBeNull();
    expect(costPeKm(500, -10)).toBeNull();
  });
});

describe("consumRealPerioada", () => {
  it("litri la 100 km din foile aprobate", () => {
    expect(consumRealPerioada(470, 5000)).toBeCloseTo(9.4, 5);
  });

  it("aceeași regulă ca pe foaie: fără kilometri sau fără litri, nimic", () => {
    expect(consumRealPerioada(470, null)).toBeNull();
    expect(consumRealPerioada(0, 5000)).toBeNull();
  });
});

describe("defalcarePeCategorii", () => {
  it("însumează pe categorie și ordonează descrescător după sumă", () => {
    const randuri = [
      { categorie: "parcare", suma: 15 },
      { categorie: "taxa_drum", suma: 28.5 },
      { categorie: "parcare", suma: 20 },
      { categorie: "tollro", suma: 100 },
    ] as const;
    expect(defalcarePeCategorii(randuri)).toEqual([
      { categorie: "tollro", suma: 100, numar: 1 },
      { categorie: "parcare", suma: 35, numar: 2 },
      { categorie: "taxa_drum", suma: 28.5, numar: 1 },
    ]);
  });

  it("la sumă egală păstrează ordinea alfabetică, ca ecranul să nu sară între reîncărcări", () => {
    const randuri = [
      { categorie: "spalatorie", suma: 10 },
      { categorie: "parcare", suma: 10 },
    ] as const;
    expect(defalcarePeCategorii(randuri).map((r) => r.categorie)).toEqual([
      "parcare",
      "spalatorie",
    ]);
  });

  it("listă goală, defalcare goală", () => {
    expect(defalcarePeCategorii([])).toEqual([]);
  });
});

describe("dataDeLaLuni", () => {
  it("scade lunile din ziua dată", () => {
    expect(dataDeLaLuni("2026-10-12", 3)).toBe("2026-07-12");
    expect(dataDeLaLuni("2026-10-12", 12)).toBe("2025-10-12");
  });

  it("trece peste început de an", () => {
    expect(dataDeLaLuni("2026-02-15", 3)).toBe("2025-11-15");
  });

  it("ziua 31 cade pe ultima zi a lunii mai scurte, ca la scadența din bază", () => {
    expect(dataDeLaLuni("2026-05-31", 3)).toBe("2026-02-28");
    expect(dataDeLaLuni("2024-05-31", 3)).toBe("2024-02-29");
  });

  it("zero luni întoarce ziua neschimbată", () => {
    expect(dataDeLaLuni("2026-10-12", 0)).toBe("2026-10-12");
  });
});
