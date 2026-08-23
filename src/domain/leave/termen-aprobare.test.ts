// src/domain/leave/termen-aprobare.test.ts

import { describe, expect, it } from "vitest";

import { oreParaTermen, treaptaTermenDecizie } from "./termen-aprobare";

const ACUM = new Date("2026-03-09T10:00:00.000Z");

describe("treaptaTermenDecizie", () => {
  it("fără termen (pas de flux fără SLA) e neaplicabil, nu «lipsă»", () => {
    expect(treaptaTermenDecizie(null, ACUM)).toBe("neaplicabil");
  });

  it("un termen depășit cu zece minute e deja expirat", () => {
    // Cazul pentru care funcția nu poate lucra pe zi calendaristică: turtit la
    // „2026-03-09”, termenul ăsta ar fi apărut încă în regulă.
    expect(treaptaTermenDecizie("2026-03-09T09:50:00.000Z", ACUM)).toBe("expirat");
  });

  it("mâine dimineață e critic", () => {
    expect(treaptaTermenDecizie("2026-03-10T08:00:00.000Z", ACUM)).toBe("critic");
  });

  it("peste două zile e «curând»", () => {
    expect(treaptaTermenDecizie("2026-03-11T10:00:00.000Z", ACUM)).toBe("curand");
  });

  it("peste o săptămână e în regulă", () => {
    expect(treaptaTermenDecizie("2026-03-16T10:00:00.000Z", ACUM)).toBe("in_regula");
  });
});

describe("oreParaTermen", () => {
  it("întoarce negativ pentru un termen trecut", () => {
    expect(oreParaTermen("2026-03-09T07:00:00.000Z", ACUM)).toBe(-3);
  });

  it("nu rotunjește: un sfert de oră rămâne un sfert de oră", () => {
    expect(oreParaTermen("2026-03-09T10:15:00.000Z", ACUM)).toBeCloseTo(0.25, 10);
  });
});
