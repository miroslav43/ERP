// src/domain/payroll/d112/genereaza.test.ts

import { describe, expect, it } from "vitest";

import { genereazaD112, rotunjesteD112 } from "./genereaza";
import type { AsiguratD112, IntrareD112 } from "./structura";

// CNP valid, verificat cu cifra de control: 1800101410011.
const CNP_VALID = "1800101410013";

const ASIGURAT: AsiguratD112 = {
  cnp: CNP_VALID,
  nume: "Țîrlea",
  prenume: "Ioana",
  dataAngajarii: "2024-03-01",
  dataIncetarii: null,
  tipAsigurat: 1,
  pensionar: false,
  tipContract: "N",
  oreNormaZilnica: 8,
  bazaCam: 5000,
  oreLucrate: 168,
  oreSuspendate: 0,
};

const INTRARE: IntrareD112 = {
  luna: 9,
  an: 2026,
  rectificativa: false,
  declarantNume: "Popescu",
  declarantPrenume: "Ana",
  declarantFunctie: "Administrator",
  angajator: {
    cif: "12345678",
    denumire: 'S.C. "Șantierul" S.R.L.',
    registruComert: "J12/345/2010",
    caen: "4120",
    adresaSediu: "Str. Libertății 1, Cluj-Napoca",
    casaSanatate: "CJ",
    datoreazaCam: true,
  },
  creante: [{ codObligatie: "602", codBugetar: "20A010101", suma: 325.4 }],
  asigurati: [ASIGURAT],
};

describe("rotunjesteD112", () => {
  it("rotunjește aritmetic, cu 0,5 în sus", () => {
    expect(rotunjesteD112(324.5)).toBe(325);
    expect(rotunjesteD112(324.49)).toBe(324);
  });

  it("întregește la 1 leu contribuțiile subunitare — regula explicită din specificație", () => {
    expect(rotunjesteD112(0.4, true)).toBe(1);
    // Fără steagul de contribuție, aceeași valoare devine zero.
    expect(rotunjesteD112(0.4, false)).toBe(0);
  });

  it("nu produce valori negative — D112 cere numere pozitive", () => {
    expect(rotunjesteD112(-100, true)).toBe(0);
  });
});

describe("validarea CNP-ului asiguraților", () => {
  it("BLOCANT: CNP cu o cifră schimbată", () => {
    const r = genereazaD112({
      ...INTRARE,
      asigurati: [{ ...ASIGURAT, cnp: "1800101410012" }],
    });
    expect(r.probleme.some((p) => p.camp === "cnpAsig" && p.blocant)).toBe(true);
  });

  it("refolosește validatorul din domain/hr, deci prinde și data imposibilă", () => {
    // 30 februarie: cifra de control poate fi corectă, data nu există.
    const r = genereazaD112({
      ...INTRARE,
      asigurati: [{ ...ASIGURAT, cnp: "1800230410015" }],
    });
    expect(r.probleme.some((p) => p.camp === "cnpAsig" && p.blocant)).toBe(true);
  });
});

describe("genereazaD112", () => {
  it("produce XML bine format, cu rădăcina declaratieUnica", () => {
    const r = genereazaD112(INTRARE);
    expect(r.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(r.xml).toContain('<declaratieUnica luna_r="9" an_r="2026" d_rec="0"');
    expect(r.xml.trimEnd().endsWith("</declaratieUnica>")).toBe(true);
    expect(r.probleme.filter((p) => p.blocant)).toHaveLength(0);
  });

  it("escapează ghilimelele din denumirea firmei", () => {
    const r = genereazaD112(INTRARE);
    expect(r.xml).toContain("&quot;Șantierul&quot;");
    expect(r.xml).not.toContain('den="S.C. "');
  });

  it("escapează ampersandul, care altfel face fișierul nevalid ca XML", () => {
    const r = genereazaD112({
      ...INTRARE,
      angajator: { ...INTRARE.angajator, denumire: "Alfa & Beta SRL" },
    });
    expect(r.xml).toContain("Alfa &amp; Beta SRL");
  });

  it("numerotează asigurații de la 1, în ordinea primită", () => {
    const alDoilea: AsiguratD112 = { ...ASIGURAT, cnp: "2900202410018", nume: "Ionescu" };
    const r = genereazaD112({ ...INTRARE, asigurati: [ASIGURAT, alDoilea] });
    expect(r.xml).toContain('idAsig="1"');
    expect(r.xml).toContain('idAsig="2"');
    expect(r.nrAsigurati).toBe(2);
  });

  it("omite dataSf când angajatul nu a plecat", () => {
    const r = genereazaD112(INTRARE);
    expect(r.xml).not.toContain("dataSf=");
  });

  it("BLOCANT: norma zilnică diferită de 6, 7 sau 8", () => {
    // Cerința legală permite 4 ore; D112 însă acceptă doar 6/7/8 la A_4, iar
    // timpul parțial se declară prin A_3. Mesajul trebuie să spună asta.
    const r = genereazaD112({
      ...INTRARE,
      asigurati: [{ ...ASIGURAT, oreNormaZilnica: 4 }],
    });
    const problema = r.probleme.find((p) => p.camp === "A_4");
    expect(problema?.blocant).toBe(true);
    expect(problema?.mesaj).toContain("A_3");
  });

  it("ACCEPTĂ norma de 6 ore — cazul cerut explicit de cerință", () => {
    const r = genereazaD112({
      ...INTRARE,
      asigurati: [{ ...ASIGURAT, oreNormaZilnica: 6, tipContract: "P6" }],
    });
    expect(r.probleme.filter((p) => p.blocant)).toHaveLength(0);
    expect(r.xml).toContain('A_4="6"');
  });

  it("BLOCANT: CNP duplicat — specificația cere unicitate", () => {
    const r = genereazaD112({ ...INTRARE, asigurati: [ASIGURAT, ASIGURAT] });
    expect(r.probleme.some((p) => p.camp === "cnpAsig" && p.blocant)).toBe(true);
  });

  it("BLOCANT: fără casa de sănătate a angajatorului", () => {
    const r = genereazaD112({
      ...INTRARE,
      angajator: { ...INTRARE.angajator, casaSanatate: null },
    });
    expect(r.probleme.some((p) => p.camp === "casaAng" && p.blocant)).toBe(true);
  });

  it("BLOCANT: fără nicio creanță de plată", () => {
    const r = genereazaD112({ ...INTRARE, creante: [] });
    expect(r.probleme.some((p) => p.camp === "angajatorA" && p.blocant)).toBe(true);
  });

  it("ATENȚIONARE, nu blocaj: registrul comerțului în alt format", () => {
    const r = genereazaD112({
      ...INTRARE,
      angajator: { ...INTRARE.angajator, registruComert: "ceva" },
    });
    const problema = r.probleme.find((p) => p.camp === "rgCom");
    expect(problema?.blocant).toBe(false);
  });

  it("totalul datorat aplică regula de rotunjire a contribuțiilor", () => {
    const r = genereazaD112({
      ...INTRARE,
      creante: [
        { codObligatie: "602", codBugetar: "20A010101", suma: 325.4 },
        { codObligatie: "412", codBugetar: "20A020101", suma: 0.3 },
      ],
    });
    // 325 + 1 (subunitara se întregește la 1 leu, nu la 0).
    expect(r.totalDatorat).toBe(326);
  });

  it("declarația rectificativă poartă d_rec = 1", () => {
    const r = genereazaD112({ ...INTRARE, rectificativa: true });
    expect(r.xml).toContain('d_rec="1"');
  });
});

describe("suma neimpozabilă de la salariul minim (OUG 89/2025 art. III)", () => {
  const laMinim = (suma: number, bazaCam = 4325): AsiguratD112 => ({
    ...ASIGURAT,
    bazaCam,
    sumaNeimpozabila: suma,
  });

  it("A_5 (baza CAM) se declară fără suma scutită — derogarea de la art. 220^4 alin. (1)", () => {
    const r = genereazaD112({ ...INTRARE, asigurati: [laMinim(200)] });
    expect(r.xml).toContain('A_5="4125"');
  });

  it("rotunjește diferența, nu fiecare termen: fracțiunea de lună dă o sumă cu bani", () => {
    // 4.325 − 183,33 = 4.141,67 → 4.142 (rotunjirea aritmetică din specificație).
    const r = genereazaD112({ ...INTRARE, asigurati: [laMinim(183.33)] });
    expect(r.xml).toContain('A_5="4142"');
  });

  it("baza CAM nu devine negativă, nici dacă suma depășește brutul", () => {
    const r = genereazaD112({ ...INTRARE, asigurati: [laMinim(200, 150)] });
    expect(r.xml).toContain('A_5="0"');
  });

  it("lasă o atenționare NEBLOCANTĂ pe asiguratul cu sumă, cu tipul 51 și rubrica A_13S", () => {
    const r = genereazaD112({ ...INTRARE, asigurati: [laMinim(200)] });
    const p = r.probleme.find((x) => x.camp === "A_1");
    expect(p?.blocant).toBe(false);
    // Numele omului: contabilul trebuie să știe ÎN CARE rând completează.
    expect(p?.mesaj).toContain("Țîrlea Ioana");
    // Codurile citite pe structura ANAF (Nomenclator 5, anexa 4 a ordinului comun)
    // și numele rubricii, nu o formulare vagă.
    expect(p?.mesaj).toContain("51");
    expect(p?.mesaj).toContain("A_13S");
    expect(p?.mesaj).toContain("DUKIntegrator");
    expect(r.probleme.filter((x) => x.blocant)).toHaveLength(0);
  });

  it("trimite la corectarea FIȘIERULUI: DUKIntegrator doar validează și face PDF-ul, nu editează câmpuri", () => {
    const r = genereazaD112({ ...INTRARE, asigurati: [laMinim(200)] });
    const p = r.probleme.find((x) => x.camp === "A_1");
    expect(p?.mesaj).not.toMatch(/în DUKIntegrator înainte/u);
    expect(p?.mesaj).toContain("înainte de validarea cu DUKIntegrator");
  });

  it("câte o atenționare pe asigurat, nu una pe fișier", () => {
    const r = genereazaD112({
      ...INTRARE,
      asigurati: [
        laMinim(200),
        { ...laMinim(200), cnp: "1800101410021", nume: "Pop", prenume: "Ion" },
        { ...ASIGURAT, cnp: "1800101410031", nume: "Dan", prenume: "Ana" },
      ],
    });
    const atentionari = r.probleme.filter((x) => x.camp === "A_1");
    expect(atentionari).toHaveLength(2);
    expect(atentionari.map((x) => x.mesaj).join(" ")).not.toContain("Dan Ana");
  });

  it("fără sumă (absentă sau zero), A_5 rămâne brutul și nu apare nicio atenționare nouă", () => {
    for (const asigurat of [ASIGURAT, { ...ASIGURAT, sumaNeimpozabila: 0 }]) {
      const r = genereazaD112({ ...INTRARE, asigurati: [asigurat] });
      expect(r.xml).toContain('A_5="5000"');
      expect(r.probleme.some((x) => x.camp === "A_1")).toBe(false);
    }
  });
});
