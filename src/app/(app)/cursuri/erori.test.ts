// src/app/(app)/cursuri/erori.test.ts
//
// Traducerea codurilor Postgres ale modulului. Textul P0001 din triggerele
// 0075 e scris pentru om și TREBUIE să ajungă la el; restul codurilor primesc
// mesaje fixe, fără detaliile bazei.

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
  throw new Error("traduEroare trebuia să arunce.");
}

describe("traduEroare", () => {
  it.each([
    ["23514", "CONFLICT", "Combinația de setări nu este permisă."],
    ["23503", "CONFLICT", "Materialul sau cursul la care faceți referire nu mai există."],
    ["42501", "CONFLICT", "Nu aveți dreptul de a modifica acest câmp."],
  ])("%s ⇒ %s cu mesaj fix, fără textul bazei", (cod, asteptat, inceput) => {
    const e = aruncat(eroarePostgrest(cod, 'constraint "secret_ck" on column cnp'));
    expect(e).toBeInstanceOf(ActionDenied);
    const d = e as ActionDenied;
    expect(d.code).toBe(asteptat);
    expect(d.message.startsWith(inceput)).toBe(true);
    expect(d.message).not.toContain("secret_ck");
    expect(d.fieldErrors).toBeNull();
  });

  it("23505 ⇒ VALIDARE cu eroarea pe câmpul `cod`, ca formularul să-l marcheze", () => {
    const d = aruncat(eroarePostgrest("23505")) as ActionDenied;
    expect(d).toBeInstanceOf(ActionDenied);
    expect(d.code).toBe("VALIDARE");
    expect(d.fieldErrors).toEqual({ cod: [d.message] });
  });

  it("P0001 ⇒ CONFLICT cu textul triggerului propagat neschimbat", () => {
    const mesaj = "Mai aveți de parcurs din «Prezentarea firmei»: 240 din 480 secunde.";
    const d = aruncat(eroarePostgrest("P0001", mesaj)) as ActionDenied;
    expect(d.code).toBe("CONFLICT");
    expect(d.message).toBe(mesaj);
  });

  it.each([
    [600, 600],
    [601, 600],
    [5000, 600],
  ])("P0001 de %s caractere se taie la %s", (lungime, asteptat) => {
    const d = aruncat(eroarePostgrest("P0001", "x".repeat(lungime))) as ActionDenied;
    expect(d.message).toHaveLength(asteptat);
  });

  it.each([["40001"], ["57014"], ["PGRST116"]])(
    "un cod pe care modulul nu-l cunoaște (%s) se aruncă mai departe, NETRADUS",
    (cod) => {
      const original = eroarePostgrest(cod);
      expect(aruncat(original)).toBe(original);
    },
  );

  it.each([
    ["o eroare JavaScript", new Error("rețea")],
    ["un obiect fără `details`", { code: "23505", message: "dup" }],
    ["un șir", "boom"],
  ])("%s nu e confundată cu o eroare Postgres: se aruncă identic", (_caz, original) => {
    expect(aruncat(original)).toBe(original);
  });
});
