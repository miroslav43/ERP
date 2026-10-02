// src/app/(app)/pontaj/erori.test.ts
//
// `traduEroare` al pontajului: 23505 și P0001 devin mesaje de business; orice
// altceva se aruncă NESCHIMBAT, ca `createAction` să-l traducă generic.

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";
import { traduEroare } from "./erori";

/** Ce aruncă `traduEroare` — funcția nu se întoarce niciodată. */
function aruncat(eroare: unknown): unknown {
  try {
    traduEroare(eroare);
  } catch (e: unknown) {
    return e;
  }
  throw new Error("traduEroare trebuia să arunce");
}

describe("traduEroare", () => {
  it("23505 ⇒ CONFLICT cu mesajul zilei deja existente", () => {
    const e = aruncat(eroarePostgrest("23505", "duplicate key attendance_entries_zi_uq"));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({
      code: "CONFLICT",
      message: "Există deja o zi de pontaj înregistrată pentru acest angajat la data aleasă.",
    });
  });

  it("P0001 ⇒ CONFLICT cu mesajul TRIGGERULUI, care poartă cifrele lunii", () => {
    const mesaj = "Perioada de pontaj 08.2026 este blocată și nu mai poate fi modificată.";
    const e = aruncat(eroarePostgrest("P0001", mesaj, "detaliu intern"));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", message: mesaj });
    expect((e as ActionDenied).message).not.toContain("detaliu intern");
  });

  it.each([
    [299, 299],
    [300, 300],
    [301, 300],
    [5000, 300],
  ])("mesajul P0001 de %i caractere se taie la %i", (lungime, asteptat) => {
    const e = aruncat(eroarePostgrest("P0001", "x".repeat(lungime)));
    expect((e as ActionDenied).message).toHaveLength(asteptat);
  });

  it.each(["42501", "23503", "23514", "PGRST116", "40001"])(
    "codul %s nu e tradus aici: aceeași eroare iese mai departe",
    (cod) => {
      const original = eroarePostgrest(cod);
      expect(aruncat(original)).toBe(original);
    },
  );

  it.each([
    ["o excepție obișnuită", new Error("rețea căzută")],
    ["un obiect fără `details` (nu e eroare PostgREST)", { code: "P0001", message: "x" }],
    ["un șir", "eroare"],
    ["null", null],
  ])("%s se aruncă neschimbat", (_d, valoare) => {
    expect(aruncat(valoare)).toBe(valoare);
  });
});
