// src/app/(app)/registru/erori.test.ts
//
// `traduEroare` decide ce citește omul care ține registrul când baza refuză.
// Regula: P0001 vine cu mesajul bazei (care are date în el), 23505 se
// recunoaște după numele constrângerii, 42501 spune ce drum să folosești.

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { traduEroare } from "./erori";

function prinde(eroare: unknown): unknown {
  try {
    traduEroare(eroare);
  } catch (aruncata) {
    return aruncata;
  }
  throw new Error("traduEroare trebuia să arunce");
}

describe("traduEroare", () => {
  it.each([
    [
      'duplicate key value violates unique constraint "nomenclator_dosare_uq"',
      "Există deja un dosar cu acest indicativ în nomenclator.",
    ],
    [
      'duplicate key value violates unique constraint "nomenclator_tipuri_uq"',
      "Tipul acesta de document e deja clasat într-un dosar. Un tip se clasează într-unul singur.",
    ],
    [
      'duplicate key value violates unique constraint "registru_org_an_numar_uniq"',
      "Numărul acesta de înregistrare există deja pe anul curent. Reîncercați.",
    ],
    [
      'duplicate key value violates unique constraint "alt_index"',
      "Există deja o înregistrare cu aceste date.",
    ],
  ])("23505 cu %j ⇒ CONFLICT cu mesajul constrângerii", (mesajBaza, asteptat) => {
    const e = prinde(eroarePostgrest("23505", mesajBaza));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", message: asteptat });
  });

  it("42501 ⇒ CONFLICT care trimite spre înregistrarea manuală", () => {
    const e = prinde(eroarePostgrest("42501", "permission denied for table registru_documente"));
    expect(e).toMatchObject({
      code: "CONFLICT",
      message:
        "Numerele de înregistrare nu se pot scrie direct în registru. Folosiți înregistrarea manuală.",
    });
  });

  it("P0001 ⇒ CONFLICT cu textul bazei, propagat ca atare", () => {
    const e = prinde(eroarePostgrest("P0001", "Registrul pe anul 2025 este închis."));
    expect(e).toMatchObject({ code: "CONFLICT", message: "Registrul pe anul 2025 este închis." });
  });

  it.each([
    [299, 299],
    [300, 300],
    [301, 300],
    [5000, 300],
  ])("P0001 cu un mesaj de %i caractere ajunge la cel mult 300", (lungime, asteptat) => {
    const e = prinde(eroarePostgrest("P0001", "x".repeat(lungime)));
    expect((e as ActionDenied).message).toHaveLength(asteptat);
  });

  it("alt cod PostgREST (23503) trece mai departe neatins, spre traducerea generică", () => {
    const originala = eroarePostgrest("23503");
    expect(prinde(originala)).toBe(originala);
  });

  it.each([
    ["Error obișnuit", new Error("rețea")],
    ["obiect fără `details`", { code: "P0001", message: "fără details" }],
    ["șir", "text"],
    ["null", null],
  ])("%s nu e recunoscut ca eroare PostgREST: se re-aruncă identic", (_eticheta, eroare) => {
    expect(prinde(eroare)).toBe(eroare);
  });
});
