// src/domain/ssm/termen-itm.test.ts
import { describe, expect, it } from "vitest";
import { momentLimitaComunicareItm, oreRamasePanaLaTermen } from "./termen-itm";

describe("momentLimitaComunicareItm", () => {
  it("calculează corect în ora de iarnă (UTC+2)", () => {
    // 15.01.2026, 10:00 ora României (EET, UTC+2) → 08:00 UTC. +24h termen.
    const rezultat = momentLimitaComunicareItm("2026-01-15", "10:00", 24);
    expect(rezultat.toISOString()).toBe("2026-01-16T08:00:00.000Z");
  });

  it("calculează corect în ora de vară (UTC+3)", () => {
    // 15.07.2026, 14:00 ora României (EEST, UTC+3) → 11:00 UTC. +24h termen.
    const rezultat = momentLimitaComunicareItm("2026-07-15", "14:00", 24);
    expect(rezultat.toISOString()).toBe("2026-07-16T11:00:00.000Z");
  });

  it("acceptă ora cu secunde", () => {
    const rezultat = momentLimitaComunicareItm("2026-01-15", "10:00:45", 24);
    expect(rezultat.toISOString()).toBe("2026-01-16T08:00:00.000Z");
  });

  it("ia miezul nopții când ora nu e cunoscută", () => {
    // 00:00 ora României (EET, iarnă) = 22:00 UTC în ziua precedentă.
    const rezultat = momentLimitaComunicareItm("2026-01-15", null, 24);
    expect(rezultat.toISOString()).toBe("2026-01-15T22:00:00.000Z");
  });

  it("respectă un termen legal diferit de 24 de ore", () => {
    const rezultat = momentLimitaComunicareItm("2026-01-15", "10:00", 48);
    expect(rezultat.toISOString()).toBe("2026-01-17T08:00:00.000Z");
  });

  it("respinge o dată malformată", () => {
    expect(() => momentLimitaComunicareItm("15-01-2026", "10:00", 24)).toThrow();
  });

  it("respinge o oră malformată", () => {
    expect(() => momentLimitaComunicareItm("2026-01-15", "abc", 24)).toThrow();
  });
});

describe("oreRamasePanaLaTermen", () => {
  it("e pozitiv înainte de termen", () => {
    const limita = new Date("2026-01-16T08:00:00.000Z");
    const acum = new Date("2026-01-16T02:00:00.000Z");
    expect(oreRamasePanaLaTermen(limita, acum)).toBe(6);
  });

  it("e negativ după termen — depășire, nu eroare", () => {
    const limita = new Date("2026-01-16T08:00:00.000Z");
    const acum = new Date("2026-01-16T10:00:00.000Z");
    expect(oreRamasePanaLaTermen(limita, acum)).toBe(-2);
  });

  it("e zero exact la termen", () => {
    const moment = new Date("2026-01-16T08:00:00.000Z");
    expect(oreRamasePanaLaTermen(moment, moment)).toBe(0);
  });
});
