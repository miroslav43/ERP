// src/app/(app)/concedii/calendar/vedere.test.ts
//
// Parametrul `vedere` din URL e text străin: orice valoare necunoscută cade pe
// planificator, iar o listă repetată (`?vedere=a&vedere=b`) se citește după
// prima valoare.

import { describe, expect, it } from "vitest";

import { VEDERE_IMPLICITA, VEDERI_CALENDAR, vedereDinParametru } from "./vedere";

describe("vedereDinParametru", () => {
  it.each([
    ["planificator", "planificator"],
    ["grila", "grila"],
    [["grila", "planificator"], "grila"],
    [["planificator", "grila"], "planificator"],
  ] as const)("%o ⇒ %s", (parametru, asteptat) => {
    expect(vedereDinParametru(parametru as string | string[])).toBe(asteptat);
  });

  it.each([
    ["lipsă", undefined],
    ["șir gol", ""],
    ["listă goală", []],
    ["majuscule", "GRILA"],
    ["cu spațiu", " grila"],
    ["cheie necunoscută", "an"],
    ["eticheta, nu cheia", "Grilă lunară"],
  ] as const)("%s ⇒ vederea implicită", (_caz, parametru) => {
    expect(vedereDinParametru(parametru as string | string[] | undefined)).toBe(VEDERE_IMPLICITA);
  });

  it("vederea implicită e planificatorul și e una dintre cele declarate", () => {
    expect(VEDERE_IMPLICITA).toBe("planificator");
    expect(VEDERI_CALENDAR.map((v) => v.cheie)).toContain(VEDERE_IMPLICITA);
  });

  it("cheile vederilor sunt unice și au etichetă și descriere", () => {
    const chei = VEDERI_CALENDAR.map((v) => v.cheie);
    expect(new Set(chei).size).toBe(chei.length);
    for (const v of VEDERI_CALENDAR) {
      expect(v.eticheta.length).toBeGreaterThan(0);
      expect(v.descriere.length).toBeGreaterThan(0);
    }
  });
});
