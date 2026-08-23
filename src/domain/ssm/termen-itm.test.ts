// src/domain/ssm/termen-itm.test.ts
import { describe, expect, it } from "vitest";
import {
  formuleazaRestTermenItm,
  momentLimitaComunicareItm,
  oraLimitaInCuvinte,
  oreRamasePanaLaTermen,
  restTermenItm,
} from "./termen-itm";

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

describe("restTermenItm", () => {
  it("descompune restul în ore și minute întregi", () => {
    const limita = new Date("2026-01-16T08:00:00.000Z");
    const acum = new Date("2026-01-16T00:48:30.000Z");
    expect(restTermenItm(limita, acum)).toEqual({ depasit: false, ore: 7, minute: 11 });
  });

  it("rotunjește în defavoarea celui care trebuie să sune", () => {
    // Au mai rămas 59 de secunde: „1 minut" ar fi o promisiune falsă.
    const limita = new Date("2026-01-16T08:00:00.000Z");
    const acum = new Date("2026-01-16T07:59:01.000Z");
    expect(restTermenItm(limita, acum)).toEqual({ depasit: false, ore: 0, minute: 0 });
  });

  it("măsoară depășirea, nu restul, după termen", () => {
    const limita = new Date("2026-01-16T08:00:00.000Z");
    const acum = new Date("2026-01-16T11:05:00.000Z");
    expect(restTermenItm(limita, acum)).toEqual({ depasit: true, ore: 3, minute: 5 });
  });
});

describe("formuleazaRestTermenItm", () => {
  it("acordă „de” de la 20 în sus", () => {
    expect(formuleazaRestTermenItm({ depasit: false, ore: 23, minute: 30 })).toBe(
      "23 de ore și 30 de minute",
    );
  });

  it("nu pune „de” sub 20", () => {
    expect(formuleazaRestTermenItm({ depasit: false, ore: 3, minute: 12 })).toBe(
      "3 ore și 12 minute",
    );
  });

  it("folosește singularul", () => {
    expect(formuleazaRestTermenItm({ depasit: false, ore: 1, minute: 1 })).toBe("1 oră și 1 minut");
  });

  it("tace ora când e zero și minutul când e zero", () => {
    expect(formuleazaRestTermenItm({ depasit: false, ore: 0, minute: 12 })).toBe("12 minute");
    expect(formuleazaRestTermenItm({ depasit: true, ore: 2, minute: 0 })).toBe("2 ore");
  });
});

describe("oraLimitaInCuvinte", () => {
  it("spune „azi” pentru aceeași zi românească", () => {
    // 16.01.2026, 10:00 ora României (iarnă, UTC+2).
    const limita = new Date("2026-01-16T08:00:00.000Z");
    const acum = new Date("2026-01-16T05:00:00.000Z");
    expect(oraLimitaInCuvinte(limita, acum)).toBe("azi la 10:00");
  });

  it("spune „mâine” peste miezul nopții românesc, nu peste cel UTC", () => {
    // Limita: 16.01.2026, 01:30 ora României = 15.01.2026, 23:30 UTC.
    // Acum: 15.01.2026, 23:00 ora României = 21:00 UTC. În UTC ar fi aceeași zi.
    const limita = new Date("2026-01-15T23:30:00.000Z");
    const acum = new Date("2026-01-15T21:00:00.000Z");
    expect(oraLimitaInCuvinte(limita, acum)).toBe("mâine la 01:30");
  });

  it("dă data întreagă când nu e nici azi, nici mâine", () => {
    const limita = new Date("2026-01-20T08:00:00.000Z");
    const acum = new Date("2026-01-16T08:00:00.000Z");
    expect(oraLimitaInCuvinte(limita, acum)).toBe("pe 20.01.2026, la 10:00");
  });
});
