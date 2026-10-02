// src/lib/documents/variabile.test.ts
//
// Lista de variabile permise per șablon e scrisă de mână, dar NU are voie să
// rămână în urma hărților care chiar se completează la emitere: o variabilă
// permisă dar necompletată oprește TOATE emiterile acelui tip. Testul cheamă
// efectiv cele cinci funcții din `valori-inrolare.ts` și compară cheile.
// (Antetul lui `variabile.ts` promitea testul ăsta; nu exista.)

import { describe, expect, it } from "vitest";

import {
  CODURI_INROLARE,
  DESCRIERI_VARIABILE,
  ETICHETE_SABLON,
  esteCodInrolare,
  VALORI_EXEMPLU,
  VARIABILE_PER_COD,
  type CodInrolare,
} from "./variabile";
import {
  valoriActAditionalTelemunca,
  valoriAnexaPi,
  valoriContractMunca,
  valoriFisaPostului,
  valoriNda,
  type ContextDocumente,
} from "./valori-inrolare";

const ctx: ContextDocumente = {
  organizatie: { denumire: "Firma SRL", reprezentantLegal: null },
  angajat: {
    nume: "Ion Pop",
    cnpComplet: "1990101123456",
    adresa: null,
    serieAct: null,
    numarAct: null,
    actEliberatDe: null,
    actEliberatLa: null,
    functie: null,
    departament: null,
  },
  contract: {
    numar: "12",
    dataContract: "2026-09-01",
    dataAngajarii: "2026-09-10",
    durata: "nedeterminată",
    normaOreSaptamana: 40,
    normaOreZi: 8,
    modLucru: "mixt",
    locMunca: null,
    locTelemunca: null,
    salariuBrut: 5000,
    zileConcediuAnual: 21,
  },
  azi: "2026-09-15",
};

const harti: Readonly<Record<CodInrolare, ReadonlyMap<string, string>>> = {
  contract_munca: valoriContractMunca(ctx),
  fisa_postului: valoriFisaPostului(ctx, { subordonare: null, atributii: [], competente: [] }),
  nda: valoriNda(ctx, "2 ani"),
  anexa_proprietate_intelectuala: valoriAnexaPi(ctx),
  act_aditional_telemunca: valoriActAditionalTelemunca(ctx),
};

const reuniune = [...new Set(Object.values(VARIABILE_PER_COD).flat())].sort();

describe("VARIABILE_PER_COD", () => {
  it.each(CODURI_INROLARE)("`%s`: lista permisă = cheile completate la emitere", (cod) => {
    expect([...VARIABILE_PER_COD[cod]].sort()).toEqual([...harti[cod].keys()].sort());
  });

  it.each(CODURI_INROLARE)(
    "`%s`: chiar cu fișa goală, nicio valoare nu iese goală (emiterea nu cade)",
    (cod) => {
      for (const [cheie, valoare] of harti[cod]) {
        expect({ cheie, gol: valoare.trim() === "" }).toEqual({ cheie, gol: false });
      }
    },
  );

  it("nicio listă nu repetă o variabilă", () => {
    for (const cod of CODURI_INROLARE) {
      expect(new Set(VARIABILE_PER_COD[cod]).size).toBe(VARIABILE_PER_COD[cod].length);
    }
  });
});

describe("VALORI_EXEMPLU / DESCRIERI_VARIABILE", () => {
  it("specimenul acoperă exact reuniunea variabilelor (previzualizarea nu cade)", () => {
    expect(Object.keys(VALORI_EXEMPLU).sort()).toEqual(reuniune);
  });

  it("fiecare variabilă are o explicație în paleta editorului, și nimic în plus", () => {
    expect(Object.keys(DESCRIERI_VARIABILE).sort()).toEqual(reuniune);
  });

  it("specimenul e vizibil fictiv: CNP cu zerouri, niciun câmp gol", () => {
    expect(VALORI_EXEMPLU.cnp_complet).toMatch(/0{6}$/);
    for (const valoare of Object.values(VALORI_EXEMPLU)) expect(valoare.trim()).not.toBe("");
  });
});

describe("CODURI_INROLARE / ETICHETE_SABLON / esteCodInrolare", () => {
  it("ordinea de emitere e fixă (consumă numerele din serii în ordinea asta)", () => {
    expect(CODURI_INROLARE).toEqual([
      "contract_munca",
      "fisa_postului",
      "nda",
      "anexa_proprietate_intelectuala",
      "act_aditional_telemunca",
    ]);
  });

  it("fiecare cod are etichetă", () => {
    expect(Object.keys(ETICHETE_SABLON).sort()).toEqual([...CODURI_INROLARE].sort());
  });

  it.each([
    ["contract_munca", true],
    ["act_aditional_telemunca", true],
    ["adeverinta_salariat", false],
    ["", false],
    ["CONTRACT_MUNCA", false],
  ])("%j ⇒ %s", (cod, asteptat) => {
    expect(esteCodInrolare(cod)).toBe(asteptat);
  });
});
