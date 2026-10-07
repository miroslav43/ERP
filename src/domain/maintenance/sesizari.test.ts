// src/domain/maintenance/sesizari.test.ts

import { describe, expect, it } from "vitest";

import {
  STARI_DESCHISE_SESIZARE,
  STARI_TERMINALE_SESIZARE,
  esteTerminala,
  tranzitiiPermise,
} from "./sesizari";
import { STATUSURI_SESIZARE } from "@/schemas/maintenance";

const GESTIONAR = { poateGestiona: true } as const;
const RAPORTOR = { poateGestiona: false } as const;

describe("tranzitiiPermise", () => {
  it("fără drept de gestionare nu există nicio tranziție, în nicio stare", () => {
    for (const status of STATUSURI_SESIZARE) {
      expect(tranzitiiPermise(status, RAPORTOR)).toEqual([]);
    }
  });

  it("stările terminale nu mai oferă nimic, nici gestionarului", () => {
    for (const status of STARI_TERMINALE_SESIZARE) {
      expect(tranzitiiPermise(status, GESTIONAR)).toEqual([]);
      expect(esteTerminala(status)).toBe(true);
    }
  });

  it("starea curentă nu apare ca tranziție; rezolvarea și respingerea sunt la coadă", () => {
    expect(tranzitiiPermise("nou", GESTIONAR)).toEqual([
      "in_analiza",
      "in_lucru",
      "rezolvat",
      "respins",
    ]);
    expect(tranzitiiPermise("in_analiza", GESTIONAR)).toEqual(["in_lucru", "rezolvat", "respins"]);
    expect(tranzitiiPermise("in_lucru", GESTIONAR)).toEqual(["in_analiza", "rezolvat", "respins"]);
  });

  it("stările deschise și cele terminale acoperă împreună enum-ul, fără suprapunere", () => {
    const toate = [...STARI_DESCHISE_SESIZARE, ...STARI_TERMINALE_SESIZARE].sort();
    expect(toate).toEqual([...STATUSURI_SESIZARE].sort());
    for (const status of STARI_DESCHISE_SESIZARE) expect(esteTerminala(status)).toBe(false);
  });
});
