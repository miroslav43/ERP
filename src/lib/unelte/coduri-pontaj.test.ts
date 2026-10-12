import { describe, expect, it } from "vitest";

import { CODURI_TIP_ZI } from "@/domain/attendance/coduri-zi";

import {
  CODURI_ABSENTA,
  CODURI_LEGENDA,
  COD_REPAUS,
  COD_SARBATOARE,
  LISTA_CODURI,
  TEXT_LEGENDA,
} from "./coduri-pontaj";

/**
 * Foaia gratuită e ușa spre aplicație: dacă ar scrie „N” pentru nemotivat și
 * aplicația „AN”, aceeași hârtie ar avea două legende.
 */
describe("codurile foii de pontaj", () => {
  it("sunt codurile modulului de pontaj, plus CFS", () => {
    expect(CODURI_ABSENTA.map((c) => c.cod)).toEqual(["CO", "CM", "CFS", "AN", "D"]);
    expect(COD_REPAUS).toBe(CODURI_TIP_ZI.weekend);
    expect(COD_SARBATOARE).toBe(CODURI_TIP_ZI.sarbatoare);
    for (const tip of ["concediu", "medical", "absenta_nemotivata", "delegatie"] as const) {
      expect(LISTA_CODURI).toContain(CODURI_TIP_ZI[tip]);
    }
  });

  it("lista de validare are coduri unice, scurte, fără virgulă, sub limita Excel", () => {
    expect(new Set(LISTA_CODURI).size).toBe(LISTA_CODURI.length);
    for (const cod of LISTA_CODURI) expect(cod).toMatch(/^[A-Z]{1,3}$/u);
    // O listă scrisă direct în validare nu poate trece de 255 de caractere.
    expect(LISTA_CODURI.join(",").length).toBeLessThan(255);
    expect(LISTA_CODURI).toEqual(CODURI_LEGENDA.map((c) => c.cod));
  });

  it("legenda numește fiecare cod și se termină cu punct", () => {
    for (const cod of LISTA_CODURI) expect(TEXT_LEGENDA).toContain(`${cod} = `);
    expect(TEXT_LEGENDA.startsWith("Legendă: cifra = ore lucrate;")).toBe(true);
    expect(TEXT_LEGENDA.endsWith(".")).toBe(true);
  });
});
