// src/domain/ticketing/macrouri.test.ts
//
// Răspunsurile predefinite: un click scrie textul ȘI mută starea. Starea țintă
// trebuie să fie una în care tichetul chiar poate ajunge din coada IT-ului,
// altfel comentariul se publică, iar tranziția e refuzată de bază.

import { describe, expect, it } from "vitest";

import { aplicaMacroSchema } from "@/schemas/ticketing";

import { MACROURI, macroDupaCod } from "./macrouri";
import { STATUSURI_FINALE, STATUSURI_TICHET, tranzitiiPosibile } from "./stari";

describe("MACROURI", () => {
  it("codurile sunt unice", () => {
    const coduri = MACROURI.map((m) => m.cod);
    expect(new Set(coduri).size).toBe(coduri.length);
  });

  it.each(MACROURI.map((m) => [m.cod, m] as const))(
    "`%s` are etichetă, text și o stare validă",
    (_cod, macro) => {
      expect(macro.eticheta.trim().length).toBeGreaterThan(0);
      expect(macro.text.trim().length).toBeGreaterThan(0);
      expect(STATUSURI_TICHET).toContain(macro.status);
      expect(macro.text).not.toMatch(/[şţŞŢ]/u);
    },
  );

  it.each(MACROURI.map((m) => [m.cod, m] as const))(
    "codul `%s` trece de schema acțiunii `aplicaMacro`",
    (cod) => {
      expect(aplicaMacroSchema.safeParse({ ticket_id: crypto.randomUUID(), cod }).success).toBe(
        true,
      );
    },
  );

  it.each(MACROURI.map((m) => [m.cod, m] as const))(
    "`%s` nu închide definitiv tichetul (fără `inchis`, `anulat`, `respins`)",
    (_cod, macro) => {
      expect(STATUSURI_FINALE.has(macro.status)).toBe(false);
    },
  );

  it.each(MACROURI.map((m) => [m.cod, m] as const))(
    "`%s` duce într-o stare accesibilă dintr-un tichet aflat în lucru sau în așteptare",
    (_cod, macro) => {
      const accesibile = new Set([
        "in_lucru",
        ...tranzitiiPosibile("in_lucru"),
        ...tranzitiiPosibile("in_asteptare"),
      ]);
      expect(accesibile.has(macro.status)).toBe(true);
    },
  );

  it("starea fiecărui macro, așa cum o anunță textul", () => {
    expect(Object.fromEntries(MACROURI.map((m) => [m.cod, m.status]))).toEqual({
      detalii: "in_asteptare",
      instalat: "rezolvat",
      inlocuit: "rezolvat",
      in_lucru: "in_lucru",
    });
  });
});

describe("macroDupaCod", () => {
  it.each(MACROURI.map((m) => [m.cod, m] as const))("`%s` ⇒ macro-ul lui", (cod, macro) => {
    expect(macroDupaCod(cod)).toBe(macro);
  });

  it.each([
    ["inexistent", "nu_exista"],
    ["gol", ""],
    ["majuscule", "DETALII"],
    ["cu spațiu", " detalii"],
    ["eticheta, nu codul", "Am nevoie de mai multe detalii"],
  ])("cod %s ⇒ undefined", (_caz, cod) => {
    expect(macroDupaCod(cod)).toBeUndefined();
  });
});
