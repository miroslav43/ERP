// src/app/(app)/flota/erori-etichete.test.ts
//
// Completează `erori.test.ts` (care acoperă potrivirea P0001 → câmp) cu
// codurile non-P0001 ale flotei și cu textele de interfață din `etichete.ts`.

import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { eroarePostgrest } from "@/lib/teste/supabase-fals";
import { CATEGORII_VEHICUL, COMBUSTIBILI, STATUS_FOAIE, STATUS_VEHICUL } from "@/schemas/fleet";

import { traduEroare } from "./erori";
import {
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_FOAIE,
  ETICHETE_STATUS_VEHICUL,
  ETICHETE_TIP_ANOMALIE,
  TONURI_STATUS_FOAIE,
  TONURI_STATUS_VEHICUL,
  TONURI_TIP_ANOMALIE,
  formatConsum,
} from "./etichete";

function prinde(error: unknown): unknown {
  try {
    traduEroare(error);
  } catch (e) {
    return e;
  }
  throw new Error("traduEroare n-a aruncat");
}

describe("traduEroare (flotă) — codurile care nu sunt P0001", () => {
  it("23505: CONFLICT despre număr / VIN, fără valoarea din index", () => {
    const e = prinde(eroarePostgrest("23505", "Key (nr_inmatriculare)=(B123ABC) already exists"));
    expect(e).toBeInstanceOf(ActionDenied);
    expect(e).toMatchObject({ code: "CONFLICT", fieldErrors: null });
    expect((e as ActionDenied).message).not.toContain("B123ABC");
  });

  it.each([["22012"], ["22003"]])("%s (împărțire la zero / depășire): CONFLICT numeric", (cod) => {
    const e = prinde(eroarePostgrest(cod));
    expect(e).toMatchObject({ code: "CONFLICT" });
    expect((e as ActionDenied).message).toContain("kilometrajul");
  });

  it("P0001 cu „Cantitatea de combustibil” ajunge pe `litri`", () => {
    const mesaj = "Cantitatea de combustibil trebuie să fie mai mare decât zero.";
    expect(prinde(eroarePostgrest("P0001", mesaj))).toMatchObject({
      code: "VALIDARE",
      fieldErrors: { litri: [mesaj] },
    });
  });

  it("P0001 lung: mesajul pe câmp e tăiat la 300 de caractere", () => {
    const mesaj = `Kilometrajul de sosire ${"9".repeat(400)}`;
    const e = prinde(eroarePostgrest("P0001", mesaj)) as ActionDenied;
    expect(e.message).toHaveLength(300);
    expect(e.fieldErrors?.km_sosire).toEqual([mesaj.slice(0, 300)]);
  });

  it.each([["42501"], ["23503"]])("%s nu e al flotei: se re-aruncă neschimbat", (cod) => {
    const original = eroarePostgrest(cod);
    expect(prinde(original)).toBe(original);
  });

  it("o eroare care nu e PostgREST se re-aruncă neschimbată", () => {
    const original = new Error("rețea");
    expect(prinde(original)).toBe(original);
  });
});

describe("etichetele flotei", () => {
  it.each([
    ["stări vehicul", STATUS_VEHICUL, ETICHETE_STATUS_VEHICUL],
    ["tonuri vehicul", STATUS_VEHICUL, TONURI_STATUS_VEHICUL],
    ["categorii", CATEGORII_VEHICUL, ETICHETE_CATEGORIE],
    ["combustibili", COMBUSTIBILI, ETICHETE_COMBUSTIBIL],
    ["stări foaie", STATUS_FOAIE, ETICHETE_STATUS_FOAIE],
    ["tonuri foaie", STATUS_FOAIE, TONURI_STATUS_FOAIE],
    ["tipuri anomalie", ["regres", "salt"], ETICHETE_TIP_ANOMALIE],
    ["tonuri anomalie", ["regres", "salt"], TONURI_TIP_ANOMALIE],
    ["scadențe", ["expirat", "curand", "in_regula", "lipsa"], ETICHETE_SCADENTA],
  ] as const)("fiecare valoare are text (%s)", (_nume, valori, harta) => {
    expect(Object.keys(harta).sort()).toEqual([...valori].sort());
    for (const v of valori) {
      expect((harta as Record<string, string>)[v]?.trim().length).toBeGreaterThan(0);
    }
  });

  it("regresul de odometru e mai grav decât saltul", () => {
    expect(TONURI_TIP_ANOMALIE.regres).toBe("pericol");
    expect(TONURI_TIP_ANOMALIE.salt).toBe("atentie");
  });
});

describe("formatConsum", () => {
  it.each([
    [9.4, "9,40 l/100 km"],
    [0, "0,00 l/100 km"],
    [7.456, "7,46 l/100 km"],
    [12, "12,00 l/100 km"],
  ])("%d ⇒ „%s”", (litri, asteptat) => {
    expect(formatConsum(litri)).toBe(asteptat);
  });

  it("nu scrie niciodată punct zecimal", () => {
    expect(formatConsum(5.5)).not.toMatch(/\d\.\d/u);
  });
});
