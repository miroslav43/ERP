// src/app/(app)/diurna/erori-etichete.test.ts
//
// Helperii puri ai modulului: traducerea erorilor de bază și textele de
// interfață (etichete, tonuri, numărul de zile scris în română).

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import {
  MIJLOACE_TRANSPORT,
  REGULI_TRECERE_FRONTIERA,
  STATUSURI_DEPLASARE,
  TIPURI_CHELTUIALA,
} from "@/schemas/per-diem";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";

import { traduEroare } from "./erori";
import {
  ETICHETE_MIJLOC_TRANSPORT,
  ETICHETE_REGULA_TRECERE,
  ETICHETE_STATUS_DEPLASARE,
  ETICHETE_TIP_CHELTUIALA,
  TONURI_STATUS_DEPLASARE,
  textZile,
} from "./etichete";

function prinde(error: unknown): unknown {
  try {
    traduEroare(error);
  } catch (e) {
    return e;
  }
  throw new Error("traduEroare n-a aruncat");
}

describe("traduEroare (diurnă)", () => {
  it("P0001: mesajul triggerului trece pe ecran, ca CONFLICT", () => {
    const mesaj = "Nu există o politică de diurnă valabilă la 10.09.2026.";
    const e = prinde(eroarePostgrest("P0001", mesaj));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", message: mesaj, fieldErrors: null });
  });

  it.each([
    [299, 299],
    [300, 300],
    [301, 300],
    [1000, 300],
  ])("P0001 de %i caractere ajunge pe ecran cu %i", (lungime, asteptat) => {
    const e = prinde(eroarePostgrest("P0001", "a".repeat(lungime)));
    expect((e as ActionDenied).message).toHaveLength(asteptat);
  });

  it("23505: mesaj fix, fără numele constrângerii", () => {
    const e = prinde(eroarePostgrest("23505", "duplicate key business_trip_legs_ordine_uk"));
    expect(e).toMatchObject({ code: "CONFLICT" });
    expect((e as ActionDenied).message).not.toContain("ordine_uk");
  });

  it.each([["42501"], ["23503"], ["PGRST116"]])(
    "codul %s nu e al modulului: se re-aruncă neschimbat, pentru calea generică",
    (cod) => {
      const original = eroarePostgrest(cod);
      expect(prinde(original)).toBe(original);
    },
  );

  it("o eroare care nu e PostgREST se re-aruncă neschimbată", () => {
    const original = new TypeError("rețea");
    expect(prinde(original)).toBe(original);
  });

  it("un obiect cu `code` dar fără `details` nu e tratat ca eroare PostgREST", () => {
    const fals = { code: "P0001", message: "mesaj" };
    expect(prinde(fals)).toBe(fals);
  });
});

describe("etichetele diurnei", () => {
  it.each([
    ["stări", STATUSURI_DEPLASARE, ETICHETE_STATUS_DEPLASARE],
    ["tonuri", STATUSURI_DEPLASARE, TONURI_STATUS_DEPLASARE],
    ["mijloace de transport", MIJLOACE_TRANSPORT, ETICHETE_MIJLOC_TRANSPORT],
    ["tipuri de cheltuială", TIPURI_CHELTUIALA, ETICHETE_TIP_CHELTUIALA],
    ["reguli de frontieră", REGULI_TRECERE_FRONTIERA, ETICHETE_REGULA_TRECERE],
  ] as const)("fiecare valoare din enum are text (%s)", (_nume, valori, harta) => {
    expect(Object.keys(harta).sort()).toEqual([...valori].sort());
    for (const v of valori) {
      expect((harta as Record<string, string>)[v]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("starea terminală reușită e „succes”, cea care așteaptă pe altcineva e „atentie”", () => {
    expect(TONURI_STATUS_DEPLASARE.decontata).toBe("succes");
    expect(TONURI_STATUS_DEPLASARE.in_aprobare).toBe("atentie");
    expect(TONURI_STATUS_DEPLASARE.respinsa).toBe("pericol");
  });
});

describe("textZile", () => {
  it.each([
    [0, "0 zile"],
    [1, "1 zi"],
    [1.5, "1,5 zile"],
    [2, "2 zile"],
    [3, "3 zile"],
    [19, "19 zile"],
    [20, "20 de zile"],
    [20.5, "20,5 de zile"],
    [21, "21 de zile"],
    [100, "100 de zile"],
    [101, "101 zile"],
    [119, "119 zile"],
    [120, "120 de zile"],
    [0.25, "0,25 zile"],
  ])("%d ⇒ „%s”", (zile, asteptat) => {
    // Formatorul ro-RO pune separator de mii abia de la 10.000; aici nu apare.
    expect(textZile(zile)).toBe(asteptat);
  });

  it("nu scrie niciodată punct zecimal și nici zecimale inutile", () => {
    expect(textZile(3)).not.toContain(",00");
    expect(textZile(2.5)).not.toContain(".");
  });
});
