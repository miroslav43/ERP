// src/lib/membri/etichete.test.ts
//
// Numele rolurilor pe ecran: o singură listă, în aceeași ordine ca rolurile
// atribuibile, iar un rol necunoscut se afișează ca atare, nu se ascunde.

import { describe, expect, it } from "vitest";

import { etichetaRol, ROLURI } from "./etichete";
import { ROLURI_ATRIBUIBILE } from "./schimba-rol";

describe("ROLURI", () => {
  it("acoperă exact rolurile atribuibile, fără `super_admin`", () => {
    expect(ROLURI.map((r) => r.valoare)).toEqual([...ROLURI_ATRIBUIBILE]);
    expect(ROLURI.some((r) => (r.valoare as string) === "super_admin")).toBe(false);
  });

  it("fiecare etichetă e nevidă și unică", () => {
    const etichete = ROLURI.map((r) => r.eticheta);
    expect(new Set(etichete).size).toBe(etichete.length);
    for (const e of etichete) expect(e.trim()).not.toBe("");
  });
});

describe("etichetaRol", () => {
  it.each([
    ["org_admin", "Administrator"],
    ["manager", "Manager"],
    ["hr", "Resurse umane"],
    ["employee", "Angajat"],
  ])("%s ⇒ %s", (rol, eticheta) => {
    expect(etichetaRol(rol)).toBe(eticheta);
  });

  it.each(["super_admin", "contabil", "", "ORG_ADMIN"])(
    "rolul necunoscut %j se afișează ca atare",
    (rol) => {
      expect(etichetaRol(rol)).toBe(rol);
    },
  );
});
