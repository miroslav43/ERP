import { describe, expect, it } from "vitest";

import { SET_IMPLICIT, SETURI, setDupaCheie } from "./seturi";

describe("seturile de criterii", () => {
  it("fiecare set are ponderi întregi care fac 100", () => {
    for (const s of SETURI) {
      expect(
        s.criterii.reduce((suma, c) => suma + c.pondere, 0),
        s.cheie,
      ).toBe(100);
      for (const c of s.criterii) expect(Number.isInteger(c.pondere), c.criteriu).toBe(true);
    }
  });

  it("încap în fișă: cel mult 15 criterii, fiecare sub 120 de caractere, fără dubluri", () => {
    for (const s of SETURI) {
      expect(s.criterii.length, s.cheie).toBeLessThanOrEqual(15);
      for (const c of s.criterii) expect(c.criteriu.length, c.criteriu).toBeLessThanOrEqual(120);
      expect(new Set(s.criterii.map((c) => c.criteriu)).size, s.cheie).toBe(s.criterii.length);
    }
    expect(new Set(SETURI.map((s) => s.cheie)).size).toBe(SETURI.length);
  });

  it("cheia necunoscută sau a prototipului dă setul general", () => {
    for (const cheie of [null, "", "inexistent", "constructor", "__proto__", "toString"]) {
      expect(setDupaCheie(cheie).cheie, String(cheie)).toBe(SET_IMPLICIT);
    }
    expect(setDupaCheie("productie").eticheta).toBe("Producție");
  });

  it("textul e cu ș și ț cu virgulă, nu cu sedilă", () => {
    const tot = JSON.stringify(SETURI);
    expect(tot).not.toMatch(/[\u015E\u015F\u0162\u0163]/u);
  });
});
