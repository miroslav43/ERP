// src/domain/leave/zile-cerere.test.ts

import { describe, expect, it } from "vitest";
import { numaraZileCerere } from "./zile-cerere";

describe("numaraZileCerere", () => {
  it("numără o săptămână de lucru fără sărbători ca 5 zile lucrătoare", () => {
    // luni 2026-03-09 → vineri 2026-03-13
    const rezultat = numaraZileCerere("2026-03-09", "2026-03-13", [], [], []);
    expect(rezultat).toEqual({ zileLucratoare: 5, zileCalendaristice: 5 });
  });

  it("exclude sâmbăta și duminica din interval", () => {
    // luni 2026-03-09 → duminică 2026-03-15 (o săptămână completă)
    const rezultat = numaraZileCerere("2026-03-09", "2026-03-15", [], [], []);
    expect(rezultat).toEqual({ zileLucratoare: 5, zileCalendaristice: 7 });
  });

  it("exclude o sărbătoare legală aflată în mijlocul intervalului", () => {
    // 2026-01-01 (joi) este sărbătoare legală
    const rezultat = numaraZileCerere("2025-12-31", "2026-01-02", ["2026-01-01"], [], []);
    // 31 dec (miercuri, lucrătoare) + 1 ian (sărbătoare, exclusă) + 2 ian (vineri, lucrătoare)
    expect(rezultat).toEqual({ zileLucratoare: 2, zileCalendaristice: 3 });
  });

  it("exclude o zi liberă suplimentară acordată de organizație", () => {
    // 2026-03-09 (luni) declarată liberă suplimentar de organizație
    const rezultat = numaraZileCerere("2026-03-09", "2026-03-10", [], ["2026-03-09"], []);
    expect(rezultat).toEqual({ zileLucratoare: 1, zileCalendaristice: 2 });
  });

  it("o zi de recuperare transformă sâmbăta în zi lucrătoare", () => {
    // 2026-03-14 este sâmbătă, declarată zi de recuperare
    const rezultat = numaraZileCerere("2026-03-14", "2026-03-14", [], [], ["2026-03-14"]);
    expect(rezultat).toEqual({ zileLucratoare: 1, zileCalendaristice: 1 });
  });

  it("zi_recuperare are prioritate față de o sărbătoare legală suprapusă pe aceeași dată", () => {
    // ordinea din app.este_zi_lucratoare: zi_recuperare se verifică ÎNAINTEA sărbătorii legale
    const rezultat = numaraZileCerere(
      "2026-03-14",
      "2026-03-14",
      ["2026-03-14"],
      [],
      ["2026-03-14"],
    );
    expect(rezultat).toEqual({ zileLucratoare: 1, zileCalendaristice: 1 });
  });

  it("nu mai produce jumătăți de zi: fiecare zi lucrătoare valorează una întreagă", () => {
    // Cazurile care dădeau 1,5 și 0,5 înainte de 0112 — porțiunile au dispărut
    // din semnătură, iar constrângerea din bază ține coloanele pe „zi_intreaga".
    expect(numaraZileCerere("2026-03-09", "2026-03-10", [], [], [])).toEqual({
      zileLucratoare: 2,
      zileCalendaristice: 2,
    });
    expect(numaraZileCerere("2026-03-09", "2026-03-09", [], [], [])).toEqual({
      zileLucratoare: 1,
      zileCalendaristice: 1,
    });
    expect(
      Number.isInteger(numaraZileCerere("2026-03-09", "2026-03-20", [], [], []).zileLucratoare),
    ).toBe(true);
  });

  it("respinge un interval cu sfârșitul anterior începutului", () => {
    expect(() => numaraZileCerere("2026-03-10", "2026-03-09", [], [], [])).toThrow(RangeError);
  });

  it("respinge o dată calendaristică inexistentă", () => {
    expect(() => numaraZileCerere("2026-02-30", "2026-03-01", [], [], [])).toThrow(RangeError);
  });

  it("respinge un format de dată nevalid", () => {
    expect(() => numaraZileCerere("09-03-2026", "2026-03-10", [], [], [])).toThrow(RangeError);
  });
});
