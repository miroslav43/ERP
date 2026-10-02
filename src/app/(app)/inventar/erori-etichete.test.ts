// src/app/(app)/inventar/erori-etichete.test.ts
//
// Helperii puri ai inventarului: traducerea erorilor de bază și etichetele.

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";
import { STARI_OBIECT, STATUSURI_OBIECT } from "@/schemas/inventory";

import { traduEroare } from "./erori";
import { ETICHETE_STARE, ETICHETE_STATUS, TONURI_STARE, TONURI_STATUS } from "./etichete";

function prinde(error: unknown): unknown {
  try {
    traduEroare(error);
  } catch (e) {
    return e;
  }
  throw new Error("traduEroare n-a aruncat");
}

describe("traduEroare (inventar)", () => {
  it("23P01 (predare suprapusă): CONFLICT, fără uuid-ul din DETAIL", () => {
    const e = prinde(
      eroarePostgrest("23P01", "conflicting key value", "Key (item_id)=(abc-123) conflicts"),
    );
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", fieldErrors: null });
    expect((e as ActionDenied).message).not.toContain("abc-123");
    expect((e as ActionDenied).message).toContain("deja predat");
  });

  it("23505: numărul de inventar e deja luat", () => {
    expect(prinde(eroarePostgrest("23505"))).toMatchObject({
      code: "CONFLICT",
      message: "Există deja un obiect cu acest număr de inventar.",
    });
  });

  it.each([
    [10, 10],
    [300, 300],
    [301, 300],
  ])("P0001 de %i caractere ajunge pe ecran cu %i", (lungime, asteptat) => {
    const e = prinde(eroarePostgrest("P0001", "ș".repeat(lungime))) as ActionDenied;
    expect(e.code).toBe("CONFLICT");
    expect(e.message).toHaveLength(asteptat);
  });

  it.each([["42501"], ["23503"], ["23514"]])("%s se re-aruncă neschimbat", (cod) => {
    const original = eroarePostgrest(cod);
    expect(prinde(original)).toBe(original);
  });

  it("o eroare care nu e PostgREST se re-aruncă neschimbată", () => {
    const original = new Error("rețea");
    expect(prinde(original)).toBe(original);
  });
});

describe("etichetele inventarului", () => {
  it.each([
    ["status", STATUSURI_OBIECT, ETICHETE_STATUS],
    ["tonuri status", STATUSURI_OBIECT, TONURI_STATUS],
    ["stare", STARI_OBIECT, ETICHETE_STARE],
    ["tonuri stare", STARI_OBIECT, TONURI_STARE],
  ] as const)("fiecare valoare are text (%s)", (_nume, valori, harta) => {
    expect(Object.keys(harta).sort()).toEqual([...valori].sort());
    for (const v of valori) {
      expect((harta as Record<string, string>)[v]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("„nou” și „bun” nu au același ton — altfel nu se deosebesc în listă", () => {
    expect(TONURI_STARE.nou).not.toBe(TONURI_STARE.bun);
    expect(TONURI_STARE.defect).toBe("pericol");
  });
});
