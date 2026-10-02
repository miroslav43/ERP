// src/domain/leave/drepturi.lacune.test.ts
//
// Lacuna confirmată de audit: criteriile `grad_handicap` și `functie` (cod COR)
// și angajatul fără dată de angajare nu aveau niciun test. Zilele suplimentare
// de mai jos (+3, +2) sunt ILUSTRATIVE; valorile reale vin din
// `leave_entitlement_rules` și sunt ⚠ în NOTES.md §3 Concedii.

import { describe, expect, it } from "vitest";

import {
  calculeazaDreptAnual,
  regulileAplicabile,
  type AngajatPentruDrept,
  type RegulaConcediu,
} from "./drepturi";

const BAZA = 21;
const AN = 2026;

function regula(peste: Partial<RegulaConcediu>): RegulaConcediu {
  return {
    tipCriteriu: "vechime",
    vechimeAniMin: null,
    valoareText: null,
    departmentId: null,
    codCor: null,
    zileSuplimentare: 0,
    activ: true,
    valabilDeLa: new Date(Date.UTC(2020, 0, 1)),
    valabilPanaLa: null,
    ...peste,
  };
}

function angajat(peste: Partial<AngajatPentruDrept> = {}): AngajatPentruDrept {
  return {
    hiredOn: new Date(Date.UTC(2015, 0, 1)),
    dataNasterii: new Date(Date.UTC(1990, 0, 1)),
    conditiiMunca: "normale",
    gradHandicap: null,
    departmentId: null,
    codCor: null,
    ...peste,
  };
}

describe("calculeazaDreptAnual — gradul de handicap", () => {
  const HANDICAP_GRAV = regula({
    tipCriteriu: "grad_handicap",
    valoareText: "grav",
    zileSuplimentare: 3,
  });

  it.each([
    { grad: "grav", asteptat: 24 },
    { grad: "accentuat", asteptat: 21 },
    { grad: null, asteptat: 21 },
  ])("gradul $grad dă $asteptat zile", ({ grad, asteptat }) => {
    expect(calculeazaDreptAnual(BAZA, [HANDICAP_GRAV], angajat({ gradHandicap: grad }), AN)).toBe(
      asteptat,
    );
  });

  it("o regulă de handicap fără valoare nu se potrivește nici cu un angajat fără grad", () => {
    const faraValoare = regula({ tipCriteriu: "grad_handicap", zileSuplimentare: 3 });
    expect(regulileAplicabile([faraValoare], angajat(), AN)).toEqual([]);
  });
});

describe("calculeazaDreptAnual — funcția, după codul COR", () => {
  const SUDOR = regula({ tipCriteriu: "functie", codCor: "721208", zileSuplimentare: 2 });

  it.each([
    { codCor: "721208", asteptat: 23 },
    { codCor: "721209", asteptat: 21 },
    { codCor: null, asteptat: 21 },
  ])("codul COR $codCor dă $asteptat zile", ({ codCor, asteptat }) => {
    expect(calculeazaDreptAnual(BAZA, [SUDOR], angajat({ codCor }), AN)).toBe(asteptat);
  });
});

describe("calculeazaDreptAnual — angajat fără dată de angajare", () => {
  it("vechimea e zero, deci grila de 5 ani nu se aplică", () => {
    const vechime5 = regula({ tipCriteriu: "vechime", vechimeAniMin: 5, zileSuplimentare: 2 });
    expect(calculeazaDreptAnual(BAZA, [vechime5], angajat({ hiredOn: null }), AN)).toBe(21);
    // Contra-probă: același angajat, cu vechime de 11 ani, o primește.
    expect(calculeazaDreptAnual(BAZA, [vechime5], angajat(), AN)).toBe(23);
  });
});
