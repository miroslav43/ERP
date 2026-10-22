// src/domain/payroll/calc.program.test.ts
//
// Garda „L4” din campania QA (oct 2026): programul sub cinci zile pe săptămână
// NU schimbă tăcut salariul.
//
// Contractul n-are un câmp pentru zilele pe săptămână: motorul le deduce din
// norma săptămânală și cea zilnică. Un contract de 8 h/zi și 20 h/săpt.
// (asistentul pornește de la 40/8 și se schimbă doar săptămâna, sau un contract
// importat cu doar norma săptămânală) arată exact ca un program real de 2,5
// zile: salariul se împarte la 21 × 2,5 / 5 = 10,5 zile, iar cine lucrează 15
// din 21 de zile ia salariul întreg. Calculul rămâne pe programul din contract
// (e cel semnat și raportat în REGES), dar fiecare fluturaș spune ce program a
// folosit și cere confirmarea lui în contract.
import { describe, expect, it } from "vitest";

import {
  calculatePayrollEntry,
  type EmployeeContractSnapshot,
  type PayrollSettingsSnapshot,
} from "./calc";
import { problemaDinEtapa } from "./erori";

const SETARI: PayrollSettingsSnapshot = {
  valabilDeLa: "2026-01-01",
  cotaCas: 0.25,
  cotaCass: 0.1,
  cotaImpozit: 0.1,
  cotaCamAngajator: 0.0225,
  normaZilnicaOre: 8,
  procentSporNoapte: 0.25,
  procentSporWeekend: 0,
  procentOreSuplimentare: 0.75,
  valoareTichetMasa: 0,
  ticheteImpozabile: false,
  deducerePersonala: [],
  rotunjireLei: false,
};

const COD = "SAL_PROGRAM_SUB_CINCI_ZILE";

function calculeaza(
  normaOreZi: number,
  normaOreSaptamana: number | undefined,
  zileLucrate: number,
) {
  const contract: EmployeeContractSnapshot = {
    salariuBaza: 3000,
    nrPersoaneIntretinere: 0,
    normaZilnicaOre: normaOreZi,
    ...(normaOreSaptamana === undefined ? {} : { normaOreSaptamana }),
  };
  return calculatePayrollEntry({
    settings: SETARI,
    contract,
    attendance: {
      zileLucratoareLuna: 21,
      zileLucrate,
      oreLucrate: zileLucrate * normaOreZi,
      oreSuplimentare: 0,
      oreNoapte: 0,
      zileConcediuOdihna: 0,
      zileConcediuMedical: 0,
      zileAbsentaNemotivata: 0,
    },
    bonuses: [],
    deductions: [],
  });
}

const avertismentul = (r: ReturnType<typeof calculeaza>) => r.warnings.find((w) => w.cod === COD);

describe("programul de cinci zile: nicio atenționare, calculul de dinainte", () => {
  it("8 h/zi, 40 h/săpt.: 15 din 21 de zile ⇒ 15/21 din salariu, ca fără normă săptămânală", () => {
    const r = calculeaza(8, 40, 15);
    expect(r.bazaSalariu).toBeCloseTo((3000 * 15) / 21, 2);
    expect(avertismentul(r)).toBeUndefined();
    expect(r).toEqual(calculeaza(8, undefined, 15));
  });

  it("4 h/zi, 20 h/săpt. (timp parțial coerent, tot cinci zile): 15/21, fără atenționare", () => {
    const r = calculeaza(4, 20, 15);
    expect(r.bazaSalariu).toBeCloseTo((3000 * 15) / 21, 2);
    expect(avertismentul(r)).toBeUndefined();
    expect(r).toEqual(calculeaza(4, undefined, 15));
  });
});

describe("programul sub cinci zile: același calcul, dar spus pe fluturaș", () => {
  it("8 h/zi, 20 h/săpt. — 2,5 zile: atenționarea numește programul și cere confirmarea în contract", () => {
    const a = avertismentul(calculeaza(8, 20, 10));
    expect(a?.mesaj).toContain("Programul contractului: 2,5 zile pe săptămână");
    expect(a?.mesaj).toContain("confirmați în contract");
    expect(a?.mesaj).toContain("20:00 h pe săptămână în zile de 8:00 h");
    expect(a?.mesaj).toContain("10,5 zile ale programului din 21 lucrătoare");
    expect(a?.mesaj?.endsWith(".")).toBe(true);
  });

  it("8/20, 10 zile lucrate (sub cele 10,5 ale programului): proporțional cu programul, 2.857,14", () => {
    const r = calculeaza(8, 20, 10);
    expect(r.bazaSalariu).toBeCloseTo((3000 / 10.5) * 10, 2);
    expect(avertismentul(r)?.mesaj).not.toContain("peste cele");
  });

  it("8/20, 15 zile lucrate: salariul întreg, iar atenționarea spune că pontajul depășește programul", () => {
    // Semnul contractului incoerent: omul lucrează de fapt cinci zile pe săptămână.
    // Cu 4 h/zi ar fi luat 15/21 din salariu, adică 2.142,86 lei, nu 3.000.
    const r = calculeaza(8, 20, 15);
    expect(r.bazaSalariu).toBeCloseTo(3000, 2);
    const mesaj = avertismentul(r)?.mesaj ?? "";
    expect(mesaj).toContain("În pontaj sunt 15 zile plătite, peste cele 10,5 ale programului");
    expect(mesaj).toContain("15/21 din salariu");
  });

  it("8 h/zi, 24 h/săpt. — 3 zile: 12,6 zile ale programului, aceeași atenționare", () => {
    const r = calculeaza(8, 24, 12);
    expect(r.bazaSalariu).toBeCloseTo((3000 / 12.6) * 12, 2);
    const mesaj = avertismentul(r)?.mesaj ?? "";
    expect(mesaj).toContain("Programul contractului: 3 zile pe săptămână");
    expect(mesaj).toContain("12,6 zile ale programului din 21 lucrătoare");
  });

  it("codul e în catalog și duce la fișa angajatului, unde stă contractul", () => {
    const p = problemaDinEtapa(COD, "");
    expect(p.cod).toBe(COD);
    expect(p.severitate).toBe("avertisment");
    expect(p.unde).toBe("/angajati");
  });

  it("o singură atenționare pe fluturaș, oricâte zile", () => {
    expect(calculeaza(8, 20, 15).warnings.filter((w) => w.cod === COD)).toHaveLength(1);
  });
});
