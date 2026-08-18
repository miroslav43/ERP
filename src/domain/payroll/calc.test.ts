// src/domain/payroll/calc.test.ts
import { describe, expect, it } from "vitest";
import { calculatePayrollEntry, type PayrollSettingsSnapshot } from "./calc";

/**
 * Cotele de mai jos sunt ILUSTRATIVE, alese ca să facă aritmetica ușor de
 * verificat de mână — NU sunt cotele legale curente. Verificarea valorilor
 * reale e responsabilitatea contabilului, la configurarea `payroll_settings`
 * a fiecărei organizații.
 */
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
  valoareTichetMasa: 30,
  ticheteImpozabile: false,
  deducerePersonala: [
    { nrPersoaneIntretinereMin: 0, nrPersoaneIntretinereMax: 0, venitBrutMax: 4000, valoare: 600 },
    { nrPersoaneIntretinereMin: 1, nrPersoaneIntretinereMax: 1, venitBrutMax: 4000, valoare: 750 },
  ],
  rotunjireLei: false,
};

const PONTAJ_STANDARD = {
  zileLucratoareLuna: 21,
  zileLucrate: 21,
  oreLucrate: 168,
  oreSuplimentare: 0,
  oreNoapte: 0,
  zileConcediuOdihna: 0,
  zileConcediuMedical: 0,
  zileAbsentaNemotivata: 0,
} as const;

describe("calculatePayrollEntry — lună standard, fără elemente variabile", () => {
  const rezultat = calculatePayrollEntry({
    settings: SETARI,
    contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
    attendance: PONTAJ_STANDARD,
    bonuses: [],
    deductions: [],
  });

  it("brutul egalează salariul de bază când toate zilele sunt lucrate", () => {
    expect(rezultat.bazaSalariu).toBeCloseTo(5000, 2);
    expect(rezultat.brut).toBeCloseTo(5000, 2);
  });

  it("CAS/CASS/impozitul se calculează pe baza corectă", () => {
    expect(rezultat.cas).toBeCloseTo(1250, 2);
    expect(rezultat.cass).toBeCloseTo(500, 2);
    // deducere: 0 persoane, brut 5000 > venitBrutMax 4000 al pragului ⇒ 0
    expect(rezultat.deducerePersonala).toBe(0);
    expect(rezultat.bazaImpozit).toBeCloseTo(5000 - 1250 - 500, 2);
    expect(rezultat.impozit).toBeCloseTo(325, 2);
    expect(rezultat.net).toBeCloseTo(5000 - 1250 - 500 - 325, 2);
  });

  it("tichetele nu intră în baza CAS/CASS, dar intră în costul angajatorului", () => {
    expect(rezultat.valoareTichete).toBeCloseTo(21 * 30, 2);
    expect(rezultat.bazaCasCass).toBeCloseTo(5000, 2);
    expect(rezultat.costTotalAngajator).toBeCloseTo(5000 + 5000 * 0.0225 + 630, 2);
  });

  it("fără reținere, net de plată = net", () => {
    expect(rezultat.netDePlata).toBe(rezultat.net);
    expect(rezultat.retineriTotal).toBe(0);
  });
});

describe("calculatePayrollEntry — deducere personală sub plafon", () => {
  it("un venit sub pragul de venit primește deducerea configurată", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 3000, nrPersoaneIntretinere: 1 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.deducerePersonala).toBe(750);
  });
});

describe("calculatePayrollEntry — ore suplimentare și spor de noapte", () => {
  it("cresc brutul, dar nu afectează zilele plătite din bazaSalariu", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, oreSuplimentare: 10, oreNoapte: 20 },
      bonuses: [],
      deductions: [],
    });
    const oreRata = 5000 / (21 * 8);
    expect(rezultat.bazaSalariu).toBeCloseTo(5000, 2);
    expect(rezultat.sumaOreSuplimentare).toBeCloseTo(10 * oreRata * 1.75, 2);
    expect(rezultat.sporNoapte).toBeCloseTo(20 * oreRata * 0.25, 2);
    expect(rezultat.brut).toBeGreaterThan(5000);
  });
});

describe("calculatePayrollEntry — lună parțială (angajare/plecare pe parcurs)", () => {
  it("bazaSalariu e proporțională cu zilele efectiv plătite", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileLucrate: 10, oreLucrate: 80 },
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.bazaSalariu).toBeCloseTo((5000 / 21) * 10, 2);
  });

  it("concediul de odihnă se plătește la aceeași rată zilnică și lasă avertisment", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileLucrate: 16, zileConcediuOdihna: 5 },
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.bazaSalariu).toBeCloseTo(5000, 2);
    expect(rezultat.warnings.map((w) => w.cod)).toContain("INDEMNIZATIE_CO_SIMPLIFICATA");
  });

  it("aruncă eroare dacă zilele plătite depășesc zilele lucrătoare ale lunii", () => {
    expect(() =>
      calculatePayrollEntry({
        settings: SETARI,
        contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
        attendance: { ...PONTAJ_STANDARD, zileLucrate: 20, zileConcediuOdihna: 5 },
        bonuses: [],
        deductions: [],
      }),
    ).toThrow(RangeError);
  });
});

describe("calculatePayrollEntry — concediu medical", () => {
  it("nu intră în bazaSalariu și produce avertisment, nu eroare", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileLucrate: 18, zileConcediuMedical: 3 },
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.bazaSalariu).toBeCloseTo((5000 / 21) * 18, 2);
    expect(rezultat.warnings.map((w) => w.cod)).toContain("CONCEDIU_MEDICAL_NECALCULAT");
  });
});

describe("calculatePayrollEntry — prime", () => {
  it("o primă supusă contribuțiilor intră în baza CAS/CASS", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [{ suma: 500, impozabil: true, supusContributii: true }],
      deductions: [],
    });
    expect(rezultat.brut).toBeCloseTo(5500, 2);
    expect(rezultat.bazaCasCass).toBeCloseTo(5500, 2);
  });

  it("o primă neimpozabilă și fără contribuții crește brutul, dar nu baza de impozit/CAS", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [{ suma: 500, impozabil: false, supusContributii: false }],
      deductions: [],
    });
    expect(rezultat.brut).toBeCloseTo(5500, 2);
    expect(rezultat.bazaCasCass).toBeCloseTo(5000, 2);
  });
});

describe("calculatePayrollEntry — rețineri", () => {
  it("o reținere fără plafon se scade integral din net", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [{ suma: 400, procentMaximDinNet: null }],
    });
    expect(rezultat.retineriTotal).toBeCloseTo(400, 2);
    expect(rezultat.netDePlata).toBeCloseTo(rezultat.net - 400, 2);
  });

  it("o reținere peste plafonul legal se taie la plafon și avertizează", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [{ suma: 100000, procentMaximDinNet: 0.5 }],
    });
    expect(rezultat.retineriTotal).toBeCloseTo(rezultat.net * 0.5, 2);
    expect(rezultat.warnings.map((w) => w.cod)).toContain("RETINERE_PLAFONATA");
  });

  it("mai multe rețineri se aplică în ordinea primită, fiecare pe netul rămas", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [
        { suma: 1000, procentMaximDinNet: 0.3 },
        { suma: 1000, procentMaximDinNet: 0.3 },
      ],
    });
    const primaAplicata = Math.min(1000, rezultat.net * 0.3);
    const netDupaPrima = rezultat.net - primaAplicata;
    const aDouaAplicata = Math.min(1000, Math.max(0, rezultat.net * 0.3), netDupaPrima);
    expect(rezultat.retineriTotal).toBeCloseTo(primaAplicata + aDouaAplicata, 2);
  });
});

describe("calculatePayrollEntry — rotunjire", () => {
  it("cu rotunjireLei=true, figurile de titlu sunt numere întregi", () => {
    const rezultat = calculatePayrollEntry({
      settings: { ...SETARI, rotunjireLei: true },
      contract: { salariuBaza: 5033.33, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(Number.isInteger(rezultat.brut)).toBe(true);
    expect(Number.isInteger(rezultat.net)).toBe(true);
    expect(Number.isInteger(rezultat.netDePlata)).toBe(true);
  });
});

describe("calculatePayrollEntry — breakdown", () => {
  it("fiecare pas al calculului apare în breakdown, în ordine", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    const pasi = rezultat.breakdown.map((b) => b.pas);
    expect(pasi).toContain("brut");
    expect(pasi).toContain("net");
    expect(pasi).toContain("netDePlata");
    expect(pasi.indexOf("brut")).toBeLessThan(pasi.indexOf("net"));
  });
});
