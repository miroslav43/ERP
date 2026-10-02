// src/app/(app)/concedii/etichete.test.ts
//
// Etichetele și tonurile de stare ale concediilor. Un enum care crește în bază
// fără eticheta lui ar afișa cheia brută („in_aprobare”) sau nimic; iar două
// stări cu înțeles opus pe același ton se confundă pe o listă tipărită.

import { describe, expect, it } from "vitest";

import {
  CRITERII_GRILA,
  MODURI_ROTUNJIRE_ACUMULARE,
  STATUSURI_CERERE,
  STATUSURI_SARCINA_APROBARE,
  VALORI_CONDITII_MUNCA_GRILA,
  VALORI_GRAD_HANDICAP_GRILA,
} from "@/schemas/leave";

import {
  ETICHETE_CRITERIU_GRILA,
  ETICHETE_MOD_ROTUNJIRE,
  ETICHETE_STATUS_CERERE,
  ETICHETE_STATUS_SARCINA,
  ETICHETE_VALOARE_CONDITII_MUNCA,
  ETICHETE_VALOARE_GRAD_HANDICAP,
  TONURI_STATUS_CERERE,
  TONURI_STATUS_SARCINA,
} from "./etichete";

const TONURI = ["succes", "atentie", "pericol", "neutru", "ciorna"];

describe("acoperirea enum-urilor", () => {
  it.each([
    ["ETICHETE_STATUS_CERERE", ETICHETE_STATUS_CERERE, STATUSURI_CERERE],
    ["TONURI_STATUS_CERERE", TONURI_STATUS_CERERE, STATUSURI_CERERE],
    ["ETICHETE_STATUS_SARCINA", ETICHETE_STATUS_SARCINA, STATUSURI_SARCINA_APROBARE],
    ["TONURI_STATUS_SARCINA", TONURI_STATUS_SARCINA, STATUSURI_SARCINA_APROBARE],
    ["ETICHETE_MOD_ROTUNJIRE", ETICHETE_MOD_ROTUNJIRE, MODURI_ROTUNJIRE_ACUMULARE],
    ["ETICHETE_CRITERIU_GRILA", ETICHETE_CRITERIU_GRILA, CRITERII_GRILA],
    [
      "ETICHETE_VALOARE_CONDITII_MUNCA",
      ETICHETE_VALOARE_CONDITII_MUNCA,
      VALORI_CONDITII_MUNCA_GRILA,
    ],
    ["ETICHETE_VALOARE_GRAD_HANDICAP", ETICHETE_VALOARE_GRAD_HANDICAP, VALORI_GRAD_HANDICAP_GRILA],
  ] as const)("%s are exact cheile enum-ului", (_nume, harta, chei) => {
    expect(Object.keys(harta).sort()).toEqual([...chei].sort());
  });
});

describe("etichetele", () => {
  it.each([
    ...Object.entries(ETICHETE_STATUS_CERERE),
    ...Object.entries(ETICHETE_STATUS_SARCINA),
    ...Object.entries(ETICHETE_MOD_ROTUNJIRE),
    ...Object.entries(ETICHETE_CRITERIU_GRILA),
  ])("`%s` are un text omenesc, cu diacritice cu virgulă, nu cheia brută", (cheie, eticheta) => {
    expect(eticheta.trim().length).toBeGreaterThan(0);
    expect(eticheta).not.toBe(cheie);
    expect(eticheta).not.toMatch(/_/u);
    expect(eticheta).not.toMatch(/[şţŞŢ]/u);
  });

  it("stările cererii au etichete distincte", () => {
    const valori = Object.values(ETICHETE_STATUS_CERERE);
    expect(new Set(valori).size).toBe(valori.length);
  });

  it("stările sarcinii au etichete distincte", () => {
    const valori = Object.values(ETICHETE_STATUS_SARCINA);
    expect(new Set(valori).size).toBe(valori.length);
  });
});

describe("tonurile", () => {
  it.each([...Object.entries(TONURI_STATUS_CERERE), ...Object.entries(TONURI_STATUS_SARCINA)])(
    "`%s` are un ton din paleta pastilei",
    (_cheie, ton) => {
      expect(TONURI).toContain(ton);
    },
  );

  it.each([
    ["aprobata", "succes"],
    ["respinsa", "pericol"],
    ["anulata", "neutru"],
    ["ciorna", "ciorna"],
  ] as const)("cererea `%s` are tonul `%s`", (status, ton) => {
    expect(TONURI_STATUS_CERERE[status]).toBe(ton);
  });

  it("o cerere care încă așteaptă nu arată a succes", () => {
    expect(TONURI_STATUS_CERERE.trimisa).not.toBe("succes");
    expect(TONURI_STATUS_CERERE.in_aprobare).not.toBe("succes");
  });

  it("rechemarea din concediu cere atenție, nu e o încheiere liniștită ca anularea", () => {
    expect(TONURI_STATUS_CERERE.intrerupta).toBe("atentie");
    expect(TONURI_STATUS_CERERE.intrerupta).not.toBe(TONURI_STATUS_CERERE.anulata);
  });

  it("sarcina expirată nu se confundă cu una în așteptare", () => {
    expect(TONURI_STATUS_SARCINA.expirata).toBe("pericol");
    expect(TONURI_STATUS_SARCINA.expirata).not.toBe(TONURI_STATUS_SARCINA.in_asteptare);
  });
});
