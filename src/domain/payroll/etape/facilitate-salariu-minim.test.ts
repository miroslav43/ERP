// src/domain/payroll/etape/facilitate-salariu-minim.test.ts
import { describe, expect, it } from "vitest";

import { problema } from "../erori";
import {
  calculeazaFacilitateSalariuMinim,
  FACILITATE_IULIE_DECEMBRIE_2026,
  facilitatePentruLuna,
  PAS_SUMA_NEIMPOZABILA,
  PERIOADE_FACILITATE_SALARIU_MINIM,
  sumaNeimpozabilaDinBreakdown,
  type IntrareFacilitate,
} from "./facilitate-salariu-minim";

const LA_MINIM_IULIE: IntrareFacilitate = {
  luna: "2026-07",
  salariuBaza: 4325,
  venitBrut: 4325,
  normaIntreaga: true,
  functieDeBaza: true,
  zileCuVenitSalarial: 21,
  zileLucratoareLuna: 21,
};

describe("perioadele facilității (OUG 89/2025 art. III alin. (1) și (6))", () => {
  it("ianuarie–iunie 2026: 300 de lei, minim 4.050, plafon 4.300", () => {
    expect(facilitatePentruLuna("2026-01")).toMatchObject({
      suma: 300,
      salariuMinim: 4050,
      plafonVenitBrut: 4300,
    });
    expect(facilitatePentruLuna("2026-06")?.suma).toBe(300);
  });

  it("iulie–decembrie 2026: 200 de lei, minim 4.325, plafon 4.600", () => {
    expect(facilitatePentruLuna("2026-07")).toBe(FACILITATE_IULIE_DECEMBRIE_2026);
    expect(facilitatePentruLuna("2026-12")).toMatchObject({
      suma: 200,
      salariuMinim: 4325,
      plafonVenitBrut: 4600,
    });
  });

  it("nimic în afara lui 2026 și nimic pentru o lună scrisă greșit", () => {
    for (const luna of ["2025-12", "2027-01", "2026-13", "2026-7", "", "iulie"]) {
      expect(facilitatePentruLuna(luna), luna).toBeNull();
    }
  });

  it("perioadele nu se suprapun și fiecare își numește temeiul", () => {
    const sortate = [...PERIOADE_FACILITATE_SALARIU_MINIM].sort((a, b) =>
      a.valabilDeLa.localeCompare(b.valabilDeLa),
    );
    sortate.forEach((p, i) => {
      const anterioara = sortate[i - 1];
      if (anterioara !== undefined) expect(p.valabilDeLa > anterioara.valabilPana).toBe(true);
      expect(p.temei).toContain("OUG 89/2025");
    });
  });
});

describe("condițiile cumulative (alin. (1) lit. a) și b))", () => {
  it("la minim, normă întreagă, funcția de bază, lună întreagă: 200 de lei", () => {
    const r = calculeazaFacilitateSalariuMinim(LA_MINIM_IULIE);
    expect(r.suma).toBe(200);
    expect(r.motiv).toBeNull();
    expect(r.probleme.map((p) => p.cod)).toEqual(["SAL_FACILITATE_SALARIU_MINIM"]);
  });

  it.each([
    ["salariul de bază peste minim", { salariuBaza: 4326 }, "salariu_diferit_de_minim"],
    ["salariul de bază sub minim", { salariuBaza: 4050 }, "salariu_diferit_de_minim"],
    ["venitul brut peste 4.600", { venitBrut: 4600.01 }, "venit_peste_plafon"],
    ["normă parțială", { normaIntreaga: false }, "norma_partiala"],
    ["în afara funcției de bază", { functieDeBaza: false }, "functie_secundara"],
    ["nicio zi cu venit salarial", { zileCuVenitSalarial: 0 }, "fara_zile_platite"],
    ["o lună din 2027", { luna: "2027-01" }, "luna_fara_facilitate"],
  ] as const)("%s ⇒ 0 lei", (_, peste, motiv) => {
    const r = calculeazaFacilitateSalariuMinim({ ...LA_MINIM_IULIE, ...peste });
    expect(r.suma).toBe(0);
    expect(r.motiv).toBe(motiv);
    expect(r.probleme).toEqual([]);
  });

  it("plafonul e inclusiv: exact 4.600 de lei primește încă suma", () => {
    expect(calculeazaFacilitateSalariuMinim({ ...LA_MINIM_IULIE, venitBrut: 4600 }).suma).toBe(200);
  });

  it("în ianuarie–iunie condiția e minimul de atunci (4.050), iar suma e 300", () => {
    const r = calculeazaFacilitateSalariuMinim({
      ...LA_MINIM_IULIE,
      luna: "2026-03",
      salariuBaza: 4050,
      venitBrut: 4300,
    });
    expect(r.suma).toBe(300);
  });

  it("salariul de 4.050 NU primește suma în iulie (minimul lunii e 4.325), nici cel de 4.325 în martie", () => {
    expect(
      calculeazaFacilitateSalariuMinim({ ...LA_MINIM_IULIE, salariuBaza: 4050, venitBrut: 4050 })
        .motiv,
    ).toBe("salariu_diferit_de_minim");
    expect(calculeazaFacilitateSalariuMinim({ ...LA_MINIM_IULIE, luna: "2026-03" }).motiv).toBe(
      "salariu_diferit_de_minim",
    );
  });
});

describe("diminuarea pe fracțiunea de lună (alin. (4))", () => {
  it("angajat venit pe la jumătatea lunii: suma scade proporțional, la ban", () => {
    const r = calculeazaFacilitateSalariuMinim({
      ...LA_MINIM_IULIE,
      venitBrut: 2265.48,
      zileCuVenitSalarial: 11,
      zileLucratoareLuna: 21,
    });
    expect(r.suma).toBe(104.76);
    expect(r.probleme[0]?.detalii).toContain("11/21");
  });

  it("mai multe zile decât are luna nu dau mai mult decât suma întreagă", () => {
    expect(
      calculeazaFacilitateSalariuMinim({ ...LA_MINIM_IULIE, zileCuVenitSalarial: 25 }).suma,
    ).toBe(200);
  });
});

describe("citirea sumei din calc_breakdown salvat", () => {
  it("găsește pasul motorului", () => {
    expect(
      sumaNeimpozabilaDinBreakdown([
        { pas: "brut", valoare: 4325 },
        { pas: PAS_SUMA_NEIMPOZABILA, valoare: 200 },
      ]),
    ).toBe(200);
  });

  it("rândurile vechi, fără pas, sau un JSON stricat dau 0, fără să arunce", () => {
    for (const v of [
      null,
      undefined,
      {},
      "x",
      [],
      [{ pas: PAS_SUMA_NEIMPOZABILA, valoare: "200" }],
      [{ pas: PAS_SUMA_NEIMPOZABILA, valoare: -5 }],
    ]) {
      expect(sumaNeimpozabilaDinBreakdown(v)).toBe(0);
    }
  });

  it("numele pasului e cel scris de motor", () => {
    expect(PAS_SUMA_NEIMPOZABILA).toBe("sumaNeimpozabila");
  });
});

describe("catalogul", () => {
  it("codul etapei e informativ și îi spune omului ce să verifice", () => {
    const p = problema("SAL_FACILITATE_SALARIU_MINIM");
    expect(p.severitate).toBe("informativ");
    expect(p.cumSeRepara).toContain("funcția de bază");
  });
});
