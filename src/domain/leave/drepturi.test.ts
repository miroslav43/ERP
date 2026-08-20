// src/domain/leave/drepturi.test.ts

import { describe, expect, it } from "vitest";
import {
  calculeazaDreptAnual,
  regulileAplicabile,
  type AngajatPentruDrept,
  type RegulaConcediu,
} from "./drepturi";

const ANGAJAT_DE_BAZA: AngajatPentruDrept = {
  hiredOn: new Date(Date.UTC(2015, 0, 10)),
  dataNasterii: null,
  conditiiMunca: "normale",
  gradHandicap: null,
  departmentId: null,
  jobPositionId: null,
};

function regulaVechime(aniMin: number, zileSuplimentare: number): RegulaConcediu {
  return {
    tipCriteriu: "vechime",
    vechimeAniMin: aniMin,
    valoareText: null,
    departmentId: null,
    jobPositionId: null,
    zileSuplimentare,
    activ: true,
    valabilDeLa: new Date(Date.UTC(2024, 0, 1)),
    valabilPanaLa: null,
  };
}

describe("calculeazaDreptAnual", () => {
  it("întoarce doar baza când nu există nicio regulă", () => {
    expect(calculeazaDreptAnual(21, [], ANGAJAT_DE_BAZA, 2026)).toBe(21);
  });

  it("adaugă zilele unei grile de vechime întrunite", () => {
    // angajat din 2015-01-10, la 31.12.2026 are peste 11 ani vechime
    const rezultat = calculeazaDreptAnual(21, [regulaVechime(5, 2)], ANGAJAT_DE_BAZA, 2026);
    expect(rezultat).toBe(23);
  });

  it("nu adaugă o grilă de vechime netrântuită", () => {
    const angajatNou: AngajatPentruDrept = {
      ...ANGAJAT_DE_BAZA,
      hiredOn: new Date(Date.UTC(2024, 5, 1)),
    };
    const rezultat = calculeazaDreptAnual(21, [regulaVechime(5, 2)], angajatNou, 2026);
    expect(rezultat).toBe(21);
  });

  it("pragul de vechime e exact: cu o zi mai puțin nu se aplică, cu vechimea împlinită se aplică", () => {
    // 5 ani exact la 31.12.2026 ar însemna angajare la 31.12.2021.
    const laLimita: AngajatPentruDrept = {
      ...ANGAJAT_DE_BAZA,
      hiredOn: new Date(Date.UTC(2021, 11, 31)),
    };
    expect(calculeazaDreptAnual(21, [regulaVechime(5, 2)], laLimita, 2026)).toBe(23);

    const cuOZiMaiTarziu: AngajatPentruDrept = {
      ...ANGAJAT_DE_BAZA,
      hiredOn: new Date(Date.UTC(2022, 0, 1)),
    };
    expect(calculeazaDreptAnual(21, [regulaVechime(5, 2)], cuOZiMaiTarziu, 2026)).toBe(21);
  });

  it("cumulează mai multe grile întrunite simultan", () => {
    const angajat: AngajatPentruDrept = { ...ANGAJAT_DE_BAZA, conditiiMunca: "deosebite" };
    const reguli: readonly RegulaConcediu[] = [
      regulaVechime(5, 2),
      regulaVechime(10, 4),
      {
        tipCriteriu: "conditii_munca",
        vechimeAniMin: null,
        valoareText: "deosebite",
        departmentId: null,
        jobPositionId: null,
        zileSuplimentare: 3,
        activ: true,
        valabilDeLa: new Date(Date.UTC(2024, 0, 1)),
        valabilPanaLa: null,
      },
    ];
    // 21 (bază) + 2 (vechime ≥5) + 4 (vechime ≥10) + 3 (condiții deosebite) = 30
    expect(calculeazaDreptAnual(21, reguli, angajat, 2026)).toBe(30);
  });

  it("ignoră o regulă inactivă", () => {
    const regula = { ...regulaVechime(5, 2), activ: false };
    expect(calculeazaDreptAnual(21, [regula], ANGAJAT_DE_BAZA, 2026)).toBe(21);
  });

  it("ignoră o regulă expirată înainte de data de referință", () => {
    const regula: RegulaConcediu = {
      ...regulaVechime(5, 2),
      valabilPanaLa: new Date(Date.UTC(2025, 11, 31)),
    };
    expect(calculeazaDreptAnual(21, [regula], ANGAJAT_DE_BAZA, 2026)).toBe(21);
  });

  it("ignoră o regulă care nu a intrat încă în vigoare", () => {
    const regula: RegulaConcediu = {
      ...regulaVechime(5, 2),
      valabilDeLa: new Date(Date.UTC(2027, 0, 1)),
    };
    expect(calculeazaDreptAnual(21, [regula], ANGAJAT_DE_BAZA, 2026)).toBe(21);
  });

  it("varsta_sub_18: exclude angajatul chiar în ziua în care împlinește 18 ani", () => {
    const regula: RegulaConcediu = {
      tipCriteriu: "varsta_sub_18",
      vechimeAniMin: null,
      valoareText: null,
      departmentId: null,
      jobPositionId: null,
      zileSuplimentare: 4,
      activ: true,
      valabilDeLa: new Date(Date.UTC(2024, 0, 1)),
      valabilPanaLa: null,
    };
    // născut 31.12.2008 → împlinește 18 ani exact la 31.12.2026 (data de referință)
    const laLimita: AngajatPentruDrept = {
      ...ANGAJAT_DE_BAZA,
      dataNasterii: new Date(Date.UTC(2008, 11, 31)),
    };
    expect(calculeazaDreptAnual(21, [regula], laLimita, 2026)).toBe(21);

    // născut o zi mai târziu → încă minor la 31.12.2026
    const inca17: AngajatPentruDrept = {
      ...ANGAJAT_DE_BAZA,
      dataNasterii: new Date(Date.UTC(2009, 0, 1)),
    };
    expect(calculeazaDreptAnual(21, [regula], inca17, 2026)).toBe(25);
  });

  it("departament: se aplică doar dacă angajatul e chiar în acel departament", () => {
    const regula: RegulaConcediu = {
      tipCriteriu: "departament",
      vechimeAniMin: null,
      valoareText: null,
      departmentId: "dep-1",
      jobPositionId: null,
      zileSuplimentare: 1,
      activ: true,
      valabilDeLa: new Date(Date.UTC(2024, 0, 1)),
      valabilPanaLa: null,
    };
    const inDepartament: AngajatPentruDrept = { ...ANGAJAT_DE_BAZA, departmentId: "dep-1" };
    const inAltDepartament: AngajatPentruDrept = { ...ANGAJAT_DE_BAZA, departmentId: "dep-2" };
    expect(calculeazaDreptAnual(21, [regula], inDepartament, 2026)).toBe(22);
    expect(calculeazaDreptAnual(21, [regula], inAltDepartament, 2026)).toBe(21);
  });

  it("respinge un an în afara intervalului valid", () => {
    expect(() => calculeazaDreptAnual(21, [], ANGAJAT_DE_BAZA, 1999)).toThrow(RangeError);
  });

  it("respinge o bază negativă", () => {
    expect(() => calculeazaDreptAnual(-1, [], ANGAJAT_DE_BAZA, 2026)).toThrow(RangeError);
  });
});

describe("regulileAplicabile", () => {
  it("întoarce exact regulile care contribuie, ca fișa angajatului să poată explica de ce", () => {
    const potrivita = regulaVechime(5, 2);
    const nepotrivita = regulaVechime(20, 4); // angajat cu ~11 ani vechime, nu îndeplinește
    expect(regulileAplicabile([potrivita, nepotrivita], ANGAJAT_DE_BAZA, 2026)).toEqual([
      potrivita,
    ]);
  });

  it("nu întoarce nimic pentru un angajat fără nicio regulă întrunită", () => {
    expect(regulileAplicabile([regulaVechime(20, 4)], ANGAJAT_DE_BAZA, 2026)).toEqual([]);
  });
});
