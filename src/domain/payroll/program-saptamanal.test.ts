import { describe, expect, it } from "vitest";

import {
  ZILE_SAPTAMANA_STANDARD,
  programSubCinciZile,
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
