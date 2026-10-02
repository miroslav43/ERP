// src/domain/per-diem/sume.lacune.test.ts
//
// Lacunele confirmate de audit în partea monetară a diurnei: regula de
// rotunjire, plafonul neimpozabil pe zi și data la care se caută baremul.

import { describe, expect, it } from "vitest";

import { rotunjesteLaBani } from "../bani";
import type { FereastraDiurna } from "./ferestre";
import { calculeazaSume, type BaremTara, type PoliticaDiurna } from "./sume";

const RO = "11111111-1111-1111-1111-111111111111";
const DE = "22222222-2222-2222-2222-222222222222";

function fereastra(
  partial: Partial<FereastraDiurna> & { taraId: string; fractiune: number },
): FereastraDiurna {
  return {
    numarFereastra: 1,
    deLa: new Date("2026-03-10T08:00:00Z"),
    panaLa: new Date("2026-03-11T08:00:00Z"),
    oreFereastra: 24,
    motiv: "fereastră completă de 24 de ore",
    ...partial,
  };
}

const POLITICA: PoliticaDiurna = {
  countryIdIntern: RO,
  monedaInterna: "RON",
  diurnaInternaZi: 40,
  diurnaBazaLegalaInterna: 23,
  multiploPlafonNeimpozabil: 2.5,
  multiploDiurnaExterna: 3,
  categorieBarem: "II",
  diurnaExternaZi: null,
  monedaDiurnaExterna: null,
};

function baremDe(valoare: number, valabilDeLa: string, valabilPana: string | null): BaremTara {
  return { countryId: DE, categorie: "II", valoare, moneda: "EUR", valabilDeLa, valabilPana };
}

// ── Regula unică de rotunjire ──────────────────────────────────────────────

describe("calculeazaSume — rotunjirea la ban", () => {
  // Antetul `src/domain/bani.ts` cere o SINGURĂ regulă de rotunjire în aplicație,
  // iar ROUND-ul numeric din SQL-ul portat (0015/0147) duce jumătatea departe de
  // zero. `rotunjeste` din sume.ts avea o a treia formulă, cu epsilon ABSOLUT, care pe 8,575
  // dădea 8,57. Valorile de mai jos sunt jumătăți de ban exacte în zecimal.
  it.each([
    { valoareZi: 17.15, asteptat: 8.58 },
    { valoareZi: 4.27, asteptat: 2.14 },
    { valoareZi: 8.53, asteptat: 4.27 },
    { valoareZi: 20.15, asteptat: 10.08 },
  ])(
    "jumătatea de zi din $valoareZi lei se rotunjește la $asteptat, ca în bani.ts și SQL",
    ({ valoareZi, asteptat }) => {
      const r = calculeazaSume(
        [fereastra({ taraId: RO, fractiune: 0.5 })],
        { ...POLITICA, diurnaInternaZi: valoareZi },
        [],
        null,
      );
      expect(rotunjesteLaBani(0.5 * valoareZi)).toBe(asteptat);
      expect(r.valoareLei).toBe(asteptat);
    },
  );

  it("o jumătate de ban pe care formulele o rotunjesc la fel rămâne neschimbată", () => {
    const r = calculeazaSume(
      [fereastra({ taraId: RO, fractiune: 0.5 })],
      { ...POLITICA, diurnaInternaZi: 66.67 },
      [],
      null,
    );
    // 0,5 × 66,67 = 33,335 → 33,34, același rezultat ca regula unică.
    expect(r.valoareLei).toBe(33.34);
    expect(r.valoareLei).toBe(rotunjesteLaBani(33.335));
  });
});

// ── Plafonul neimpozabil e PE ZI ───────────────────────────────────────────

describe("calculeazaSume — o zi internă sub plafon și o zi externă peste plafon", () => {
  const FERESTRE = [
    fereastra({ numarFereastra: 1, taraId: RO, fractiune: 1 }),
    fereastra({
      numarFereastra: 2,
      taraId: DE,
      fractiune: 1,
      deLa: new Date("2026-03-11T08:00:00Z"),
      panaLa: new Date("2026-03-12T08:00:00Z"),
    }),
  ];
  const BAREME = [baremDe(35, "2026-01-01", null)];

  it("fiecare zi își poartă valoarea și plafonul ei, în lei", () => {
    const r = calculeazaSume(FERESTRE, POLITICA, BAREME, 5);
    // RO: 40 lei, plafon 23 × 2,5 = 57,5. DE: 35 × 3 × 5 = 525, plafon 35 × 2,5 × 5 = 437,5.
    expect(r.detalii.map((d) => d.lei)).toEqual([40, 525]);
    expect(r.detalii.map((d) => d.plafonLei)).toEqual([57.5, 437.5]);
    expect(r.valoareLei).toBe(565);
  });

  // `calculeazaSume` compară TOTALUL deplasării cu suma plafoanelor, exact ca
  // `app.recalculeaza_diurna` (0156: least/greatest pe total), deci ecranul
  // arată ce e stocat. Dacă plafonul trebuie aplicat pe zi și pe țară (Codul
  // fiscal art. 76) e o chestiune de interpretare ⚠, de schimbat în AMBELE
  // locuri deodată. Testul fixează paritatea de azi.
  it("plafonul se compară pe totalul deplasării, ca în SQL", () => {
    const r = calculeazaSume(FERESTRE, POLITICA, BAREME, 5);
    // Total 565, plafoane 57,5 + 437,5 = 495 ⇒ impozabil 70, neimpozabil 495.
    expect(r.parteImpozabilaLei).toBe(70);
    expect(r.parteNeimpozabilaLei).toBe(495);
  });
});

// ── Data la care se caută baremul ──────────────────────────────────────────

describe("calculeazaSume — baremul se caută în ziua României a ferestrei", () => {
  // O fereastră din modul `zile_calendaristice` începe la miezul nopții de la
  // București: 01.10.2026 00:00 ora României = 2026-09-30T21:00:00Z. `laZiIso`
  // din sume.ts ia data în UTC și caută baremul din 30 septembrie.
  const FEREASTRA_1_OCT = fereastra({
    taraId: DE,
    fractiune: 1,
    deLa: new Date("2026-09-30T21:00:00Z"),
    panaLa: new Date("2026-10-01T21:00:00Z"),
  });
  const BAREME = [baremDe(35, "2026-01-01", "2026-09-30"), baremDe(40, "2026-10-01", null)];
  const POLITICA_1X = { ...POLITICA, multiploDiurnaExterna: 1 };

  it("o fereastră care începe ziua în UTC folosește baremul acelei zile", () => {
    const r = calculeazaSume(
      [
        fereastra({
          taraId: DE,
          fractiune: 1,
          deLa: new Date("2026-10-01T08:00:00Z"),
          panaLa: new Date("2026-10-02T08:00:00Z"),
        }),
      ],
      POLITICA_1X,
      BAREME,
      5,
    );
    expect(r.detalii[0]?.valoareZi).toBe(40);
    expect(r.valoareLei).toBe(200);
  });

  it.fails("DEFECT: ziua de 1 octombrie se plătește cu baremul de la 1 octombrie", () => {
    const r = calculeazaSume([FEREASTRA_1_OCT], POLITICA_1X, BAREME, 5);
    expect(r.detalii[0]?.valoareZi).toBe(40);
    expect(r.valoareLei).toBe(200);
  });
});
