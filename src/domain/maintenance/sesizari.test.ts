// src/domain/maintenance/sesizari.test.ts
//
// Contractul mașinii de stări, citit dintr-o privire. Trebuie să spună același
// lucru ca `internal.fault_reports_garda` (0181); proba reală a gărzii e în
// `tests/rls/proba-sesizari-roluri.sql`.

import { describe, expect, it } from "vitest";

import {
  STARI_DESCHISE_SESIZARE,
  STARI_TERMINALE_SESIZARE,
  esteDeschisa,
  esteTerminala,
  poateNotaInterna,
  raportorulPoateEdita,
  tranzitiePermisa,
  tranzitiiPermise,
} from "./sesizari";
import { STATUSURI_SESIZARE } from "@/schemas/maintenance";

const GESTIONAR = { poateGestiona: true } as const;
const TEHNICIAN = { poateGestiona: false, esteTehnician: true } as const;
const RAPORTOR = { poateGestiona: false, esteRaportor: true } as const;
const STRAIN = { poateGestiona: false } as const;

describe("structura", () => {
  it("stările deschise, „rezolvat” și cele terminale acoperă enum-ul, fără suprapunere", () => {
    const toate = [...STARI_DESCHISE_SESIZARE, "rezolvat", ...STARI_TERMINALE_SESIZARE].sort();
    expect(toate).toEqual([...STATUSURI_SESIZARE].sort());
    for (const s of STARI_DESCHISE_SESIZARE) {
      expect(esteDeschisa(s)).toBe(true);
      expect(esteTerminala(s)).toBe(false);
    }
    expect(esteDeschisa("rezolvat")).toBe(false);
    expect(esteTerminala("rezolvat")).toBe(false);
  });

  it("tranzițiile structurale — aceleași ca în gardă", () => {
    expect(tranzitiePermisa("nou", "in_lucru")).toBe(true);
    expect(tranzitiePermisa("nou", "inchis")).toBe(false);
    expect(tranzitiePermisa("in_lucru", "respins")).toBe(false);
    expect(tranzitiePermisa("in_asteptare", "respins")).toBe(true);
    expect(tranzitiePermisa("rezolvat", "in_lucru")).toBe(true);
    expect(tranzitiePermisa("rezolvat", "respins")).toBe(false);
    for (const s of STARI_TERMINALE_SESIZARE) {
      for (const t of STATUSURI_SESIZARE) {
        if (t !== "nou") expect(tranzitiePermisa(s, t)).toBe(false);
      }
    }
  });
});

describe("tranzitiiPermise", () => {
  it("un străin (nici gestionar, nici raportor, nici tehnician) nu poate nimic", () => {
    for (const s of STATUSURI_SESIZARE) expect(tranzitiiPermise(s, STRAIN)).toEqual([]);
  });

  it("stările terminale nu mai oferă nimic nimănui", () => {
    for (const s of STARI_TERMINALE_SESIZARE) {
      expect(tranzitiiPermise(s, GESTIONAR)).toEqual([]);
      expect(tranzitiiPermise(s, TEHNICIAN)).toEqual([]);
      expect(tranzitiiPermise(s, RAPORTOR)).toEqual([]);
    }
  });

  it("gestionarul: tot ce permite structura, minus retragerea (gestul raportorului)", () => {
    expect(tranzitiiPermise("nou", GESTIONAR)).toEqual(["in_analiza", "in_lucru", "respins"]);
    expect(tranzitiiPermise("in_analiza", GESTIONAR)).toEqual([
      "in_lucru",
      "in_asteptare",
      "respins",
    ]);
    expect(tranzitiiPermise("in_lucru", GESTIONAR)).toEqual([
      "rezolvat",
      "in_asteptare",
      "in_analiza",
    ]);
    expect(tranzitiiPermise("in_asteptare", GESTIONAR)).toEqual(["in_lucru", "respins"]);
    expect(tranzitiiPermise("rezolvat", GESTIONAR)).toEqual(["inchis", "in_lucru"]);
  });

  it("gestionarul care e și raportor își poate retrage sesizarea", () => {
    expect(tranzitiiPermise("nou", { poateGestiona: true, esteRaportor: true })).toContain(
      "retrasa",
    );
  });

  it("tehnicianul: începe sesizarea atribuită, o pune în așteptare și o reia, o rezolvă", () => {
    expect(tranzitiiPermise("nou", TEHNICIAN)).toEqual(["in_lucru"]);
    expect(tranzitiiPermise("in_analiza", TEHNICIAN)).toEqual(["in_lucru"]);
    expect(tranzitiiPermise("in_lucru", TEHNICIAN)).toEqual(["in_asteptare", "rezolvat"]);
    expect(tranzitiiPermise("in_asteptare", TEHNICIAN)).toEqual(["in_lucru"]);
    // Nu triază, nu respinge, nu închide: acelea sunt ale gestionarului și ale raportorului.
    expect(tranzitiiPermise("rezolvat", TEHNICIAN)).toEqual([]);
    expect(tranzitiiPermise("nou", TEHNICIAN)).not.toContain("respins");
  });

  it("raportorul: retrage cât e nouă sau în analiză; confirmă sau contestă rezolvarea", () => {
    expect(tranzitiiPermise("nou", RAPORTOR)).toEqual(["retrasa"]);
    expect(tranzitiiPermise("in_analiza", RAPORTOR)).toEqual(["retrasa"]);
    expect(tranzitiiPermise("in_lucru", RAPORTOR)).toEqual([]);
    expect(tranzitiiPermise("in_asteptare", RAPORTOR)).toEqual([]);
    expect(tranzitiiPermise("rezolvat", RAPORTOR)).toEqual(["inchis", "in_lucru"]);
  });

  it("raportorul care e și tehnicianul atribuit cumulează drepturile", () => {
    const ambele = { poateGestiona: false, esteRaportor: true, esteTehnician: true } as const;
    expect(tranzitiiPermise("in_lucru", ambele)).toEqual(["in_asteptare", "rezolvat"]);
    expect(tranzitiiPermise("rezolvat", ambele)).toEqual(["inchis", "in_lucru"]);
  });
});

describe("drepturi mărunte", () => {
  it("descrierea și urgența se editează doar cât sesizarea e nouă", () => {
    expect(raportorulPoateEdita("nou", RAPORTOR)).toBe(true);
    expect(raportorulPoateEdita("in_analiza", RAPORTOR)).toBe(false);
    expect(raportorulPoateEdita("nou", TEHNICIAN)).toBe(false);
    expect(raportorulPoateEdita("nou", GESTIONAR)).toBe(true);
  });

  it("nota internă e doar a gestionarului", () => {
    expect(poateNotaInterna(GESTIONAR)).toBe(true);
    expect(poateNotaInterna(TEHNICIAN)).toBe(false);
    expect(poateNotaInterna(RAPORTOR)).toBe(false);
  });
});
