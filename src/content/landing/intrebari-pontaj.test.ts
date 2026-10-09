import { describe, expect, it } from "vitest";

import { LISTA_CODURI } from "@/lib/unelte/coduri-pontaj";

import {
  ACOPERIRE_CONDICA,
  ACOPERIRE_FOAIE,
  amendaEvidenta,
  INTREBARI_CONDICA,
  INTREBARI_FOAIE_PONTAJ,
  textAmenda,
} from "./intrebari-pontaj";

const TOATE = [...INTREBARI_FOAIE_PONTAJ, ...INTREBARI_CONDICA];
const SEDILA = /[\u015E\u015F\u0162\u0163]/u;

describe("întrebările foii de pontaj și ale condicii", () => {
  it("întrebarea se termină cu „?”, răspunsul cu punct, fără ș/ț cu sedilă", () => {
    for (const r of TOATE) {
      expect(r.q.endsWith("?"), r.q).toBe(true);
      expect(r.a.endsWith("."), r.q).toBe(true);
      expect(`${r.q}${r.a}${r.temei ?? ""}`, r.q).not.toMatch(SEDILA);
    }
    for (const t of [ACOPERIRE_FOAIE, ACOPERIRE_CONDICA]) {
      expect(t).not.toMatch(SEDILA);
      expect(t.endsWith(".")).toBe(true);
    }
  });

  it("întrebările nu se repetă pe aceeași pagină", () => {
    for (const lista of [INTREBARI_FOAIE_PONTAJ, INTREBARI_CONDICA]) {
      expect(new Set(lista.map((r) => r.q)).size).toBe(lista.length);
    }
  });

  it("temeiul numește Codul muncii, iar legăturile rămân pe site", () => {
    for (const r of TOATE) {
      if (r.temei !== undefined) expect(r.temei, r.q).toMatch(/Codul muncii$/u);
      if (r.legatura !== undefined) expect(r.legatura.href, r.q).toMatch(/^[?/]/u);
    }
  });

  it("răspunsul despre coduri le numește pe toate, ca legenda din fișiere", () => {
    const coduri = INTREBARI_FOAIE_PONTAJ.find((r) => r.q.includes("coduri"));
    for (const cod of LISTA_CODURI) expect(coduri?.a).toMatch(new RegExp(`\\b${cod} pentru `, "u"));
  });
});

describe("amenzile citite din pagina evidenței orelor", () => {
  it("găsește amenda pentru lipsa evidenței și pe cea de la timp parțial", () => {
    expect(amendaEvidenta("m").suma).toMatch(/1\.500.*3\.000/u);
    const partial = amendaEvidenta("e3");
    expect(partial.suma).toMatch(/10\.000.*15\.000/u);
    expect(partial.aplicare).toBeDefined();
    expect(textAmenda(partial)).toBe(`${partial.suma}, ${partial.aplicare ?? ""}`);
  });

  it("sumele din răspunsuri sunt chiar cele din pagina-lege, nu copii", () => {
    const text = TOATE.map((r) => r.a).join(" ");
    expect(text).toContain(amendaEvidenta("m").suma);
    expect(text).toContain(textAmenda(amendaEvidenta("e3")));
  });
});
