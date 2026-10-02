// src/app/(app)/concedii/erori.test.ts
//
// `traduEroare` ÎNTOARCE o eroare, nu o aruncă: apelanții scriu
// `throw traduEroare(e)`. Ce iese de aici e fie un `ActionDenied` cu mesaj
// afișabil, fie eroarea primită, NESCHIMBATĂ, ca `createAction` s-o mapeze pe
// calea generică.

import { describe, expect, it } from "vitest";

import type { PostgrestError } from "@supabase/supabase-js";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { traduEroare } from "./erori";

const eroare = (code: string, message?: string, details: string | null = null): PostgrestError =>
  eroarePostgrest(code, message, details) as unknown as PostgrestError;

describe("traduEroare", () => {
  it("nu aruncă: întoarce eroarea, oricare ar fi codul", () => {
    expect(() => traduEroare(eroare("P0001", "x"))).not.toThrow();
    expect(() => traduEroare(eroare("42501"))).not.toThrow();
  });

  it("23P01 (suprapunere): CONFLICT cu mesaj pentru om, fără uuid-urile din `details`", () => {
    const e = traduEroare(
      eroare(
        "23P01",
        'conflicting key value violates exclusion constraint "leave_requests_fara_suprapunere"',
        "Key (employee_id, daterange(...))=(8888..., [2026-07-06,2026-07-11)) conflicts",
      ),
    );
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", fieldErrors: null });
    expect(e.message).toContain("Aveți deja o cerere de concediu");
    expect(e.message).not.toContain("leave_requests_fara_suprapunere");
    expect(e.message).not.toContain("8888");
  });

  it("23514 pe CHECK-ul certificatului: CONFLICT explicat, fără numele constrângerii", () => {
    const e = traduEroare(
      eroare(
        "23514",
        'new row for relation "leave_requests" violates check constraint "leave_requests_certificat_ck"',
      ),
    );
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT" });
    expect(e.message).toContain("codul de indemnizație și numărul certificatului");
    expect(e.message).not.toContain("_ck");
  });

  it("23514 pe alt CHECK: eroarea originală, neschimbată (calea generică o face VALIDARE)", () => {
    const original = eroare("23514", 'violates check constraint "leave_types_culoare_ck"');
    expect(traduEroare(original)).toBe(original);
  });

  it("P0001: CONFLICT cu textul triggerului, scris deja pentru utilizator", () => {
    const e = traduEroare(eroare("P0001", "Sold insuficient pentru concediul de odihnă."));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({
      code: "CONFLICT",
      message: "Sold insuficient pentru concediul de odihnă.",
    });
  });

  it("P0001: doar `message` se propagă, nu `details`", () => {
    const e = traduEroare(eroare("P0001", "Tip dezactivat.", "angajat 8888-uuid, cererea X"));
    expect(e.message).toBe("Tip dezactivat.");
  });

  it.each([
    [299, 299],
    [300, 300],
    [301, 300],
    [5000, 300],
  ])("P0001 cu mesaj de %i caractere: se afișează %i", (lungime, asteptat) => {
    const e = traduEroare(eroare("P0001", "ș".repeat(lungime)));
    expect(e.message).toHaveLength(asteptat);
  });

  it.each(["42501", "23505", "23503", "40001", "PGRST116", "XX000"])(
    "cod %s, necunoscut modulului: întoarce aceeași eroare, nu o copie",
    (code) => {
      const original = eroare(code);
      expect(traduEroare(original)).toBe(original);
    },
  );
});
