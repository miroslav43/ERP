// src/domain/payroll/calc.facilitate.test.ts
//
// Suma neimpozabilă de la salariul minim (OUG 89/2025 art. III) în motorul
// aplicației. Setările sunt cele LEGALE din `salarizare-publica.ts`, verificate
// pe sursa primară; vectorii 4.325 → 2.699 (cu facilitate) și 2.616 (fără)
// sunt cei publicați pentru a doua jumătate a lui 2026.
import { describe, expect, it } from "vitest";

import { PERIOADE_2026, SETARI_SALARIZARE_PUBLICE } from "@/content/legal/salarizare-publica";
import { calculeazaDinBrut, OPTIUNI_IMPLICITE } from "@/lib/unelte/salariu";
import { calculatePayrollEntry, type PayrollCalcInput } from "./calc";

const LUNA_PLINA = {
  zileLucratoareLuna: 21,
  zileLucrate: 21,
  oreLucrate: 168,
  oreSuplimentare: 0,
  oreNoapte: 0,
  zileConcediuOdihna: 0,
  zileConcediuMedical: 0,
  zileAbsentaNemotivata: 0,
} as const;

function calculeaza(peste: Partial<PayrollCalcInput> = {}) {
  return calculatePayrollEntry({
    settings: SETARI_SALARIZARE_PUBLICE,
    contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0 },
    attendance: LUNA_PLINA,
    bonuses: [],
    deductions: [],
    lunaVenituri: "2026-07",
    ...peste,
  });
}

const spor = (suma: number) => [{ suma, impozabil: true, supusContributii: true }];

describe("motorul aplică suma neimpozabilă de la salariul minim", () => {
  it("4.325 brut în iulie 2026: 200 scutiți, CAS 1.031, CASS 413, impozit 182, net 2.699", () => {
    const r = calculeaza();
    expect(r.sumaNeimpozabila).toBe(200);
    expect(r.brut).toBe(4325);
    expect(r.bazaCas).toBe(4125);
    expect(r.bazaCass).toBe(4125);
    expect(r.cas).toBe(1031);
    expect(r.cass).toBe(413);
    expect(r.deducerePersonala).toBe(865);
    expect(r.impozit).toBe(182);
    expect(r.net).toBe(2699);
  });

  it("CAM pe 4.125, nu pe 4.325 (derogarea de la art. 220^4): 93 de lei, cost total 4.418", () => {
    const r = calculeaza();
    expect(r.camAngajator).toBe(93);
    expect(r.costTotalAngajator).toBe(4418);
  });

  it("rândul intră în calc_breakdown și lasă un avertisment informativ", () => {
    const r = calculeaza();
    expect(r.breakdown).toContainEqual({ pas: "sumaNeimpozabila", valoare: 200 });
    expect(r.warnings.map((w) => w.cod)).toContain("SAL_FACILITATE_SALARIU_MINIM");
  });

  it("fără luna veniturilor, motorul se poartă ca înainte: net 2.616", () => {
    const r = calculatePayrollEntry({
      settings: SETARI_SALARIZARE_PUBLICE,
      contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0 },
      attendance: LUNA_PLINA,
      bonuses: [],
      deductions: [],
    });
    expect(r.sumaNeimpozabila).toBe(0);
    expect(r.net).toBe(2616);
    expect(r.warnings.map((w) => w.cod)).not.toContain("SAL_FACILITATE_SALARIU_MINIM");
  });

  it("din ianuarie 2027 facilitatea nu mai există (alin. (6)): net 2.616, CAM 97", () => {
    const r = calculeaza({ lunaVenituri: "2027-01" });
    expect(r.sumaNeimpozabila).toBe(0);
    expect(r.net).toBe(2616);
    expect(r.camAngajator).toBe(97);
  });

  it("ianuarie–iunie 2026: 300 de lei la minimul de atunci (4.050), net 2.574", () => {
    const r = calculeaza({
      settings: PERIOADE_2026["2026-1"].setari,
      contract: { salariuBaza: 4050, nrPersoaneIntretinere: 0 },
      lunaVenituri: "2026-03",
    });
    expect(r.sumaNeimpozabila).toBe(300);
    expect(r.bazaCas).toBe(3750);
    expect(r.cas).toBe(938);
    expect(r.cass).toBe(375);
    expect(r.impozit).toBe(163);
    expect(r.net).toBe(2574);
  });
});

describe("condițiile, pe intrările reale ale motorului", () => {
  it("un spor care duce brutul la exact 4.600 păstrează suma; 4.601 o pierde", () => {
    const laPlafon = calculeaza({ bonuses: spor(275) });
    expect(laPlafon.brut).toBe(4600);
    expect(laPlafon.sumaNeimpozabila).toBe(200);
    expect(laPlafon.bazaCas).toBe(4400);
    const pestePlafon = calculeaza({ bonuses: spor(276) });
    expect(pestePlafon.sumaNeimpozabila).toBe(0);
    expect(pestePlafon.bazaCas).toBe(4601);
  });

  it("deducerea personală se ia pe brutul ÎNTREG (art. 77 nu e derogat)", () => {
    // 4.600 = minim + 275 ⇒ treapta a 6-a: 20% − 3% = 17% din 4.325 = 735,25 ⇒ 735.
    // Pe 4.400 (brut − 200) ar fi fost treapta a 2-a: 19% ⇒ 822.
    expect(calculeaza({ bonuses: spor(275) }).deducerePersonala).toBe(735);
  });

  it("un avantaj în natură de 300 de lei duce venitul peste 4.600: fără sumă", () => {
    const r = calculeaza({
      bonuses: [{ suma: 300, impozabil: true, supusContributii: true, esteAvantajInNatura: true }],
    });
    expect(r.brut).toBe(4625);
    expect(r.sumaNeimpozabila).toBe(0);
  });

  it("contract cu normă parțială (4 h din 8): fără sumă", () => {
    const r = calculeaza({
      contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0, normaZilnicaOre: 4 },
    });
    expect(r.sumaNeimpozabila).toBe(0);
  });

  it("⚠ minor cu normă întreagă de 6 h: azi NU primește suma (normă întreagă = norma firmei)", () => {
    const r = calculeaza({
      contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0, normaZilnicaOre: 6 },
    });
    expect(r.sumaNeimpozabila).toBe(0);
  });

  it("în afara funcției de bază: nici sumă, nici deducere personală — net 2.530", () => {
    const r = calculeaza({
      contract: { salariuBaza: 4325, nrPersoaneIntretinere: 0, functieDeBaza: false },
    });
    expect(r.sumaNeimpozabila).toBe(0);
    expect(r.deducerePersonala).toBe(0);
    expect(r.net).toBe(2530);
  });

  it("concediul de odihnă ține suma întreagă; ⚠ zilele de concediu medical o diminuează", () => {
    expect(
      calculeaza({ attendance: { ...LUNA_PLINA, zileLucrate: 16, zileConcediuOdihna: 5 } })
        .sumaNeimpozabila,
    ).toBe(200);
    expect(
      calculeaza({ attendance: { ...LUNA_PLINA, zileLucrate: 16, zileConcediuMedical: 5 } })
        .sumaNeimpozabila,
    ).toBe(152.38);
  });

  it("angajat venit pe la jumătatea lunii: 11 din 21 de zile ⇒ 104,76 lei", () => {
    expect(calculeaza({ attendance: { ...LUNA_PLINA, zileLucrate: 11 } }).sumaNeimpozabila).toBe(
      104.76,
    );
  });

  it("baza minimă de contribuții coboară și ea cu 200 de lei în iul.–dec. 2026 (alin. (5))", () => {
    const cuMinim = { ...SETARI_SALARIZARE_PUBLICE, aplicaMinimContributii: true };
    const partial = { salariuBaza: 2162.5, nrPersoaneIntretinere: 0, normaZilnicaOre: 4 };
    expect(calculeaza({ settings: cuMinim, contract: partial }).bazaCas).toBe(4125);
    expect(
      calculeaza({ settings: cuMinim, contract: partial, lunaVenituri: "2027-01" }).bazaCas,
    ).toBe(4325);
    // Salariatul la minim, cu normă întreagă: baza lui de 4.125 NU e ridicată înapoi la 4.325.
    expect(calculeaza({ settings: cuMinim }).bazaCas).toBe(4125);
  });
});

/*
 * Abatere de la planul inițial (D4): „normă întreagă” nu mai înseamnă doar
 * norma ZILNICĂ ≥ norma firmei. De la 63b13746 (12 oct 2026) schema admite
 * timpul parțial lucrat în zile întregi, dar în mai puțin de cinci zile
 * (8 h/zi, 24 h/săpt.): norma zilnică e 8/8, deci regula din plan i-ar fi dat
 * suma unui contract care NU e cu normă întreagă (art. III alin. (1)).
 */
describe("norma săptămânală: timpul parțial în zile întregi nu primește suma", () => {
  it("8 h/zi, dar 24 h/săptămână (trei zile): fără sumă, iar avertismentul normei rămâne", () => {
    const r = calculeaza({
      contract: {
        salariuBaza: 4325,
        nrPersoaneIntretinere: 0,
        normaZilnicaOre: 8,
        normaOreSaptamana: 24,
      },
    });
    expect(r.sumaNeimpozabila).toBe(0);
    expect(r.warnings.map((w) => w.cod)).toContain("NORMA_SUB_CINCI_ZILE");
    expect(r.warnings.map((w) => w.cod)).not.toContain("SAL_FACILITATE_SALARIU_MINIM");
  });

  it("8 h/zi și 40 h/săptămână (cinci zile): normă întreagă, primește suma", () => {
    const r = calculeaza({
      contract: {
        salariuBaza: 4325,
        nrPersoaneIntretinere: 0,
        normaZilnicaOre: 8,
        normaOreSaptamana: 40,
      },
    });
    expect(r.sumaNeimpozabila).toBe(200);
  });
});

/*
 * Calculatorul public (`src/lib/unelte/salariu.ts`) îi trimite motorului luna
 * veniturilor (prima lună a perioadei) și lasă etapa să aplice suma — din D6,
 * nu o mai socotește singur. Aici, pe o lună reală de 21 de zile la salariul
 * minim; paritatea completă, lună cu lună (deduceri, tichete, timp parțial,
 * handicap), e în `src/lib/unelte/salariu.paritate.test.ts`.
 */
describe("paritate cu calculatorul public la salariul minim", () => {
  it.each([
    ["2026-1", "2026-03", 4050],
    ["2026-2", "2026-07", 4325],
    ["2026-2", "2026-12", 4325],
  ] as const)(
    "perioada %s, luna %s, brut %i, 0–4 persoane în întreținere",
    (perioada, luna, brut) => {
      for (const persoane of [0, 1, 2, 3, 4]) {
        const unealta = calculeazaDinBrut(brut, { ...OPTIUNI_IMPLICITE, perioada, persoane });
        const motor = calculeaza({
          settings: PERIOADE_2026[perioada].setari,
          contract: { salariuBaza: brut, nrPersoaneIntretinere: persoane },
          lunaVenituri: luna,
        });
        const eticheta = `${perioada} ${String(persoane)} pers.`;
        expect(motor.sumaNeimpozabila, eticheta).toBe(unealta.sumaNeimpozabila);
        expect(motor.cas, eticheta).toBe(unealta.cas);
        expect(motor.cass, eticheta).toBe(unealta.cass);
        expect(motor.deducerePersonala, eticheta).toBe(unealta.deducerePersonala);
        expect(motor.impozit, eticheta).toBe(unealta.impozit);
        expect(motor.net, eticheta).toBe(unealta.net);
        expect(motor.camAngajator, eticheta).toBe(unealta.cam);
      }
    },
  );
});
