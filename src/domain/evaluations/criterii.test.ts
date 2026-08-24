// src/domain/evaluations/criterii.test.ts
import { describe, expect, it } from "vitest";

import {
  atribuieCoduri,
  codDinDenumire,
  completeazaCoduri,
  normalizeazaCriterii,
  valideazaPonderi,
  type CriteriuSablon,
} from "./criterii";

const criteriu = (p: Partial<CriteriuSablon> & { cod: string }): CriteriuSablon => ({
  denumire: p.cod,
  descriere: null,
  tip: "scala",
  scala_max: 5,
  pondere: null,
  ...p,
});

describe("codDinDenumire", () => {
  it("scoate diacriticele românești cu virgulă dedesubt, nu le pierde", () => {
    expect(codDinDenumire("Lucru în echipă")).toBe("lucru_in_echipa");
    // ș (U+0219) și ț (U+021B), cele cerute de proiect
    expect(codDinDenumire("Șansă și înțelegere")).toBe("sansa_si_intelegere");
  });

  it("comprimă semnele în underscore și taie marginile", () => {
    expect(codDinDenumire("  Calitatea   muncii!!  ")).toBe("calitatea_muncii");
  });

  it("se oprește la 80 de caractere", () => {
    expect(codDinDenumire("a".repeat(200))).toHaveLength(80);
  });
});

describe("atribuieCoduri — defectul de deduplicare", () => {
  it("nu mai produce două criterii cu același cod", () => {
    // Exact perechea care rupea lista înainte: același slug, denumiri diferite.
    const coduri = atribuieCoduri(["Calitatea muncii", "Calitatea muncii!"]);
    expect(coduri).toStrictEqual(["calitatea_muncii", "calitatea_muncii_2"]);
    expect(new Set(coduri).size).toBe(2);
  });

  it("numără mai departe la a treia și a patra coliziune", () => {
    expect(atribuieCoduri(["Punctualitate", "punctualitate", "PUNCTUALITATE"])).toStrictEqual([
      "punctualitate",
      "punctualitate_2",
      "punctualitate_3",
    ]);
  });

  it("nu produce niciodată o cheie vidă dintr-o denumire numai din semne", () => {
    expect(atribuieCoduri(["???", "!!!"])).toStrictEqual(["criteriu", "criteriu_2"]);
  });

  it("nu se blochează când sufixul generat există deja în listă", () => {
    const coduri = atribuieCoduri(["Obiectiv", "Obiectiv 2", "Obiectiv"]);
    expect(new Set(coduri).size).toBe(3);
    expect(coduri[2]).not.toBe(coduri[0]);
  });
});

describe("completeazaCoduri", () => {
  it("păstrează codul unui criteriu existent chiar dacă i se schimbă denumirea", () => {
    // Altfel instantaneul evaluărilor vechi ar rămâne pe codul vechi, iar
    // ecranul ar afișa codul brut în loc de denumire.
    expect(
      completeazaCoduri([{ cod: "calitate_munca", denumire: "Calitatea livrabilelor" }]),
    ).toStrictEqual(["calitate_munca"]);
  });

  it("dă cod nou doar criteriilor adăugate, fără să lovească în cele existente", () => {
    expect(
      completeazaCoduri([
        { cod: "punctualitate", denumire: "Punctualitate" },
        { cod: null, denumire: "Punctualitate" },
      ]),
    ).toStrictEqual(["punctualitate", "punctualitate_2"]);
  });
});

describe("normalizeazaCriterii", () => {
  it("ridică forma veche din 0038 la cea nouă", () => {
    expect(
      normalizeazaCriterii([{ cod: "calitate_munca", denumire: "Calitatea muncii", scala_max: 5 }]),
    ).toStrictEqual([
      {
        cod: "calitate_munca",
        denumire: "Calitatea muncii",
        descriere: null,
        tip: "scala",
        scala_max: 5,
        pondere: null,
      },
    ]);
  });

  it("forțează scala lui `da_nu` la 1 și pe a lui `text` la 0", () => {
    const r = normalizeazaCriterii([
      { cod: "a", denumire: "Are permis", tip: "da_nu", scala_max: 7 },
      { cod: "b", denumire: "Observații", tip: "text", scala_max: 5 },
    ]);
    expect(r[0]?.scala_max).toBe(1);
    expect(r[1]?.scala_max).toBe(0);
  });

  it("nu aruncă pe jsonb stricat — sare peste ce nu se poate citi", () => {
    expect(normalizeazaCriterii(null)).toStrictEqual([]);
    expect(normalizeazaCriterii("text")).toStrictEqual([]);
    expect(normalizeazaCriterii({ cod: "a" })).toStrictEqual([]);
    expect(normalizeazaCriterii([42, null, { fara: "denumire" }, { denumire: "   " }])).toStrictEqual(
      [],
    );
  });

  it("generează codul când lipsește din jsonb", () => {
    expect(normalizeazaCriterii([{ denumire: "Inițiativă" }])[0]?.cod).toBe("initiativa");
  });

  it("plafonează ponderea la 100 și respinge valorile negative", () => {
    const r = normalizeazaCriterii([
      { denumire: "A", pondere: 250 },
      { denumire: "B", pondere: -5 },
    ]);
    expect(r[0]?.pondere).toBe(100);
    expect(r[1]?.pondere).toBeNull();
  });
});

describe("valideazaPonderi", () => {
  it("e validă când niciun criteriu nu are pondere", () => {
    const s = valideazaPonderi([criteriu({ cod: "a" }), criteriu({ cod: "b" })]);
    expect(s).toStrictEqual({ arePonderi: false, total: 0, valida: true, fara: [] });
  });

  it("e validă când toate au pondere și suma dă 100", () => {
    const s = valideazaPonderi([
      criteriu({ cod: "a", pondere: 60 }),
      criteriu({ cod: "b", pondere: 40 }),
    ]);
    expect(s.valida).toBe(true);
    expect(s.total).toBe(100);
  });

  it("e invalidă când suma nu dă 100", () => {
    const s = valideazaPonderi([
      criteriu({ cod: "a", pondere: 30 }),
      criteriu({ cod: "b", pondere: 40 }),
    ]);
    expect(s.valida).toBe(false);
    expect(s.total).toBe(70);
  });

  it("e invalidă când doar o parte au pondere, și spune care lipsesc", () => {
    const s = valideazaPonderi([
      criteriu({ cod: "a", denumire: "Calitate", pondere: 100 }),
      criteriu({ cod: "b", denumire: "Punctualitate" }),
    ]);
    expect(s.valida).toBe(false);
    expect(s.fara).toStrictEqual(["Punctualitate"]);
  });

  it("nu cere pondere criteriilor de tip text — nu se punctează", () => {
    const s = valideazaPonderi([
      criteriu({ cod: "a", pondere: 100 }),
      criteriu({ cod: "obs", denumire: "Observații", tip: "text", scala_max: 0 }),
    ]);
    expect(s.valida).toBe(true);
    expect(s.fara).toStrictEqual([]);
  });
});
