// src/app/(app)/cursuri/etichete.test.ts
//
// Etichetele modulului trebuie să acopere EXACT valorile enum-urilor din
// `schemas/cursuri.ts` (oglinda lui 0075): o valoare nouă în bază fără
// etichetă ar apărea pe ecran ca „undefined”, iar una scoasă ar lăsa o
// etichetă moartă care maschează divergența.

import { describe, expect, it } from "vitest";

import {
  CURS_ITEM_STATUS,
  CURS_MATERIAL_FEL,
  CURS_MATERIAL_SURSA,
  CURS_MOTIV,
  CURS_STATUS,
  CURS_TREAPTA_DOVADA,
  CURS_TREAPTA_DOVADA_TOATE,
} from "@/schemas/cursuri";

import {
  ETICHETE_FEL,
  ETICHETE_MOTIV,
  ETICHETE_SURSA,
  ETICHETE_STATUS,
  ETICHETE_STATUS_LECTIE,
  ETICHETE_TREAPTA,
  EXPLICATII_TREAPTA,
  TONURI_STATUS,
  TONURI_STATUS_LECTIE,
} from "./etichete";

const TONURI_VALIDE = ["succes", "atentie", "pericol", "neutru", "ciorna"];

describe("etichetele cursurilor", () => {
  it.each([
    ["ETICHETE_STATUS", ETICHETE_STATUS, CURS_STATUS],
    ["TONURI_STATUS", TONURI_STATUS, CURS_STATUS],
    ["ETICHETE_STATUS_LECTIE", ETICHETE_STATUS_LECTIE, CURS_ITEM_STATUS],
    ["TONURI_STATUS_LECTIE", TONURI_STATUS_LECTIE, CURS_ITEM_STATUS],
    ["ETICHETE_FEL", ETICHETE_FEL, CURS_MATERIAL_FEL],
    ["ETICHETE_SURSA", ETICHETE_SURSA, CURS_MATERIAL_SURSA],
    ["ETICHETE_TREAPTA", ETICHETE_TREAPTA, CURS_TREAPTA_DOVADA_TOATE],
    ["EXPLICATII_TREAPTA", EXPLICATII_TREAPTA, CURS_TREAPTA_DOVADA_TOATE],
    ["ETICHETE_MOTIV", ETICHETE_MOTIV, CURS_MOTIV],
  ] as const)("%s acoperă exact valorile enum-ului", (_nume, harta, valori) => {
    expect(Object.keys(harta).sort()).toEqual([...valori].sort());
    for (const v of Object.values(harta)) expect(v.trim().length).toBeGreaterThan(0);
  });

  it.each([
    ["ETICHETE_STATUS", ETICHETE_STATUS],
    ["ETICHETE_TREAPTA", ETICHETE_TREAPTA],
    ["ETICHETE_MOTIV", ETICHETE_MOTIV],
  ] as const)("%s: două valori diferite nu poartă aceeași etichetă", (_nume, harta) => {
    const etichete = Object.values(harta);
    expect(new Set(etichete).size).toBe(etichete.length);
  });

  it("fiecare treaptă care se poate alege în formular are explicație", () => {
    for (const t of CURS_TREAPTA_DOVADA) expect(EXPLICATII_TREAPTA[t].length).toBeGreaterThan(10);
  });

  it.each([
    ["TONURI_STATUS", TONURI_STATUS],
    ["TONURI_STATUS_LECTIE", TONURI_STATUS_LECTIE],
  ] as const)("%s folosește doar tonuri existente în Badge", (_nume, harta) => {
    for (const ton of Object.values(harta)) expect(TONURI_VALIDE).toContain(ton);
  });

  it.each([
    ["finalizat", "succes"],
    ["expirat", "pericol"],
    ["in_curs", "atentie"],
  ] as const)("starea `%s` are tonul `%s` (expirarea e semnal de pericol)", (stare, ton) => {
    expect(TONURI_STATUS[stare]).toBe(ton);
  });

  it("parcurgerea unei lecții și a cursului au aceeași etichetă pentru aceeași stare", () => {
    for (const s of CURS_ITEM_STATUS) expect(ETICHETE_STATUS_LECTIE[s]).toBe(ETICHETE_STATUS[s]);
  });
});
