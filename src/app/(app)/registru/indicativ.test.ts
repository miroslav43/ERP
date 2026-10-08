// src/app/(app)/registru/indicativ.test.ts
//
// Ordinea indicativelor din nomenclator: cifra romană a compartimentului, litera
// subdiviziunii, cifra arabă a dosarului. Alfabetic, „IX" vine înaintea lui „V"
// — vaultul registrului spune de la început că ordonarea din bază e corectă
// doar până la „VIII".

import { describe, expect, it } from "vitest";

import { comparaIndicative, ordineIndicativ } from "./indicativ";

describe("ordineIndicativ", () => {
  it.each([
    ["I.1", [1, "", 1]],
    ["IV.A.3", [4, "A", 3]],
    ["IX.2", [9, "", 2]],
    ["XIV.B.12", [14, "B", 12]],
  ])("%s → compartiment, literă, dosar", (indicativ, asteptat) => {
    expect(ordineIndicativ(indicativ)).toEqual(asteptat);
  });

  it("un indicativ străin nu aruncă: cade la coadă", () => {
    expect(ordineIndicativ("")).toEqual([Number.MAX_SAFE_INTEGER, "", 0]);
    expect(ordineIndicativ("abc")).toEqual([Number.MAX_SAFE_INTEGER, "", 0]);
  });
});

describe("comparaIndicative", () => {
  it("ordonează pe valoarea cifrei romane, nu alfabetic", () => {
    const amestecate = ["X.1", "II.5", "IX.2", "I.1", "IV.A.3", "IV.3", "V.1", "II.A.1"];
    expect([...amestecate].sort(comparaIndicative)).toEqual([
      "I.1",
      "II.5",
      "II.A.1",
      "IV.3",
      "IV.A.3",
      "V.1",
      "IX.2",
      "X.1",
    ]);
  });

  it("în același compartiment, dosarele fără literă vin înaintea celor cu literă", () => {
    expect(comparaIndicative("II.9", "II.A.1")).toBeLessThan(0);
  });

  it("dosarul 10 vine după dosarul 9, nu după 1", () => {
    expect(comparaIndicative("II.10", "II.9")).toBeGreaterThan(0);
  });
});
