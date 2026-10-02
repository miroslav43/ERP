// src/domain/payroll/etape/retineri-popriri.lacune.test.ts
//
// Lacunele confirmate de audit pe plafoanele urmăririi silite. Ambele privesc
// încadrarea juridică, nu aritmetica: valoare de confirmat, NOTES.md §3 Fiscal
// („plafonul legal cumulat al reținerilor din net și ordinea de prioritate”) și
// punctele ⚠ din antetul `retineri-popriri.ts`. Testele fixează comportamentul
// ACTUAL și spun în clar cealaltă citire, ca decizia juristului să schimbe un
// test numit, nu o cifră pierdută.

import { describe, expect, it } from "vitest";

import { calculeazaRetinerile, type IntrareRetineri, type Poprire } from "./retineri-popriri";

const O_TREIME = 1 / 3;
const O_JUMATATE = 1 / 2;

function poprire(peste: Partial<Poprire>): Poprire {
  return {
    id: "P1",
    sumaLunara: 500,
    soldRamas: 9000,
    esteIntretinere: false,
    prioritate: 1,
    dosar: "1/2026",
    ...peste,
  };
}

function intrare(peste: Partial<IntrareRetineri>): IntrareRetineri {
  return {
    net: 3000,
    popriri: [],
    retineri: [],
    plafonPoprireUnica: O_TREIME,
    plafonPopririConcurente: O_JUMATATE,
    ...peste,
  };
}

describe("calculeazaRetinerile — două popriri obișnuite concurente", () => {
  // Citirea uzuală a art. 729 CPC: fiecare creanță obișnuită rămâne la cel mult
  // 1/3, iar toate împreună la cel mult 1/2. Pe netul de 6000 asta ar da
  // A = 2000 și B = 1000. Codul folosește un singur plafon de 1/2 pentru toate,
  // din care primul dosar ia cât cere. Valoare de confirmat: NOTES.md §3 Fiscal.
  it("fixează azi împărțirea plafonului de o jumătate în ordinea priorității", () => {
    const r = calculeazaRetinerile(
      intrare({
        net: 6000,
        popriri: [
          poprire({ id: "A", dosar: "1/2026", prioritate: 1, sumaLunara: 2500 }),
          poprire({ id: "B", dosar: "2/2026", prioritate: 2, sumaLunara: 2500 }),
        ],
      }),
    );
    expect(r.plafonAplicat).toBe(3000);
    expect(r.aplicate.map((a) => a.aplicata)).toEqual([2500, 500]);
    // Sumele singure nu spun CINE a luat 2500: cu ordinea inversată lista ar fi
    // tot [2500, 500]. Id-ul fixează că dosarul cu prioritatea 1 trece primul.
    expect(r.aplicate.map((a) => [a.id, a.aplicata])).toEqual([
      ["A", 2500],
      ["B", 500],
    ]);
    // Primul dosar trece azi de o treime din net: 2500 > 2000.
    expect(r.aplicate[0]?.aplicata).toBeGreaterThan(6000 * O_TREIME);
    expect(r.totalRetinut + r.netRamas).toBe(6000);
  });
});

describe("calculeazaRetinerile — ordinea în care dosarele consumă plafonul", () => {
  // `comparaPopriri`: întâi întreținerea, apoi prioritatea CRESCĂTOR, abia apoi
  // id-ul. Pe un plafon care nu le acoperă pe amândouă, ordinea decide cine
  // încasează tot și cine rămâne cu restul — deci testele leagă suma de id.

  it("prioritatea mică trece prima, chiar când id-ul ei vine al doilea alfabetic", () => {
    // Id-urile sunt alese CONTRA priorității: dacă ordinea s-ar decide pe id,
    // „A" ar trece primul. Intrarea vine și ea în ordinea greșită.
    const r = calculeazaRetinerile(
      intrare({
        net: 6000,
        popriri: [
          poprire({ id: "A", dosar: "1/2026", prioritate: 2, sumaLunara: 2500 }),
          poprire({ id: "Z", dosar: "2/2026", prioritate: 1, sumaLunara: 2500 }),
        ],
      }),
    );
    expect(r.plafonAplicat).toBe(3000);
    expect(r.aplicate.map((a) => [a.id, a.aplicata])).toEqual([
      ["Z", 2500],
      ["A", 500],
    ]);
    expect(r.aplicate.find((a) => a.id === "Z")?.soldDupa).toBe(6500);
    expect(r.aplicate.find((a) => a.id === "A")?.soldDupa).toBe(8500);
  });

  it("întreținerea trece înaintea unei popriri obișnuite, oricare i-ar fi prioritatea", () => {
    // Întreținerea are prioritatea 5 (cea mai slabă) și id-ul „Z" (ultimul):
    // singurul motiv pentru care trece prima e `esteIntretinere`.
    const r = calculeazaRetinerile(
      intrare({
        net: 6000,
        popriri: [
          poprire({ id: "A", dosar: "1/2026", prioritate: 1, sumaLunara: 2500 }),
          poprire({
            id: "Z",
            dosar: "2/2026",
            prioritate: 5,
            sumaLunara: 2500,
            esteIntretinere: true,
          }),
        ],
      }),
    );
    expect(r.plafonAplicat).toBe(3000);
    expect(r.aplicate.map((a) => [a.id, a.aplicata])).toEqual([
      ["Z", 2500],
      ["A", 500],
    ]);
    expect(r.totalRetinut).toBe(3000);
    expect(r.netRamas).toBe(3000);
  });
});

describe("calculeazaRetinerile — o singură creanță de întreținere", () => {
  // Punctul 1 din antet: art. 729 alin. (1) lit. a) CPC ridică plafonul la 1/2
  // pentru întreținere chiar cu un singur dosar, iar etapa NU deduce asta din
  // `esteIntretinere` — plafonul vine de la apelant. Valoare de confirmat.
  it("cu plafonul unic de o treime, reține o treime, oricare ar fi natura creanței", () => {
    const r = calculeazaRetinerile(
      intrare({ popriri: [poprire({ esteIntretinere: true, sumaLunara: 1400 })] }),
    );
    expect(r.aplicate[0]?.aplicata).toBe(1000);
    expect(r.netRamas).toBe(2000);
  });

  it("apelantul care trimite plafonul de o jumătate obține reținerea întreagă", () => {
    const r = calculeazaRetinerile(
      intrare({
        popriri: [poprire({ esteIntretinere: true, sumaLunara: 1400 })],
        plafonPoprireUnica: O_JUMATATE,
      }),
    );
    expect(r.aplicate[0]?.aplicata).toBe(1400);
    expect(r.netRamas).toBe(1600);
  });
});
