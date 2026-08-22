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

describe("calculatePayrollEntry — scutiri fiscale (ex. cod CAEN IT)", () => {
  it("fără scutire, baza de impozit rămâne neschimbată", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.scutireFiscala).toBe(0);
    expect(rezultat.bazaImpozit).toBeCloseTo(5000 - 1250 - 500, 2);
  });

  it("o scutire sub plafon reduce baza de impozit cu procentul aplicat pe brut", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: {
        salariuBaza: 5000,
        nrPersoaneIntretinere: 0,
        exemptii: [{ procentScutire: 0.1, plafonLunar: null }],
      },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.scutireFiscala).toBeCloseTo(5000 * 0.1, 2);
    expect(rezultat.bazaImpozit).toBeCloseTo(5000 - 1250 - 500 - 500, 2);
    expect(rezultat.warnings.map((w) => w.cod)).not.toContain("SCUTIRI_FISCALE_MULTIPLE");
  });

  it("un plafon lunar sub brut limitează baza scutibilă", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: {
        salariuBaza: 5000,
        nrPersoaneIntretinere: 0,
        exemptii: [{ procentScutire: 0.1, plafonLunar: 3000 }],
      },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.scutireFiscala).toBeCloseTo(3000 * 0.1, 2);
  });

  it("baza de impozit nu scade sub zero când scutirea depășește baza", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: {
        salariuBaza: 5000,
        nrPersoaneIntretinere: 0,
        exemptii: [{ procentScutire: 1, plafonLunar: null }],
      },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.bazaImpozit).toBe(0);
    expect(rezultat.impozit).toBe(0);
  });

  it("mai multe scutiri active simultan se însumează și avertizează", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: {
        salariuBaza: 5000,
        nrPersoaneIntretinere: 0,
        exemptii: [
          { procentScutire: 0.1, plafonLunar: null },
          { procentScutire: 0.05, plafonLunar: null },
        ],
      },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.scutireFiscala).toBeCloseTo(5000 * 0.15, 2);
    expect(rezultat.warnings.map((w) => w.cod)).toContain("SCUTIRI_FISCALE_MULTIPLE");
  });

  it("o scutire fără procent configurat nu se aplică automat, dar avertizează", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: {
        salariuBaza: 5000,
        nrPersoaneIntretinere: 0,
        exemptii: [{ procentScutire: null, plafonLunar: null }],
      },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.scutireFiscala).toBe(0);
    expect(rezultat.warnings.map((w) => w.cod)).toContain("SCUTIRE_FARA_PROCENT");
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

describe("calculatePayrollEntry — normă parțială", () => {
  const PONTAJ_CU_SUPLIMENTARE = {
    ...PONTAJ_STANDARD,
    oreLucrate: 84,
    oreSuplimentare: 2,
    oreNoapte: 4,
  } as const;

  it("tariful orar se calculează la norma DIN CONTRACT, nu la cea a organizației", () => {
    // Setările organizației spun 8 ore; contractul spune 4. Un angajat cu
    // jumătate de normă are tariful orar dublu față de cel calculat pe 8 ore,
    // fiindcă același salariu se împarte la jumătate din ore.
    const laNormaOrganizatiei = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_CU_SUPLIMENTARE,
      bonuses: [],
      deductions: [],
    });
    const laNormaContractului = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0, normaZilnicaOre: 4 },
      attendance: PONTAJ_CU_SUPLIMENTARE,
      bonuses: [],
      deductions: [],
    });

    // Toleranța de un ban NU e neglijență: fiecare rezultat se rotunjește
    // separat, iar dublul unei sume rotunjite nu e rotunjirea dublului
    // (104,17 x 2 = 208,34, dar 208,33... se rotunjește la 208,33). Exact
    // motivul pentru care aritmetica trebuie mutată pe bani întregi.
    const UN_BAN = 0.01;
    expect(
      Math.abs(
        laNormaContractului.sumaOreSuplimentare - laNormaOrganizatiei.sumaOreSuplimentare * 2,
      ),
    ).toBeLessThanOrEqual(UN_BAN);
    expect(
      Math.abs(laNormaContractului.sporNoapte - laNormaOrganizatiei.sporNoapte * 2),
    ).toBeLessThanOrEqual(UN_BAN);
    // Ancoră absolută, ca testul să nu treacă dacă AMBELE variante se strică:
    // 2 ore x (5000 / (21 x 4)) x 1,75 = 208,33 lei.
    expect(laNormaContractului.sumaOreSuplimentare).toBeCloseTo(208.33, 2);
    expect(laNormaOrganizatiei.sumaOreSuplimentare).toBeCloseTo(104.17, 2);
  });

  it("norma lipsă din contract cade pe cea a organizației, fără să schimbe rezultatul", () => {
    const fara = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_CU_SUPLIMENTARE,
      bonuses: [],
      deductions: [],
    });
    const cuAceeasi = calculatePayrollEntry({
      settings: SETARI,
      contract: {
        salariuBaza: 5000,
        nrPersoaneIntretinere: 0,
        normaZilnicaOre: SETARI.normaZilnicaOre,
      },
      attendance: PONTAJ_CU_SUPLIMENTARE,
      bonuses: [],
      deductions: [],
    });
    expect(cuAceeasi).toEqual(fara);
  });

  it("o normă zero în contract e respinsă, nu ignorată tăcut", () => {
    expect(() =>
      calculatePayrollEntry({
        settings: SETARI,
        contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0, normaZilnicaOre: 0 },
        attendance: PONTAJ_STANDARD,
        bonuses: [],
        deductions: [],
      }),
    ).toThrow(RangeError);
  });

  it("baza de salariu NU depinde de normă — ea se plătește pe zile, nu pe ore", () => {
    const intreaga = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0, normaZilnicaOre: 8 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    const partiala = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0, normaZilnicaOre: 4 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    // Salariul de bază al unui part-time e deja mai mic în contract; motorul nu
    // îl mai reduce o dată. Confuzia asta ar înjumătăți salarii reale.
    expect(partiala.bazaSalariu).toBe(intreaga.bazaSalariu);
  });
});

describe("calculatePayrollEntry — zile de repaus și de sărbătoare", () => {
  // Tariful orar: 5000 / (21 x 8) = 29,7619 lei.
  const cuSpor = (repaus: number, sarbatoare?: number): PayrollSettingsSnapshot => ({
    ...SETARI,
    procentSporWeekend: repaus,
    ...(sarbatoare === undefined ? {} : { procentSporSarbatoare: sarbatoare }),
  });

  it("DEFECTUL REPARAT: o sâmbătă lucrată este plătită, nu ignorată", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileRepausLucrate: 1, oreNormaleRepaus: 8 },
      bonuses: [],
      deductions: [],
    });
    // Fără spor configurat, orele se plătesc măcar la tariful orar simplu:
    // 8 x 29,7619 = 238,10 lei. Varianta veche plătea ZERO.
    expect(rezultat.sporRepaus).toBeCloseTo(238.1, 2);
    expect(rezultat.oreRepaus).toBe(8);
    expect(rezultat.brut).toBeCloseTo(5238.1, 2);
  });

  it("sporul configurat pentru repaus se aplică peste tariful orar", () => {
    const rezultat = calculatePayrollEntry({
      settings: cuSpor(1),
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileRepausLucrate: 1, oreNormaleRepaus: 8 },
      bonuses: [],
      deductions: [],
    });
    // 8 x 29,7619 x (1 + 1,00) = 476,19 lei.
    expect(rezultat.sporRepaus).toBeCloseTo(476.19, 2);
  });

  it("regula MAXIM, nu sumă: sporul de repaus și cel de ore suplimentare nu se cumulează", () => {
    const rezultat = calculatePayrollEntry({
      settings: cuSpor(1),
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileRepausLucrate: 1, oreSuplimentareRepaus: 2 },
      bonuses: [],
      deductions: [],
    });
    // 2 x 29,7619 x (1 + max(1,00; 0,75)) = 119,05 lei.
    expect(rezultat.sporRepaus).toBeCloseTo(119.05, 2);
    // Dacă s-ar însuma (1 + 1,00 + 0,75), ar ieși 163,69 — greșit.
    expect(rezultat.sporRepaus).not.toBeCloseTo(163.69, 2);
  });

  it("zilele de repaus NU cresc zilele plătite din salariul de bază", () => {
    const fara = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    const cu = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileRepausLucrate: 2, oreNormaleRepaus: 16 },
      bonuses: [],
      deductions: [],
    });
    // Altfel zilele plătite ar depăși zilele lucrătoare ale lunii și calculul
    // s-ar opri — sau, mai rău, ar plăti de două ori aceeași zi.
    expect(cu.bazaSalariu).toBe(fara.bazaSalariu);
  });

  it("sporurile intră în brut ȘI în baza de contribuții", () => {
    const rezultat = calculatePayrollEntry({
      settings: cuSpor(1),
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileSarbatoareLucrate: 1, oreNormaleSarbatoare: 8 },
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.bazaCasCass).toBeCloseTo(rezultat.brut, 2);
    expect(rezultat.cas).toBeCloseTo(rezultat.brut * 0.25, 2);
  });

  it("sărbătoarea fără procent propriu e plătită cu cel de repaus și avertizează", () => {
    const rezultat = calculatePayrollEntry({
      settings: cuSpor(1),
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileSarbatoareLucrate: 1, oreNormaleSarbatoare: 8 },
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.sporSarbatoare).toBeCloseTo(476.19, 2);
    expect(rezultat.warnings.map((w) => w.cod)).toContain("SAL_SPOR_SARBATOARE_NECONFIGURAT");
  });

  it("cu procent propriu de sărbătoare, avertismentul dispare și suma se schimbă", () => {
    const rezultat = calculatePayrollEntry({
      settings: cuSpor(1, 2),
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileSarbatoareLucrate: 1, oreNormaleSarbatoare: 8 },
      bonuses: [],
      deductions: [],
    });
    // 8 x 29,7619 x (1 + 2,00) = 714,29 lei.
    expect(rezultat.sporSarbatoare).toBeCloseTo(714.29, 2);
    expect(rezultat.warnings.map((w) => w.cod)).not.toContain("SAL_SPOR_SARBATOARE_NECONFIGURAT");
  });

  it("avertizează când s-a lucrat în repaus dar sporul e zero", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileRepausLucrate: 1, oreNormaleRepaus: 8 },
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.warnings.map((w) => w.cod)).toContain("SAL_SPOR_REPAUS_NECONFIGURAT");
  });

  it("o lună fără muncă în repaus nu produce niciun avertisment despre sporuri", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    const coduri = rezultat.warnings.map((w) => w.cod);
    expect(coduri).not.toContain("SAL_SPOR_REPAUS_NECONFIGURAT");
    expect(coduri).not.toContain("SAL_SPOR_SARBATOARE_NECONFIGURAT");
    expect(rezultat.sporRepaus).toBe(0);
    expect(rezultat.sporSarbatoare).toBe(0);
  });
});

describe("calculatePayrollEntry — baza CAS separată de baza CASS", () => {
  const CU_TICHETE = { ...SETARI, valoareTichetMasa: 30 };

  it("tichetele nu intră în baza de pensie, dar intră în cea de sănătate când e activat", () => {
    const rezultat = calculatePayrollEntry({
      settings: { ...CU_TICHETE, ticheteSupuseCass: true },
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    // 21 de zile x 30 lei = 630 lei în tichete.
    expect(rezultat.valoareTichete).toBe(630);
    expect(rezultat.bazaCass - rezultat.bazaCas).toBeCloseTo(630, 2);
    expect(rezultat.cas).toBeCloseTo(rezultat.bazaCas * 0.25, 2);
    expect(rezultat.cass).toBeCloseTo(rezultat.bazaCass * 0.1, 2);
  });

  it("implicit, comutatorul e stins și cele două baze coincid", () => {
    const rezultat = calculatePayrollEntry({
      settings: CU_TICHETE,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    // Deliberat: o valoare implicită „true" ar schimba tăcut netul tuturor.
    expect(rezultat.bazaCass).toBe(rezultat.bazaCas);
  });

  it("o componentă poate intra în baza de sănătate fără să intre în cea de pensie", () => {
    const rezultat = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [{ suma: 400, impozabil: true, supusContributii: true, intraInBazaCas: false }],
      deductions: [],
    });
    expect(rezultat.bazaCas).toBeCloseTo(5000, 2);
    expect(rezultat.bazaCass).toBeCloseTo(5400, 2);
  });

  it("steagurile lipsă cad pe `supusContributii`, deci apelanții vechi nu se schimbă", () => {
    const cuSteaguri = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [
        {
          suma: 400,
          impozabil: true,
          supusContributii: true,
          intraInBazaCas: true,
          intraInBazaCass: true,
        },
      ],
      deductions: [],
    });
    const faraSteaguri = calculatePayrollEntry({
      settings: SETARI,
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [{ suma: 400, impozabil: true, supusContributii: true }],
      deductions: [],
    });
    expect(cuSteaguri).toEqual(faraSteaguri);
  });

  it("`bazaCasCass` rămâne egal cu `bazaCas`, ca ecranele existente să nu se rupă", () => {
    const rezultat = calculatePayrollEntry({
      settings: { ...CU_TICHETE, ticheteSupuseCass: true },
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.bazaCasCass).toBe(rezultat.bazaCas);
  });

  it("avertizează despre regimul tichetelor doar când setările nu sunt confirmate", () => {
    const neconfirmat = calculatePayrollEntry({
      settings: { ...CU_TICHETE, verificatDeContabil: false },
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    const confirmat = calculatePayrollEntry({
      settings: { ...CU_TICHETE, verificatDeContabil: true },
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(neconfirmat.warnings.map((w) => w.cod)).toContain("SAL_TICHETE_REGIM_NECONFIRMAT");
    expect(confirmat.warnings.map((w) => w.cod)).not.toContain("SAL_TICHETE_REGIM_NECONFIRMAT");
  });

  it("fără tichete, avertismentul nu apare nici dacă setările sunt neconfirmate", () => {
    const rezultat = calculatePayrollEntry({
      settings: { ...SETARI, valoareTichetMasa: 0, verificatDeContabil: false },
      contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
      attendance: PONTAJ_STANDARD,
      bonuses: [],
      deductions: [],
    });
    expect(rezultat.warnings.map((w) => w.cod)).not.toContain("SAL_TICHETE_REGIM_NECONFIRMAT");
  });
});
