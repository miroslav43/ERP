// src/domain/evaluations/kpi.test.ts

import { describe, expect, it } from "vitest";

import {
  PROCENT_MAXIM,
  calculeazaScorLunar,
  procentLinie,
  tintaEfectiva,
  type LinieKpi,
} from "./kpi";

function masurat(p: Partial<LinieKpi> = {}): LinieKpi {
  return {
    cod: "vizite",
    tip: "masurat",
    sens: "crestere",
    pondere: 100,
    scala_max: null,
    tinta: 40,
    realizat: null,
    nota: null,
    ...p,
  };
}

function apreciat(p: Partial<LinieKpi> = {}): LinieKpi {
  return {
    cod: "atitudine",
    tip: "apreciat",
    sens: null,
    pondere: 100,
    scala_max: 5,
    tinta: null,
    realizat: null,
    nota: null,
    ...p,
  };
}

describe("procentLinie — indicator măsurat, sens crescător", () => {
  it("raportează realizatul la țintă", () => {
    expect(procentLinie(masurat({ realizat: 37 }))).toBe(92.5);
  });

  it("trece de 100 % când ținta e depășită", () => {
    expect(procentLinie(masurat({ tinta: 8, realizat: 9 }))).toBe(112.5);
  });

  it("întoarce null cât timp nu s-a completat nimic", () => {
    expect(procentLinie(masurat())).toBeNull();
  });

  it("refuză o țintă de zero — nu există raport la zero pe creștere", () => {
    expect(procentLinie(masurat({ tinta: 0, realizat: 5 }))).toBeNull();
  });

  it("nu coboară sub zero la realizat negativ", () => {
    expect(procentLinie(masurat({ realizat: -10 }))).toBe(0);
  });

  it("plafonează la limita coloanei numeric(6,2)", () => {
    expect(procentLinie(masurat({ tinta: 0.01, realizat: 1000 }))).toBe(PROCENT_MAXIM);
  });
});

describe("procentLinie — indicator măsurat, sens descrescător", () => {
  // „Rebut: maxim 2 %." Realizat 1,4 % e MAI BUN decât ținta, deci peste 100 %.
  it("dă peste 100 % când realizatul e sub țintă", () => {
    expect(procentLinie(masurat({ sens: "descrestere", tinta: 2, realizat: 1.4 }))).toBe(130);
  });

  it("dă exact 100 % pe țintă atinsă", () => {
    expect(procentLinie(masurat({ sens: "descrestere", tinta: 2, realizat: 2 }))).toBe(100);
  });

  it("dă 200 % la realizat zero — maximul formulei, fără împărțire la zero", () => {
    expect(procentLinie(masurat({ sens: "descrestere", tinta: 2, realizat: 0 }))).toBe(200);
  });

  it("dă zero la dublul țintei și nu coboară mai jos", () => {
    expect(procentLinie(masurat({ sens: "descrestere", tinta: 2, realizat: 4 }))).toBe(0);
    expect(procentLinie(masurat({ sens: "descrestere", tinta: 2, realizat: 40 }))).toBe(0);
  });

  it("tratează ținta zero ca prag absolut: atins sau ratat", () => {
    expect(procentLinie(masurat({ sens: "descrestere", tinta: 0, realizat: 0 }))).toBe(100);
    expect(procentLinie(masurat({ sens: "descrestere", tinta: 0, realizat: 1 }))).toBe(0);
  });
});

describe("procentLinie — indicator apreciat", () => {
  it("raportează nota la scală", () => {
    expect(procentLinie(apreciat({ nota: 4 }))).toBe(80);
    expect(procentLinie(apreciat({ nota: 5 }))).toBe(100);
  });

  it("întoarce null cât timp nu s-a notat", () => {
    expect(procentLinie(apreciat())).toBeNull();
  });

  it("plafonează o notă peste scală în loc să cadă", () => {
    expect(procentLinie(apreciat({ nota: 8 }))).toBe(100);
  });

  it("întoarce null pe o scală absentă sau nulă", () => {
    expect(procentLinie(apreciat({ nota: 4, scala_max: null }))).toBeNull();
    expect(procentLinie(apreciat({ nota: 4, scala_max: 0 }))).toBeNull();
  });
});

describe("calculeazaScorLunar", () => {
  it("mediază ponderat liniile completate", () => {
    const scor = calculeazaScorLunar([
      masurat({ cod: "vizite", pondere: 40, tinta: 40, realizat: 40 }), // 100 %
      masurat({ cod: "contracte", pondere: 30, tinta: 10, realizat: 8 }), // 80 %
      apreciat({ cod: "atitudine", pondere: 30, nota: 5 }), // 100 %
    ]);
    // 0,4·100 + 0,3·80 + 0,3·100 = 94
    expect(scor.procent).toBe(94);
    expect(scor.completate).toBe(3);
    expect(scor.necompletate).toBe(0);
  });

  // Miezul deciziei: o linie necompletată pe 15 ale lunii NU trage scorul în jos.
  it("renormalizează ponderile peste liniile completate", () => {
    const scor = calculeazaScorLunar([
      masurat({ cod: "vizite", pondere: 40, tinta: 40, realizat: 40 }), // 100 %
      masurat({ cod: "contracte", pondere: 30, tinta: 10, realizat: 8 }), // 80 %
      apreciat({ cod: "atitudine", pondere: 30 }), // necompletat
    ]);
    // (0,4·100 + 0,3·80) / 0,7 = 91,4 — nu 68, cum ar ieși cu zero pe linia goală
    expect(scor.procent).toBe(91.4);
    expect(scor.completate).toBe(2);
    expect(scor.necompletate).toBe(1);
  });

  it("întoarce null când nu s-a completat nimic", () => {
    const scor = calculeazaScorLunar([masurat(), apreciat()]);
    expect(scor.procent).toBeNull();
    expect(scor.completate).toBe(0);
    expect(scor.necompletate).toBe(2);
  });

  it("întoarce null pe listă goală", () => {
    expect(calculeazaScorLunar([]).procent).toBeNull();
  });

  // O linie cu pondere zero e o linie pe care managerul o urmărește fără s-o
  // pună la socoteală. Nu trebuie să surpe media și nu trebuie să dea NaN.
  it("ignoră liniile de pondere zero fără să producă NaN", () => {
    const scor = calculeazaScorLunar([
      masurat({ cod: "vizite", pondere: 100, tinta: 40, realizat: 40 }),
      masurat({ cod: "info", pondere: 0, tinta: 10, realizat: 1 }),
    ]);
    expect(scor.procent).toBe(100);
  });

  it("întoarce null când toate liniile completate au pondere zero", () => {
    const scor = calculeazaScorLunar([masurat({ pondere: 0, tinta: 40, realizat: 40 })]);
    expect(scor.procent).toBeNull();
  });
});

describe("tintaEfectiva", () => {
  it("preferă abaterea angajatului", () => {
    expect(tintaEfectiva(40, 25)).toBe(25);
  });

  it("cade pe ținta funcției când nu există abatere", () => {
    expect(tintaEfectiva(40, null)).toBe(40);
  });

  // Zero e o țintă legitimă („zero accidente"), nu o valoare lipsă.
  it("tratează abaterea zero ca abatere, nu ca absență", () => {
    expect(tintaEfectiva(40, 0)).toBe(0);
  });
});
