// src/app/(app)/mentenanta/erori.test.ts
//
// `traduEroare` al modulului de mentenanță: 23505, depășirile numerice și
// P0001 primesc mesaj propriu; restul trece neatins la traducerea generică.

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

describe("traduEroare (mentenanță)", () => {
  it.each([["equipment_uq"], ["iscir_authorizations_uq"], ["oricare_uq"]])(
    "23505 pe %s ⇒ CONFLICT care trimite la cod sau la numărul ISCIR",
    (constrangere) => {
      const e = prinde(() => traduEroare(eroarePostgrest("23505", constrangere)));
      expect(e).toBeInstanceOf(ActionDenied);
      expect(e).toMatchObject({ code: "CONFLICT" });
      expect((e as Error).message).toContain("codul echipamentului");
      expect((e as Error).message).toContain("autorizației ISCIR");
    },
  );

  it.each([["22012"], ["22003"]])("%s ⇒ CONFLICT despre contor, costuri și durate", (cod) => {
    const e = prinde(() => traduEroare(eroarePostgrest(cod)));
    expect(e).toMatchObject({ code: "CONFLICT" });
    expect((e as Error).message).toContain("citirea contorului");
  });

  it("P0001: cifrele din mesajul triggerului ajung neschimbate", () => {
    const mesaj =
      "Citirea (9500) este mai mică decât ultima citire înregistrată (10000). Corectați valoarea sau bifați „Resetare contor”.";
    const e = prinde(() => traduEroare(eroarePostgrest("P0001", mesaj)));
    expect(e).toMatchObject({ code: "CONFLICT", message: mesaj });
  });

  it("P0001: garda ISCIR de 247 de caractere încape întreagă; peste 300 se taie", () => {
    const garda = "x".repeat(247);
    expect(prinde(() => traduEroare(eroarePostgrest("P0001", garda)))).toMatchObject({
      message: garda,
    });
    const lung = "y".repeat(301);
    expect((prinde(() => traduEroare(eroarePostgrest("P0001", lung))) as Error).message).toBe(
      "y".repeat(300),
    );
  });

  it.each([["42501"], ["23503"], ["23514"], ["428C9"]])(
    "%s se aruncă mai departe, ca obiectul original",
    (cod) => {
      const original = eroarePostgrest(cod);
      expect(prinde(() => traduEroare(original))).toBe(original);
    },
  );

  it("o eroare fără forma Postgres nu e tradusă, nici cu cod P0001", () => {
    const strain = { code: "P0001", message: "mesaj" };
    expect(prinde(() => traduEroare(strain))).toBe(strain);
    expect(prinde(() => traduEroare(null))).toBeNull();
  });
});
