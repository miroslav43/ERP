// src/app/(app)/ticketing/etichete.test.ts
//
// Etichetele și tonurile tichetelor. O stare nouă în `STATUSURI_TICHET` fără
// eticheta ei ar ajunge pe ecran ca cheie brută sau ca `undefined`.

import { describe, expect, it } from "vitest";

import { PRIORITATI } from "@/domain/ticketing/prioritate";
import { STATUSURI_TICHET, TIPURI_TICHET } from "@/domain/ticketing/stari";

import {
  DESCRIERI_TIP,
  ETICHETE_CAMP,
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  TONURI_PRIORITATE,
  TONURI_STATUS,
} from "./etichete";

const TONURI = ["succes", "atentie", "pericol", "neutru", "ciorna"];

describe("acoperirea enum-urilor", () => {
  it.each([
    ["ETICHETE_TIP", ETICHETE_TIP, TIPURI_TICHET],
    ["DESCRIERI_TIP", DESCRIERI_TIP, TIPURI_TICHET],
    ["ETICHETE_STATUS", ETICHETE_STATUS, STATUSURI_TICHET],
    ["TONURI_STATUS", TONURI_STATUS, STATUSURI_TICHET],
    ["ETICHETE_PRIORITATE", ETICHETE_PRIORITATE, PRIORITATI],
    ["TONURI_PRIORITATE", TONURI_PRIORITATE, PRIORITATI],
  ] as const)("%s are exact cheile enum-ului", (_nume, harta, chei) => {
    expect(Object.keys(harta).sort()).toEqual([...chei].sort());
  });
});

describe("etichetele", () => {
  it.each([
    ...Object.entries(ETICHETE_TIP),
    ...Object.entries(ETICHETE_STATUS),
    ...Object.entries(ETICHETE_PRIORITATE),
    ...Object.entries(ETICHETE_CAMP),
  ])("`%s` are text omenesc, fără sedilă", (cheie, eticheta) => {
    expect(eticheta.trim().length).toBeGreaterThan(0);
    expect(eticheta).not.toBe(cheie);
    expect(eticheta).not.toMatch(/_/u);
    expect(eticheta).not.toMatch(/[şţŞŢ]/u);
  });

  it("stările au etichete distincte", () => {
    const valori = Object.values(ETICHETE_STATUS);
    expect(new Set(valori).size).toBe(valori.length);
  });

  it("`in_asteptare` spune că mingea e la solicitant", () => {
    expect(ETICHETE_STATUS.in_asteptare).toBe("Așteaptă răspunsul tău");
  });

  it("istoricul are etichete pentru câmpurile scrise de trigger și de suprascriere", () => {
    expect(ETICHETE_CAMP).toMatchObject({ status: "Stare", prioritate: "Prioritate" });
  });
});

describe("tonurile", () => {
  it.each([...Object.entries(TONURI_STATUS), ...Object.entries(TONURI_PRIORITATE)])(
    "`%s` are un ton din paleta pastilei",
    (_cheie, ton) => {
      expect(TONURI).toContain(ton);
    },
  );

  it.each([
    ["nou", "ciorna"],
    ["respins", "pericol"],
    ["rezolvat", "succes"],
    ["inchis", "neutru"],
    ["anulat", "neutru"],
    ["in_lucru", "atentie"],
    ["redeschis", "atentie"],
  ] as const)("starea `%s` are tonul `%s`", (status, ton) => {
    expect(TONURI_STATUS[status]).toBe(ton);
  });

  it("prioritatea critică iese în evidență mai tare decât cea ridicată", () => {
    expect(TONURI_PRIORITATE.critica).toBe("pericol");
    expect(TONURI_PRIORITATE.ridicata).toBe("atentie");
    expect(TONURI_PRIORITATE.normala).toBe("neutru");
  });
});
