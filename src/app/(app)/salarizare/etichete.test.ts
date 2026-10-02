// src/app/(app)/salarizare/etichete.test.ts
import { describe, expect, it } from "vitest";

import { Constants } from "@/types/database";
import {
  AVERTISMENT_SALARIZARE,
  ETICHETE_STATUS_PERIOADA,
  LUNI_RO,
  numeLuna,
  TONURI_STATUS_PERIOADA,
} from "./etichete";

describe("numeLuna", () => {
  it.each([
    [1, "ianuarie"],
    [2, "februarie"],
    [3, "martie"],
    [6, "iunie"],
    [9, "septembrie"],
    [12, "decembrie"],
  ])("luna %i ⇒ %s", (luna, nume) => {
    expect(numeLuna(luna)).toBe(nume);
  });

  it.each([0, 13, -1])("luna %i în afara calendarului ⇒ cifra, nu un șir gol", (luna) => {
    expect(numeLuna(luna)).toBe(String(luna));
  });

  it("douăsprezece luni distincte, scrise cu diacritice corecte", () => {
    expect(new Set(LUNI_RO).size).toBe(12);
    for (const luna of LUNI_RO) expect(luna).not.toMatch(/[şţ]/u);
  });
});

describe("etichetele stărilor de perioadă", () => {
  const STARI = Constants.public.Enums.payroll_period_status;

  it.each(STARI)("starea %s are un cuvânt românesc și un ton", (stare) => {
    expect(ETICHETE_STATUS_PERIOADA[stare]).toMatch(/\S/u);
    expect(ETICHETE_STATUS_PERIOADA[stare]).not.toBe(stare);
    expect(TONURI_STATUS_PERIOADA[stare]).toBeDefined();
  });

  it.each([
    ["draft", "Ciornă", "ciorna"],
    ["calculat", "Calculat", "atentie"],
    ["aprobat", "Aprobat", "succes"],
    ["inchis", "Închis", "neutru"],
  ] as const)("%s ⇒ „%s”, ton %s", (stare, eticheta, ton) => {
    expect(ETICHETE_STATUS_PERIOADA[stare]).toBe(eticheta);
    expect(TONURI_STATUS_PERIOADA[stare]).toBe(ton);
  });

  it("o perioadă închisă nu e marcată ca eroare", () => {
    expect(TONURI_STATUS_PERIOADA.inchis).not.toBe("pericol");
  });
});

describe("AVERTISMENT_SALARIZARE", () => {
  it("spune explicit că modulul nu e certificat și cere verificarea contabilului", () => {
    expect(AVERTISMENT_SALARIZARE).toContain("NU este software de salarizare certificat");
    expect(AVERTISMENT_SALARIZARE).toContain("contabilul autorizat");
  });
});
