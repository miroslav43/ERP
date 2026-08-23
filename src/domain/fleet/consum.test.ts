import { describe, expect, it } from "vitest";

import {
  abatereConsum,
  abatereNotabila,
  consumLa100Km,
  PRAG_ABATERE_CONSUM_PROCENTE,
} from "./consum";

describe("consumLa100Km", () => {
  it("calculează litri la 100 km", () => {
    // 47 de litri pe 500 km = 9,4 l/100 km — exemplul din raportul de audit.
    expect(consumLa100Km(47, 500)).toBeCloseTo(9.4, 5);
  });

  it("întoarce null pentru o cursă încă deschisă, nu zero", () => {
    // `km_parcursi` e null cât timp foaia n-a fost închisă. Un „0 l/100 km” pe
    // ecran ar fi fost o cifră falsă, nu o absență.
    expect(consumLa100Km(30, null)).toBeNull();
  });

  it("întoarce null în loc de Infinity la zero kilometri", () => {
    expect(consumLa100Km(30, 0)).toBeNull();
  });

  it("întoarce null când nu s-a alimentat deloc", () => {
    expect(consumLa100Km(0, 500)).toBeNull();
  });
});

describe("abatereConsum", () => {
  it("dă procentul cu semn față de consumul declarat", () => {
    // 9,4 real față de 8 declarat = +17,5%.
    expect(abatereConsum(9.4, 8)).toBeCloseTo(17.5, 5);
  });

  it("este negativă când s-a consumat mai puțin decât se declară", () => {
    expect(abatereConsum(6, 8)).toBeCloseTo(-25, 5);
  });

  it("întoarce null fără termen de comparație", () => {
    // Un vehicul fără `consum_mediu_declarat` nu produce un verdict, ci lipsa
    // lui — altfel orice consum ar fi părut o abatere de 100%.
    expect(abatereConsum(9.4, null)).toBeNull();
    expect(abatereConsum(9.4, 0)).toBeNull();
    expect(abatereConsum(null, 8)).toBeNull();
  });
});

describe("abatereNotabila", () => {
  it("se aprinde la prag, în ambele sensuri", () => {
    expect(PRAG_ABATERE_CONSUM_PROCENTE).toBe(15);
    expect(abatereNotabila(15)).toBe(true);
    expect(abatereNotabila(-15)).toBe(true);
    expect(abatereNotabila(14.9)).toBe(false);
    expect(abatereNotabila(null)).toBe(false);
  });
});
