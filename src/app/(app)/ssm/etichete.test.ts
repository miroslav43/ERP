// src/app/(app)/ssm/etichete.test.ts
//
// Etichetele și tonurile SSM. Completitudinea pe enum o impune deja
// `Record<Enum, string>` la tsc, deci aici se verifică doar ce tsc nu vede:
// text nevid, fără sedilă, distinct, și tonuri care urmează gravitatea ca
// INVARIANȚI (ordinea enumului, obligația ITM), nu recopiate valoare cu valoare.

import { describe, expect, it } from "vitest";

import type { TonStare } from "@/components/ui/badge";

import {
  DOMENII_SSM,
  REZULTATE_EXAMEN,
  REZULTATE_VERIFICARE_STINGATOR,
  STATUS_STINGATOR,
  TIPURI_ACCIDENT,
  TIPURI_EXAMEN,
  TIPURI_VERIFICARE_STINGATOR,
} from "@/schemas/ssm";

import {
  ETICHETE_DOMENIU,
  ETICHETE_REZULTAT_EXAMEN,
  ETICHETE_REZULTAT_VERIFICARE,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_STINGATOR,
  ETICHETE_TIP_ACCIDENT,
  ETICHETE_TIP_EXAMEN,
  ETICHETE_TIP_VERIFICARE_STINGATOR,
  TONURI_REZULTAT_EXAMEN,
  TONURI_STATUS_STINGATOR,
  TONURI_TIP_ACCIDENT,
} from "./etichete";

/** Diacritice corecte: ș/ț cu virgulă, niciodată cu sedilă (U+015F/U+0163). */
const SEDILA = /[ŞşŢţ]/u;

/** Gravitatea unui ton: „succes”/„neutru”/„ciornă” nu cer nimic, „pericol” cere cel mai mult. */
const GRAVITATE: Readonly<Record<TonStare, number>> = {
  succes: 0,
  neutru: 0,
  ciorna: 0,
  atentie: 1,
  pericol: 2,
};

/** Accidentele care declanșează comunicarea la ITM (regula domeniului din etichete.ts). */
const ACCIDENTE_CU_COMUNICARE_ITM = ["mortal", "colectiv"] as const;

describe("etichetele", () => {
  it.each([
    ["domeniu", DOMENII_SSM, ETICHETE_DOMENIU],
    ["tip accident", TIPURI_ACCIDENT, ETICHETE_TIP_ACCIDENT],
    ["tip examen", TIPURI_EXAMEN, ETICHETE_TIP_EXAMEN],
    ["rezultat examen", REZULTATE_EXAMEN, ETICHETE_REZULTAT_EXAMEN],
    ["status stingător", STATUS_STINGATOR, ETICHETE_STATUS_STINGATOR],
    ["tip verificare", TIPURI_VERIFICARE_STINGATOR, ETICHETE_TIP_VERIFICARE_STINGATOR],
    ["rezultat verificare", REZULTATE_VERIFICARE_STINGATOR, ETICHETE_REZULTAT_VERIFICARE],
  ] as const)("%s: fiecare valoare are text nevid, fără sedilă", (_n, valori, etichete) => {
    for (const valoare of valori) {
      const text = (etichete as Readonly<Record<string, string>>)[valoare] ?? "";
      expect(text.trim().length).toBeGreaterThan(0);
      expect(text).not.toMatch(SEDILA);
    }
  });

  it("etichetele aceleiași liste sunt distincte (o pastilă nu poate confunda două stări)", () => {
    for (const etichete of [
      ETICHETE_TIP_ACCIDENT,
      ETICHETE_REZULTAT_EXAMEN,
      ETICHETE_STATUS_STINGATOR,
      ETICHETE_SCADENTA,
    ]) {
      const texte = Object.values(etichete) as string[];
      expect(new Set(texte).size).toBe(texte.length);
    }
  });
});

describe("tonurile urmează gravitatea", () => {
  it.each([
    ["tip accident", TIPURI_ACCIDENT, TONURI_TIP_ACCIDENT],
    ["rezultat examen", REZULTATE_EXAMEN, TONURI_REZULTAT_EXAMEN],
  ] as const)(
    "%s: tonul nu scade când gravitatea crește (ordinea enumului)",
    (_n, valori, tonuri) => {
      const trepte = valori.map(
        (v) => GRAVITATE[(tonuri as Readonly<Record<string, TonStare>>)[v] ?? "neutru"],
      );
      for (let i = 1; i < trepte.length; i++) {
        expect(trepte[i]).toBeGreaterThanOrEqual(trepte[i - 1] ?? 0);
      }
    },
  );

  it("accident: „pericol” exact pe tipurile cu comunicare la ITM", () => {
    const dePericol = TIPURI_ACCIDENT.filter((t) => TONURI_TIP_ACCIDENT[t] === "pericol");
    expect(dePericol).toEqual([...ACCIDENTE_CU_COMUNICARE_ITM]);
    // Celelalte cer totuși acțiune: niciun accident nu e „succes” sau „neutru”.
    for (const t of TIPURI_ACCIDENT) expect(GRAVITATE[TONURI_TIP_ACCIDENT[t]]).toBeGreaterThan(0);
  });

  it("examen: un singur rezultat de succes (apt) și un singur pericol (inapt definitiv)", () => {
    const pe = (ton: TonStare) => REZULTATE_EXAMEN.filter((r) => TONURI_REZULTAT_EXAMEN[r] === ton);
    expect(pe("succes")).toEqual(["apt"]);
    expect(pe("pericol")).toEqual(["inapt"]);
  });

  it("stingător: doar cel activ e succes; cel scos din locație cere atenție, casatul nu", () => {
    const deSucces = STATUS_STINGATOR.filter((s) => TONURI_STATUS_STINGATOR[s] === "succes");
    expect(deSucces).toEqual(["activ"]);
    expect(GRAVITATE[TONURI_STATUS_STINGATOR.in_service]).toBeGreaterThan(0);
    expect(GRAVITATE[TONURI_STATUS_STINGATOR.casat]).toBe(0);
  });
});

describe("ETICHETE_SCADENTA", () => {
  it("acoperă toate cele cinci trepte", () => {
    expect(Object.keys(ETICHETE_SCADENTA).sort()).toEqual(
      ["atentie", "critic", "expirat", "niciodata", "ok"].sort(),
    );
  });

  it("treapta critică (≤ 7 zile) spune termenul, nu un „în curând” mai blând decât atenția", () => {
    expect(ETICHETE_SCADENTA.critic).toContain("săptămână");
    expect(ETICHETE_SCADENTA.critic).not.toBe(ETICHETE_SCADENTA.atentie);
    expect(ETICHETE_SCADENTA.atentie).toBe("Expiră în curând");
  });
});
