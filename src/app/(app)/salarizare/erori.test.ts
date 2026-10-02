// src/app/(app)/salarizare/erori.test.ts
//
// `traduEroare`: fiecare ramură. Contractul are trei părți — codurile
// cunoscute devin `ActionDenied` cu mesajul modulului, P0001 își propagă
// textul (trunchiat), iar orice altceva se re-aruncă NESCHIMBAT, ca
// `createAction` să-l mapeze pe calea generică.

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";
import { traduEroare } from "./erori";

/** Rulează `traduEroare` și întoarce ce a aruncat. */
function aruncat(eroare: unknown): unknown {
  try {
    traduEroare(eroare);
  } catch (e: unknown) {
    return e;
  }
  throw new Error("traduEroare trebuia să arunce");
}

describe("traduEroare — coduri traduse în mesajele modulului", () => {
  it.each([
    [
      "23505",
      'duplicate key value violates unique constraint "payroll_periods_luna_uq"',
      "Există deja o perioadă de salarizare pentru luna aleasă",
    ],
    [
      "23505",
      'duplicate key value violates unique constraint "payroll_entries_uq"',
      "Angajatul are deja un rând de salariu în această perioadă",
    ],
    [
      "23505",
      'duplicate key value violates unique constraint "payroll_settings_valabil_uq"',
      "Există deja o versiune de setări de salarizare valabilă de la aceeași dată",
    ],
    [
      "23505",
      'duplicate key value violates unique constraint "alt_index_uq"',
      "Există deja o înregistrare de salarizare cu aceste date.",
    ],
    ["42P10", "there is no unique or exclusion constraint", "nu a putut fi rezolvată automat"],
    ["23514", 'violates check constraint "payroll_entries_valori_ck"', "valori imposibile"],
    ["22003", "numeric field overflow", "Cotele se introduc ca fracție"],
    ["22012", "division by zero", "împărțire la zero"],
  ])("%s (%s) ⇒ CONFLICT cu mesajul scris în modul", (cod, mesajBaza, asteptat) => {
    const e = aruncat(eroarePostgrest(cod, mesajBaza));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", message: expect.stringContaining(asteptat) });
  });

  it.each(["23505", "42P10", "23514", "22003", "22012"])(
    "%s: textul bazei NU ajunge la utilizator",
    (cod) => {
      const e = aruncat(eroarePostgrest(cod, "SECRET constraint payroll_x_ck (col)=(1)"));
      expect((e as Error).message).not.toContain("SECRET");
    },
  );

  it("23505 alege mesajul după indexul din text, nu după primul găsit", () => {
    const e = aruncat(eroarePostgrest("23505", 'violates "payroll_settings_valabil_uq"'));
    expect((e as Error).message).not.toContain("perioadă de salarizare pentru luna aleasă");
    expect((e as Error).message).toContain("aceeași dată");
  });
});

describe("traduEroare — P0001 din triggerele de tranziție", () => {
  it("textul triggerului se propagă, cu cifrele lui", () => {
    const mesaj = "Există 3 cereri de concediu în așteptare care se suprapun peste 8/2026.";
    const e = aruncat(eroarePostgrest("P0001", mesaj));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", message: mesaj });
  });

  it.each([
    [299, 299],
    [300, 300],
    [301, 300],
    [1000, 300],
  ])("un mesaj de %i caractere ajunge la %i", (lungime, asteptat) => {
    const e = aruncat(eroarePostgrest("P0001", "ș".repeat(lungime)));
    expect((e as Error).message).toHaveLength(asteptat);
  });

  it("`details` și `hint` nu se propagă niciodată", () => {
    const e = aruncat({
      ...eroarePostgrest("P0001", "Respins."),
      details: "DETALIU",
      hint: "HINT",
    });
    expect((e as Error).message).toBe("Respins.");
  });
});

describe("traduEroare — ce nu e al modulului se re-aruncă neschimbat", () => {
  it.each(["42501", "23503", "PGRST116", "57014", "40001"])(
    "codul %s iese ca aceeași eroare, pentru maparea generică",
    (cod) => {
      const original = eroarePostgrest(cod);
      expect(aruncat(original)).toBe(original);
    },
  );

  it("o eroare JavaScript obișnuită iese neschimbată", () => {
    const original = new TypeError("x is undefined");
    expect(aruncat(original)).toBe(original);
  });

  it("un obiect cu `code` dar fără `details` nu e tratat ca eroare PostgREST", () => {
    const original = { code: "P0001", message: "nu e de la PostgREST" };
    expect(aruncat(original)).toBe(original);
  });

  it.each([null, undefined, "text", 42])("valoarea %s iese neschimbată", (valoare) => {
    expect(aruncat(valoare)).toBe(valoare);
  });
});
