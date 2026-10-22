import { describe, expect, it } from "vitest";

import {
  ZILE_SAPTAMANA_STANDARD,
  normaZilnicaPeCinciZile,
  programSubCinciZile,
  textNormaContract,
  textZilePeSaptamana,
  zilePeSaptamana,
} from "./program-saptamanal";

describe("zilele pe săptămână, deduse din cele două norme ale contractului", () => {
  it.each([
    [8, 40, 5],
    [4, 20, 5],
    [8, 20, 2.5],
    [8, 24, 3],
    [8, 16, 2],
    [6, 30, 5],
    [8, 48, 6],
  ] as const)("%d h/zi, %d h/săptămână → %d zile", (zi, saptamana, zile) => {
    expect(zilePeSaptamana(zi, saptamana)).toBe(zile);
  });

  it("fără normă săptămânală sau cu o normă care nu se poate împărți: nu se deduce nimic", () => {
    expect(zilePeSaptamana(8, undefined)).toBeNull();
    expect(zilePeSaptamana(8, null)).toBeNull();
    expect(zilePeSaptamana(0, 40)).toBeNull();
    expect(zilePeSaptamana(8, 0)).toBeNull();
    expect(zilePeSaptamana(Number.NaN, 40)).toBeNull();
    expect(zilePeSaptamana(8, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("sub cinci zile: 2,5 și 3 da; 5, 6 și „nedeductibil” nu", () => {
    expect(ZILE_SAPTAMANA_STANDARD).toBe(5);
    expect(programSubCinciZile(2.5)).toBe(true);
    expect(programSubCinciZile(3)).toBe(true);
    expect(programSubCinciZile(4.99)).toBe(true);
    expect(programSubCinciZile(5)).toBe(false);
    expect(programSubCinciZile(6)).toBe(false);
    expect(programSubCinciZile(null)).toBe(false);
    // Virgula mobilă nu face din cinci zile un program parțial.
    expect(programSubCinciZile(zilePeSaptamana(4.34, 21.7))).toBe(false);
  });

  it("textul, cum îl citește HR-ul: zecimala doar când există", () => {
    expect(textZilePeSaptamana(5)).toBe("5 zile pe săptămână");
    expect(textZilePeSaptamana(2.5)).toBe("2,5 zile pe săptămână");
    expect(textZilePeSaptamana(1)).toBe("1 zi pe săptămână");
    expect(textZilePeSaptamana(20 / 6)).toBe("3,33 zile pe săptămână");
  });
});

describe("norma contractului pe fișa angajatului", () => {
  it("arată ambele norme și zilele deduse", () => {
    expect(textNormaContract(8, 40)).toBe("40 ore/săptămână, 8 ore/zi — 5 zile pe săptămână");
    expect(textNormaContract(8, 20)).toBe("20 ore/săptămână, 8 ore/zi — 2,5 zile pe săptămână");
    expect(textNormaContract(7.5, 37.5)).toBe(
      "37,5 ore/săptămână, 7,5 ore/zi — 5 zile pe săptămână",
    );
  });

  it("fără zile inventate când norma zilnică lipsește", () => {
    expect(textNormaContract(0, 40)).toBe("40 ore/săptămână, 0 ore/zi");
  });
});

describe("norma zilnică a unui program de cinci zile, din norma săptămânală", () => {
  it.each([
    [40, 8],
    [20, 4],
    [30, 6],
    [37.5, 7.5],
    [21.73, 4.34],
    [0.7, 0.14],
    [48, 8],
  ] as const)("%d h/săptămână → %d h/zi", (saptamana, zi) => {
    expect(normaZilnicaPeCinciZile(saptamana)).toBe(zi);
  });

  it("programul rezultat nu iese niciodată sub cinci zile din rotunjire, de la 0,5 la 48 h", () => {
    // De la 0,5 h, minimul formularului de contract; sub 0,05 h nici sutimea nu mai încape.
    for (let sutimi = 50; sutimi <= 4800; sutimi += 1) {
      const saptamana = sutimi / 100;
      const zile = zilePeSaptamana(normaZilnicaPeCinciZile(saptamana), saptamana);
      expect(programSubCinciZile(zile), String(saptamana)).toBe(false);
    }
  });
});
