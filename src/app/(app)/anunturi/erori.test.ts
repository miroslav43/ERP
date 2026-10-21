// src/app/(app)/anunturi/erori.test.ts
//
// Traducerea constrângerilor CHECK ale avizierului în erori PE CÂMP. Doar
// cele trei constrângeri numite din 0028 se traduc; orice alt cod — și orice
// 23514 cu alt nume — iese neschimbat, pe traducerea generică.

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
    [
      "announcements_expirare_ck",
      "expira_la",
      "Data de expirare trebuie să fie după data publicării.",
    ],
    ["announcements_titlu_len", "titlu", "Titlul are între 1 și 200 de caractere."],
    ["announcements_continut_len", "continut", "Conținutul are între 1 și 10 000 de caractere."],
  ])("23514 pe %s ⇒ VALIDARE cu eroarea pe câmpul `%s`", (constrangere, camp, mesaj) => {
    const e = aruncat(
      eroarePostgrest(
        "23514",
        `new row for relation "announcements" violates check constraint "${constrangere}"`,
      ),
    );
    expect(e).toBeInstanceOf(ActionDenied);
    const d = e as ActionDenied;
    expect(d.code).toBe("VALIDARE");
    expect(d.message).toBe(mesaj);
    expect(d.fieldErrors).toEqual({ [camp]: [mesaj] });
    expect(d.message).not.toContain(constrangere);
  });

  it("un 23514 cu o constrângere necunoscută se aruncă mai departe, NETRADUS", () => {
    const original = eroarePostgrest("23514", 'violates check constraint "alta_ck"');
    expect(aruncat(original)).toBe(original);
  });

  it.each([["23505"], ["42501"], ["P0001"], ["PGRST116"]])(
    "un cod pe care modulul nu-l traduce (%s) se aruncă mai departe, NETRADUS",
    (cod) => {
      const original = eroarePostgrest(cod, 'constraint "announcements_expirare_ck"');
      expect(aruncat(original)).toBe(original);
    },
  );

  it.each([
    ["o eroare JavaScript", new Error("rețea")],
    ["un obiect fără `details`", { code: "23514", message: "announcements_expirare_ck" }],
    ["un șir", "boom"],
  ])("%s nu e confundată cu o eroare Postgres: se aruncă identic", (_caz, original) => {
    expect(aruncat(original)).toBe(original);
  });
});
