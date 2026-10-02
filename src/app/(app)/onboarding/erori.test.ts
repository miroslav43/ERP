// src/app/(app)/onboarding/erori.test.ts
//
// Traducerea codurilor Postgres ale modulului de integrare. Textele P0001 din
// triggere sunt scrise pentru om, cu nume și cifre, și TREBUIE să ajungă la el;
// cele trei indexuri unice primesc fiecare mesajul lor, nu unul comun.

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

describe("traduEroare — 23505, după constrângere", () => {
  it.each([
    [
      "checklist_templates_denumire_uk",
      "Există deja un șablon cu această denumire pentru tipul ales.",
    ],
    [
      "checklist_instances_ciclu_uk",
      "Angajatul are deja un parcurs pornit pe acest șablon, în același ciclu.",
    ],
    [
      "checklist_template_items_ordine_uk",
      "Două elemente au ajuns pe aceeași poziție. Reîncărcați pagina și salvați din nou.",
    ],
    [
      "checklist_template_stages_ordine_uk",
      "Două elemente au ajuns pe aceeași poziție. Reîncărcați pagina și salvați din nou.",
    ],
  ])("constrângerea `%s` din `details` ⇒ mesajul ei", (constrangere, mesaj) => {
    const e = aruncat(
      eroarePostgrest(
        "23505",
        "duplicate key value violates unique constraint",
        `Key violates "${constrangere}"`,
      ),
    );
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", message: mesaj, fieldErrors: null });
  });

  it("fără `details`, constrângerea se caută în `message`", () => {
    const e = aruncat(
      eroarePostgrest(
        "23505",
        'duplicate key value violates unique constraint "checklist_templates_denumire_uk"',
      ),
    );
    expect(e).toMatchObject({
      code: "CONFLICT",
      message: "Există deja un șablon cu această denumire pentru tipul ales.",
    });
  });

  it("constrângere necunoscută: mesaj onest, care nu inventează o cauză", () => {
    const e = aruncat(eroarePostgrest("23505", "dup", 'Key violates "alt_index_uk"'));
    expect(e).toMatchObject({ code: "CONFLICT", message: "Există deja un rând cu aceleași date." });
    expect((e as ActionDenied).message).not.toContain("alt_index_uk");
  });
});

describe("traduEroare — P0001 din triggere", () => {
  it("textul triggerului ajunge la om neschimbat", () => {
    const mesaj =
      "Nu se poate finaliza: Popescu Ion are pași obligatorii nebifați — Lichidare, Predare acces.";
    const e = aruncat(eroarePostgrest("P0001", mesaj));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", message: mesaj });
  });

  it.each([
    [600, 600],
    [601, 600],
    [1200, 600],
    [10, 10],
  ])("un mesaj de %i caractere se taie la %i (enumerările lungi nu se pierd sub 600)", (n, m) => {
    const e = aruncat(eroarePostgrest("P0001", "x".repeat(n))) as ActionDenied;
    expect(e.message).toHaveLength(m);
  });
});

describe("traduEroare — restul trece neatins spre `createAction`", () => {
  it.each(["42501", "23503", "23514", "PGRST116", "40001"])(
    "codul %s se re-aruncă exact cum a venit",
    (cod) => {
      const eroare = eroarePostgrest(cod);
      expect(aruncat(eroare)).toBe(eroare);
    },
  );

  it.each([
    ["o eroare JS", new Error("rețea")],
    ["un obiect fără `details`", { code: "23505", message: "dup" }],
    ["null", null],
  ])("%s se re-aruncă neschimbat(ă)", (_caz, eroare) => {
    expect(aruncat(eroare)).toBe(eroare);
  });
});
