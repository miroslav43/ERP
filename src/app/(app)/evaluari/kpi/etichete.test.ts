// src/app/(app)/evaluari/kpi/etichete.test.ts
//
// Vocabularul KPI-ului lunar: numele lunii, pragurile de îndeplinire (unde
// 100 % e NORMA, nu plafonul) și formatarea valorii cu unitate.

import { describe, expect, it } from "vitest";

import { tonPunctaj } from "../etichete";
import { formatValoare, LUNI_RO, numeLuna, tonKpi } from "./etichete";

describe("numeLuna", () => {
  it.each([
    [2026, 1, "ianuarie 2026"],
    [2026, 3, "martie 2026"],
    [2025, 12, "decembrie 2025"],
  ])("%i/%i ⇒ %s", (an, luna, asteptat) => {
    expect(numeLuna(an, luna)).toBe(asteptat);
  });

  it.each([0, 13, -1, 1.5])("luna %s în afara 1..12 ⇒ doar anul", (luna) => {
    expect(numeLuna(2026, luna)).toBe("2026");
  });

  it("cele douăsprezece luni, cu litere mici", () => {
    expect(LUNI_RO).toHaveLength(12);
    for (const nume of LUNI_RO) expect(nume).toBe(nume.toLowerCase());
  });
});

describe("tonKpi", () => {
  it.each([
    [null, "neutru"],
    [130, "bun"],
    [100, "bun"],
    [99.9, "neutru"],
    [85, "neutru"],
    [84.9, "atentie"],
    [70, "atentie"],
    [69.9, "rau"],
    [0, "rau"],
  ] as const)("%s %% din țintă ⇒ %s", (procent, ton) => {
    expect(tonKpi(procent)).toBe(ton);
  });

  it("pragurile diferă de evaluarea anuală: 95 % din țintă nu e „bun”, dar 95 % din maxim este", () => {
    expect(tonKpi(95)).toBe("neutru");
    expect(tonPunctaj(95)).toBe("bun");
  });
});

describe("formatValoare", () => {
  it.each([
    [null, "vizite", "—"],
    [null, null, "—"],
    [37, "vizite", "37 vizite"],
    [37, null, "37"],
    [37, "", "37"],
    [0, "%", "0 %"],
    [1.4, "%", "1,40 %"],
    [2.345, null, "2,35"],
    [-3.5, "lei", "-3,50 lei"],
  ] as const)("%s cu unitatea %s ⇒ %s", (valoare, unitate, asteptat) => {
    expect(formatValoare(valoare, unitate)).toBe(asteptat);
  });
});
