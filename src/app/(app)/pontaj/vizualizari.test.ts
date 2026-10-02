// src/app/(app)/pontaj/vizualizari.test.ts
//
// Contractul de adresă al vizualizărilor lui `/pontaj`: implicita depinde de
// scope-ul de citire, iar o valoare stricată din URL cade tăcut pe ea.

import { describe, expect, it } from "vitest";

import {
  implicitaPentruScope,
  OPTIUNI_VIZUALIZARE,
  VIZUALIZARE_IMPLICITA,
  VIZUALIZARI,
  vizualizareaCeruta,
} from "./vizualizari";

describe("implicitaPentruScope", () => {
  it.each([
    ["own", "saptamana"],
    ["team", "lista"],
    ["all", "lista"],
    // Apelantul normalizează „absent” la `own`; orice altceva vede și pe alții.
    ["none", "lista"],
  ])("scope `%s` ⇒ %s", (scope, asteptat) => {
    expect(implicitaPentruScope(scope)).toBe(asteptat);
  });

  it("angajatul aterizează pe grila din care se pontează", () => {
    expect(implicitaPentruScope("own")).toBe(VIZUALIZARE_IMPLICITA);
  });
});

describe("vizualizareaCeruta", () => {
  it.each(VIZUALIZARI)("valoarea validă `%s` se păstrează, oricare ar fi implicita", (v) => {
    expect(vizualizareaCeruta(v, "lista")).toBe(v);
    expect(vizualizareaCeruta(v, "saptamana")).toBe(v);
  });

  it.each([
    ["inventată", "calendar"],
    ["repetată în adresă", ["luna", "lista"]],
    ["lipsă", undefined],
    ["goală", ""],
    ["cu majuscule", "Luna"],
  ])("valoarea %s cade pe implicita PRIMITĂ, nu pe o constantă", (_d, brut) => {
    expect(vizualizareaCeruta(brut, "lista")).toBe("lista");
    expect(vizualizareaCeruta(brut, "saptamana")).toBe("saptamana");
  });
});

describe("OPTIUNI_VIZUALIZARE", () => {
  it("are câte o opțiune pentru fiecare vizualizare, în aceeași ordine", () => {
    expect(OPTIUNI_VIZUALIZARE.map((o) => o.cheie)).toEqual([...VIZUALIZARI]);
  });
});
