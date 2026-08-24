// src/domain/scadente.test.ts
import { describe, expect, it } from "vitest";

import {
  maiGravaScadenta,
  RANG_SCADENTA,
  treaptaDinScadenta,
  type TreaptaScadenta,
} from "./scadente";

/**
 * Vocabularul scadențelor e logică de DOMENIU, deci se testează în proiectul
 * `unit` (Node, milisecunde), nu în cel care randează DOM. Testele erau lipite
 * de componentă doar fiindcă și tipul stătea acolo — iar asta era chiar
 * inversiunea de dependență pe care mutarea a reparat-o.
 */

const TOATE_TREPTELE: readonly TreaptaScadenta[] = [
  "neaplicabil",
  "in_regula",
  "curand",
  "critic",
  "expirat",
  "lipsa",
];

/** Aceeași dată de referință ca în restul suitelor de scadențe. */
const AZI = "2026-06-15";

describe("RANG_SCADENTA", () => {
  it("crește strict în ordinea celor șase trepte", () => {
    expect(TOATE_TREPTELE.map((t) => RANG_SCADENTA[t])).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("pune „lipsa” DEASUPRA lui „expirat”", () => {
    // Decizia de produs, nu o preferință: ce lipsește n-are dată de la care să
    // numere, deci nu se aprinde niciodată singur. Ce a expirat s-a aprins deja.
    expect(RANG_SCADENTA.lipsa).toBeGreaterThan(RANG_SCADENTA.expirat);
    expect(maiGravaScadenta("expirat", "lipsa")).toBe("lipsa");
    expect(maiGravaScadenta("lipsa", "expirat")).toBe("lipsa");
  });

  it("pune „neaplicabil” SUB „in_regula”", () => {
    // „Nu se aplică” nu e o veste bună, e o non-veste. Nu are ce să urce peste
    // un termen respectat.
    expect(RANG_SCADENTA.neaplicabil).toBeLessThan(RANG_SCADENTA.in_regula);
    expect(maiGravaScadenta("neaplicabil", "in_regula")).toBe("in_regula");
  });
});

describe("treaptaDinScadenta — `null` nu se ghicește", () => {
  it("întoarce EXACT ce a cerut apelantul pentru `null`", () => {
    // O singură intrare, trei răspunsuri corecte, câte unul pe domeniu: flota
    // („lipsește”), SSM („nu expiră niciodată”), mentenanța („fără scadență”).
    expect(treaptaDinScadenta(null, AZI, { avertizareZile: 30, laNull: "lipsa" })).toBe("lipsa");
    expect(treaptaDinScadenta(null, AZI, { avertizareZile: 30, laNull: "neaplicabil" })).toBe(
      "neaplicabil",
    );
    expect(treaptaDinScadenta(null, AZI, { avertizareZile: 15, laNull: "in_regula" })).toBe(
      "in_regula",
    );
  });

  it("nu inventează niciodată `lipsa` sau `neaplicabil` dintr-o dată", () => {
    // Dintr-un calendar se pot deduce patru trepte. Celelalte două spun ceva
    // despre EXISTENȚA înregistrării, nu despre timp.
    const intrari = ["2020-01-01", AZI, "2026-07-15", "2027-01-01"];
    const rezultate = new Set(
      intrari.map((d) =>
        treaptaDinScadenta(d, AZI, { avertizareZile: 30, criticZile: 7, laNull: "lipsa" }),
      ),
    );
    expect([...rezultate].sort()).toEqual(["critic", "curand", "expirat", "in_regula"]);
  });
});

describe("treaptaDinScadenta — pragurile", () => {
  const praguriFlota = { avertizareZile: 30, laNull: "lipsa" } as const;

  it("este `expirat` pentru o dată trecută", () => {
    expect(treaptaDinScadenta("2026-06-14", AZI, praguriFlota)).toBe("expirat");
  });

  it("ziua de azi NU e încă expirată", () => {
    // Capcana de fus orar: `new Date("2026-06-15")` e miezul nopții UTC, adică
    // 03:00 în București. Comparația lexicografică pe ISO nu are fus orar.
    expect(treaptaDinScadenta(AZI, AZI, praguriFlota)).toBe("curand");
  });

  it("este `curand` exact la prag și `in_regula` imediat peste", () => {
    expect(treaptaDinScadenta("2026-07-15", AZI, praguriFlota)).toBe("curand");
    expect(treaptaDinScadenta("2026-07-16", AZI, praguriFlota)).toBe("in_regula");
  });

  it("fără `criticZile` nu produce NICIODATĂ `critic`", () => {
    // Flota și mentenanța n-au al doilea prag. O treaptă neatinsă nu strică
    // nimic; una impusă ar fi obligat modulele să mintă.
    for (const data of [AZI, "2026-06-16", "2026-06-22", "2026-07-15"]) {
      expect(treaptaDinScadenta(data, AZI, praguriFlota)).not.toBe("critic");
    }
  });

  it("cu `criticZile` reproduce semaforul SSM: 7 zile critic, 30 avertizare", () => {
    const praguriSsm = { avertizareZile: 30, criticZile: 7, laNull: "neaplicabil" } as const;
    expect(treaptaDinScadenta("2026-06-22", AZI, praguriSsm)).toBe("critic");
    expect(treaptaDinScadenta("2026-06-23", AZI, praguriSsm)).toBe("curand");
    expect(treaptaDinScadenta("2026-07-15", AZI, praguriSsm)).toBe("curand");
    expect(treaptaDinScadenta("2026-07-16", AZI, praguriSsm)).toBe("in_regula");
  });

  it("numără corect peste lună și peste an", () => {
    expect(treaptaDinScadenta("2027-01-05", "2026-12-31", praguriFlota)).toBe("curand");
    expect(treaptaDinScadenta("2026-03-01", "2026-02-28", praguriFlota)).toBe("curand");
    expect(treaptaDinScadenta("2026-02-28", "2026-03-01", praguriFlota)).toBe("expirat");
  });
});
