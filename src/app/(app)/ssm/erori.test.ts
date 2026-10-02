// src/app/(app)/ssm/erori.test.ts
//
// `traduEroare` al modulului SSM: ce coduri Postgres primesc mesaj propriu,
// ce trece mai departe neatins către traducerea generică din `createAction`.

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { traduEroare } from "./erori";

function prinde(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e: unknown) {
    return e;
  }
  throw new Error("traduEroare trebuia să arunce.");
}

describe("traduEroare (SSM)", () => {
  it.each([
    [
      'duplicate key value violates unique constraint "fire_extinguishers_uq"',
      "Există deja un stingător cu acest cod în organizație.",
    ],
    [
      'duplicate key value violates unique constraint "personnel_authorizations_uq"',
      "Există deja o autorizație de acest tip și cu acest număr pentru angajatul ales.",
    ],
    [
      'duplicate key value violates unique constraint "work_accidents_uq"',
      "Există deja un accident înregistrat cu acest număr intern.",
    ],
    [
      'duplicate key value violates unique constraint "alt_uq"',
      "Există deja o înregistrare cu aceste date.",
    ],
  ])("23505 cu „%s” ⇒ CONFLICT „%s”", (mesajPg, asteptat) => {
    const e = prinde(() => traduEroare(eroarePostgrest("23505", mesajPg)));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", message: asteptat });
  });

  it.each([["22012"], ["22003"]])("%s (depășire numerică) ⇒ CONFLICT cu îndrumare", (cod) => {
    const e = prinde(() => traduEroare(eroarePostgrest(cod)));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT" });
    expect((e as Error).message).toContain("în afara intervalului acceptat");
  });

  it("P0001: mesajul triggerului se propagă neschimbat", () => {
    const mesaj = "Data instruirii nu poate fi în viitor.";
    const e = prinde(() => traduEroare(eroarePostgrest("P0001", mesaj)));
    expect(e).toMatchObject({ code: "CONFLICT", message: mesaj });
  });

  it("P0001: mesajul lung se taie la 300 de caractere", () => {
    const mesaj = "ș".repeat(450);
    const e = prinde(() => traduEroare(eroarePostgrest("P0001", mesaj)));
    expect((e as Error).message).toHaveLength(300);
  });

  it.each([["42501"], ["23503"], ["23514"], ["PGRST116"]])(
    "%s nu e al modulului: se aruncă MAI DEPARTE obiectul original",
    (cod) => {
      const original = eroarePostgrest(cod);
      const e = prinde(() => traduEroare(original));
      expect(e).toBe(original);
      expect(e).not.toBeInstanceOf(ActionDenied);
    },
  );

  it("o eroare care nu e Postgres (fără `details`) trece neatinsă, chiar cu cod 23505", () => {
    const strain = { code: "23505", message: "fire_extinguishers_uq" };
    expect(prinde(() => traduEroare(strain))).toBe(strain);
    const js = new Error("rețea");
    expect(prinde(() => traduEroare(js))).toBe(js);
  });
});
