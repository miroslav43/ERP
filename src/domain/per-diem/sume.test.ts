// src/domain/per-diem/sume.test.ts
import { describe, expect, it } from "vitest";
import {
  baremLaData,
  calculeazaSume,
  gasesteRandValabil,
  type BaremTara,
  type PoliticaDiurna,
} from "./sume";
import type { FereastraDiurna } from "./ferestre";

const RO = "11111111-1111-1111-1111-111111111111";
const DE = "22222222-2222-2222-2222-222222222222";

function fereastra(
  partial: Partial<FereastraDiurna> & { taraId: string; fractiune: number },
): FereastraDiurna {
  return {
    numarFereastra: 1,
    deLa: new Date("2026-03-10T00:00:00Z"),
    panaLa: new Date("2026-03-11T00:00:00Z"),
    oreFereastra: 24,
    motiv: "fereastră completă de 24 de ore",
    ...partial,
  };
}

const POLITICA: PoliticaDiurna = {
  countryIdIntern: RO,
  monedaInterna: "RON",
  diurnaInternaZi: 50,
  diurnaBazaLegalaInterna: 20,
  multiploPlafonNeimpozabil: 2.5,
  multiploDiurnaExterna: 1,
  categorieBarem: "II",
};

describe("gasesteRandValabil", () => {
  const randuri = [
    { valabilDeLa: "2025-01-01", valabilPana: "2025-12-31", eticheta: "vechi" },
    { valabilDeLa: "2026-01-01", valabilPana: null, eticheta: "curent" },
  ];

  it("alege rândul cu valabil_de_la cel mai recent care acoperă data", () => {
    expect(gasesteRandValabil(randuri, "2026-06-01")?.eticheta).toBe("curent");
    expect(gasesteRandValabil(randuri, "2025-06-01")?.eticheta).toBe("vechi");
  });

  it("întoarce null când data e înainte de orice valabilitate", () => {
    expect(gasesteRandValabil(randuri, "2024-01-01")).toBeNull();
  });

  it("respectă valabil_pana: o dată de după închidere nu se potrivește cu rândul vechi", () => {
    expect(gasesteRandValabil([randuri[0]!], "2026-01-15")).toBeNull();
  });
});

describe("baremLaData", () => {
  const baremuri: readonly BaremTara[] = [
    {
      countryId: DE,
      categorie: "II",
      valoare: 35,
      moneda: "EUR",
      valabilDeLa: "2026-01-01",
      valabilPana: null,
    },
    {
      countryId: DE,
      categorie: "I",
      valoare: 45,
      moneda: "EUR",
      valabilDeLa: "2026-01-01",
      valabilPana: null,
    },
  ];

  it("filtrează pe țară ȘI categorie", () => {
    expect(baremLaData(baremuri, DE, "II", "2026-06-01")?.valoare).toBe(35);
    expect(baremLaData(baremuri, DE, "I", "2026-06-01")?.valoare).toBe(45);
  });

  it("întoarce null pentru o țară fără barem", () => {
    expect(baremLaData(baremuri, RO, "II", "2026-06-01")).toBeNull();
  });
});

describe("calculeazaSume", () => {
  it("calculează integral pentru ferestre în țara internă, cu curs implicit 1", () => {
    const rezultat = calculeazaSume(
      [fereastra({ taraId: RO, fractiune: 1 }), fereastra({ taraId: RO, fractiune: 0.5 })],
      POLITICA,
      [],
      null,
    );
    // valoare_zi = 50 lei, plafon_zi = 2.5 * 20 = 50 lei.
    expect(rezultat.zileTotal).toBe(1.5);
    expect(rezultat.valoareLei).toBe(75); // 1*50 + 0.5*50
    expect(rezultat.plafonNeimpozabilLei).toBe(75);
    expect(rezultat.parteNeimpozabilaLei).toBe(75);
    expect(rezultat.parteImpozabilaLei).toBe(0);
    expect(rezultat.cursIncomplet).toBe(false);
    expect(rezultat.baremLipsa).toBe(false);
  });

  it("aplică baremul extern și cursul valutar pentru o țară străină", () => {
    const baremuri: readonly BaremTara[] = [
      {
        countryId: DE,
        categorie: "II",
        valoare: 35,
        moneda: "EUR",
        valabilDeLa: "2026-01-01",
        valabilPana: null,
      },
    ];
    const rezultat = calculeazaSume(
      [fereastra({ taraId: DE, fractiune: 1 })],
      POLITICA,
      baremuri,
      5,
    );
    // valoare_zi = 35 EUR, curs 5 ⇒ 175 lei.
    expect(rezultat.valoareLei).toBe(175);
    // plafon_zi = 2.5 * 35 = 87.5 EUR ⇒ 437.5 lei, deci partea de 175 e integral neimpozabilă.
    expect(rezultat.parteNeimpozabilaLei).toBe(175);
    expect(rezultat.parteImpozabilaLei).toBe(0);
  });

  it("marchează cursIncomplet și NU inventează curs când lipsește pentru o monedă străină", () => {
    const baremuri: readonly BaremTara[] = [
      {
        countryId: DE,
        categorie: "II",
        valoare: 35,
        moneda: "EUR",
        valabilDeLa: "2026-01-01",
        valabilPana: null,
      },
    ];
    const rezultat = calculeazaSume(
      [fereastra({ taraId: DE, fractiune: 1 })],
      POLITICA,
      baremuri,
      null,
    );
    expect(rezultat.cursIncomplet).toBe(true);
    expect(rezultat.valoareLei).toBeNull();
    expect(rezultat.parteNeimpozabilaLei).toBeNull();
    // Zilele tot se văd — doar suma în lei rămâne necunoscută.
    expect(rezultat.zileTotal).toBe(1);
  });

  it("marchează baremLipsa când nu există barem pentru țara și data ferestrei", () => {
    const rezultat = calculeazaSume([fereastra({ taraId: DE, fractiune: 1 })], POLITICA, [], 5);
    expect(rezultat.baremLipsa).toBe(true);
    expect(rezultat.valoareLei).toBeNull();
    expect(rezultat.detalii[0]?.stare).toBe("fara_barem");
  });

  it("plafonul împarte, nu blochează: partea peste plafon devine impozabilă", () => {
    const politicaCuPlafonMic: PoliticaDiurna = {
      ...POLITICA,
      multiploPlafonNeimpozabil: 1,
      diurnaBazaLegalaInterna: 10, // plafon_zi = 1 * 10 = 10 lei, sub valoarea de 50.
    };
    const rezultat = calculeazaSume(
      [fereastra({ taraId: RO, fractiune: 1 })],
      politicaCuPlafonMic,
      [],
      null,
    );
    expect(rezultat.valoareLei).toBe(50);
    expect(rezultat.plafonNeimpozabilLei).toBe(10);
    expect(rezultat.parteNeimpozabilaLei).toBe(10);
    expect(rezultat.parteImpozabilaLei).toBe(40);
  });

  it("rotunjește la doi zecimali, aritmetic", () => {
    const politicaFractie: PoliticaDiurna = { ...POLITICA, diurnaInternaZi: 33.335 };
    const rezultat = calculeazaSume(
      [fereastra({ taraId: RO, fractiune: 1 })],
      politicaFractie,
      [],
      null,
    );
    expect(rezultat.valoareLei).toBe(33.34);
  });

  it("listă goală de ferestre ⇒ zero zile, zero lei, fără avertismente", () => {
    const rezultat = calculeazaSume([], POLITICA, [], null);
    expect(rezultat.zileTotal).toBe(0);
    expect(rezultat.valoareLei).toBe(0);
    expect(rezultat.cursIncomplet).toBe(false);
    expect(rezultat.baremLipsa).toBe(false);
  });
});
