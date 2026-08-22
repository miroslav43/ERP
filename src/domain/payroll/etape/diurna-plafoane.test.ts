// src/domain/payroll/etape/diurna-plafoane.test.ts
//
// Invariantul pe care îl apără fișierul ăsta: diurna nu are UN plafon, ci două
// care se aplică în ordine — întâi cel zilnic, pe fiecare zi și pe fiecare țară,
// apoi cel lunar, CUMULAT pe toate deplasările lunii. Orice test de mai jos care
// ar începe să treacă cu „plafonul lunar verificat pe fiecare deplasare în
// parte" înseamnă o sumă lăsată neimpozitată, adică un control ITM sau ANAF cu
// diferențe de plată și accesorii.
//
// Al doilea invariant, verificat pe fiecare set de date: partea neimpozabilă
// plus cea impozabilă dau EXACT suma acordată, la ban — și la total, și pe
// fiecare deplasare. O rotunjire care pierde un ban aici înseamnă o coloană de
// fluturaș care nu adună la total.

import { describe, expect, it } from "vitest";

import {
  calculeazaDiurna,
  type DiurnaPeDeplasare,
  type IntrareDiurna,
  type ZiDiurna,
} from "./diurna-plafoane";

// ⚠️ Bareme ilustrative, alese pentru aritmetică limpede, NU valori legale de
// confirmat de contabil: 23 lei/zi în țară (plafon zilnic 57,50 lei la
// multiplicatorul 2,5) și 175 lei/zi pentru o deplasare externă (plafon 437,50).
const BAREM_INTERN = 23;
const BAREM_EXTERN = 175;

/** Barem atât de mare încât plafonul zilnic să nu poată tăia nimic. */
const BAREM_FARA_LIMITA = 1000;

function zi(
  data: string,
  sumaAcordata: number,
  baremLegalZi = BAREM_INTERN,
  deplasareId = "DEP-A",
): ZiDiurna {
  return { data, sumaAcordata, baremLegalZi, deplasareId };
}

/** `cate` zile consecutive din martie 2026, toate pe aceeași deplasare. */
function zileConsecutive(
  deplasareId: string,
  primaZi: number,
  cate: number,
  sumaAcordata: number,
  baremLegalZi = BAREM_INTERN,
): ZiDiurna[] {
  return Array.from({ length: cate }, (_, indice) => ({
    data: `2026-03-${String(primaZi + indice).padStart(2, "0")}`,
    sumaAcordata,
    baremLegalZi,
    deplasareId,
  }));
}

function intrare(peste: Partial<IntrareDiurna> = {}): IntrareDiurna {
  return {
    zile: [],
    multiplicatorPlafonZilnic: 2.5,
    fractiePlafonLunar: 0.33,
    salariuBazaBrut: 6000,
    ...peste,
  };
}

/** Lei → bani întregi, ca invariantul de sumă să se verifice fără epsilon. */
function bani(lei: number): number {
  return Math.round(lei * 100);
}

function dupaId(peDeplasare: readonly DiurnaPeDeplasare[]): DiurnaPeDeplasare[] {
  return [...peDeplasare].sort((a, b) => a.deplasareId.localeCompare(b.deplasareId));
}

function coduri(rezultat: { readonly probleme: readonly { readonly cod: string }[] }): string[] {
  return rezultat.probleme.map((problema) => problema.cod);
}

/** TOATE permutările listei. Pentru liste scurte — 5 zile dau 120 de ordini. */
function permutari<T>(lista: readonly T[]): T[][] {
  if (lista.length <= 1) return [[...lista]];
  const iesire: T[][] = [];
  lista.forEach((element, indice) => {
    const fara = [...lista.slice(0, indice), ...lista.slice(indice + 1)];
    for (const coada of permutari(fara)) iesire.push([element, ...coada]);
  });
  return iesire;
}

/**
 * Un eșantion de ordini, DETERMINIST (fără ceas, fără aleator): fiecare rotație
 * a listei și inversul ei. Suficient ca o acumulare dependentă de ordine să se
 * vadă, fără costul factorialului pe seturile lungi.
 */
function ordiniEsantion<T>(lista: readonly T[]): T[][] {
  const iesire: T[][] = [];
  for (let decalaj = 0; decalaj < Math.max(1, lista.length); decalaj++) {
    const rotita = [...lista.slice(decalaj), ...lista.slice(0, decalaj)];
    iesire.push(rotita, [...rotita].reverse());
  }
  return iesire;
}

describe("plafonul zilnic", () => {
  it("sub ambele plafoane, toată diurna rămâne neimpozabilă și nu se raportează nimic", () => {
    const rezultat = calculeazaDiurna(intrare({ zile: zileConsecutive("DEP-A", 2, 5, 57.5) }));

    expect(rezultat.totalAcordat).toBe(287.5);
    expect(rezultat.neimpozabila).toBe(287.5);
    expect(rezultat.impozabila).toBe(0);
    expect(rezultat.plafonLunar).toBe(1980);
    expect(rezultat.probleme).toEqual([]);
  });

  it("o zi peste plafon taie doar surplusul zilei, nu ziua întreagă", () => {
    // Patru zile fix pe plafon (2,5 x 23 = 57,50) și una de 100 de lei.
    // Impozabil e surplusul de 42,50 lei, nu cei 100 de lei ai zilei.
    const rezultat = calculeazaDiurna(
      intrare({ zile: [...zileConsecutive("DEP-A", 2, 4, 57.5), zi("2026-03-06", 100)] }),
    );

    expect(rezultat.totalAcordat).toBe(330);
    expect(rezultat.neimpozabila).toBe(287.5);
    expect(rezultat.impozabila).toBe(42.5);
    expect(coduri(rezultat)).toEqual(["SAL_DIURNA_PESTE_PLAFON_ZILNIC"]);
    expect(rezultat.probleme[0]?.detalii).toContain("într-o zi");
    expect(rezultat.probleme[0]?.detalii).toContain("42.50");
  });

  it("ziua exact pe plafon nu e depășire", () => {
    const rezultat = calculeazaDiurna(intrare({ zile: [zi("2026-03-02", 57.5)] }));

    expect(rezultat.impozabila).toBe(0);
    expect(rezultat.probleme).toEqual([]);
  });

  it("plafonul zilnic e o RATĂ — nu se materializează în bani înainte de a fi înmulțit cu zilele", () => {
    // Barem 23,33 lei x 2,5 = 58,325 lei pe zi. Rotunjit la ban ÎNAINTE de a fi
    // aplicat pe 20 de zile, plafonul lunii ar deveni 20 x 58,33 = 1166,60 lei —
    // zece bani scoși din rotunjire, pe fiecare angajat, în fiecare lună.
    // Valoarea corectă e 20 x 58,325 = 1166,50 lei, rotunjită O SINGURĂ DATĂ.
    const rezultat = calculeazaDiurna(
      intrare({ zile: zileConsecutive("DEP-A", 2, 20, 60, 23.33) }),
    );

    expect(rezultat.totalAcordat).toBe(1200);
    expect(rezultat.neimpozabila).toBe(1166.5);
    expect(rezultat.neimpozabila).not.toBe(1166.6);
    expect(rezultat.impozabila).toBe(33.5);
  });

  it("baremul se ia pe fiecare zi, deci două țări în aceeași lună au plafoane diferite", () => {
    // Două zile în țară (plafon 57,50) și trei zile externe (plafon 437,50).
    // Un singur barem pe lună — oricare dintre cele două — ar da alt rezultat:
    // cu cel intern ar deveni impozabilă și diurna externă legală, cu cel extern
    // ar scăpa de impozit surplusul zilelor din țară.
    const rezultat = calculeazaDiurna(
      intrare({
        zile: [
          ...zileConsecutive("DEP-INTERN", 2, 2, 57.5, BAREM_INTERN),
          ...zileConsecutive("DEP-EXTERN", 10, 3, 500, BAREM_EXTERN),
        ],
      }),
    );

    expect(rezultat.totalAcordat).toBe(1615);
    expect(rezultat.neimpozabila).toBe(1427.5);
    expect(rezultat.impozabila).toBe(187.5);
    expect(dupaId(rezultat.peDeplasare)).toEqual([
      { deplasareId: "DEP-EXTERN", sumaTotala: 1500, neimpozabila: 1312.5, impozabila: 187.5 },
      { deplasareId: "DEP-INTERN", sumaTotala: 115, neimpozabila: 115, impozabila: 0 },
    ]);
    expect(coduri(rezultat)).toEqual(["SAL_DIURNA_PESTE_PLAFON_ZILNIC"]);
    expect(rezultat.probleme[0]?.detalii).toContain("în 3 zile");
  });
});

describe("plafonul lunar", () => {
  it("taie totalul lunii chiar dacă fiecare zi în parte e sub plafonul zilnic", () => {
    // 20 de zile fix pe plafonul zilnic, deci nicio depășire zilnică. Plafonul
    // lunar (33% din 3000 = 990 lei) e însă depășit de totalul de 1150 de lei.
    const rezultat = calculeazaDiurna(
      intrare({ salariuBazaBrut: 3000, zile: zileConsecutive("DEP-A", 2, 20, 57.5) }),
    );

    expect(rezultat.totalAcordat).toBe(1150);
    expect(rezultat.plafonLunar).toBe(990);
    expect(rezultat.neimpozabila).toBe(990);
    expect(rezultat.impozabila).toBe(160);
    expect(coduri(rezultat)).toEqual(["SAL_DIURNA_PESTE_PLAFON_LUNAR"]);
    expect(rezultat.probleme[0]?.detalii).toContain("990.00");
    expect(rezultat.probleme[0]?.detalii).toContain("1150.00");
    expect(rezultat.probleme[0]?.detalii).toContain("160.00");
  });

  it("INVARIANT: plafonul lunar e CUMULAT — două deplasări care separat se încadrează pot împreună să depășească", () => {
    const primaDeplasare = zileConsecutive("DEP-A", 2, 10, 57.5);
    const aDouaDeplasare = zileConsecutive("DEP-B", 16, 10, 57.5);
    const salariuBazaBrut = 3000;

    const doarPrima = calculeazaDiurna(intrare({ salariuBazaBrut, zile: primaDeplasare }));
    const doarADoua = calculeazaDiurna(intrare({ salariuBazaBrut, zile: aDouaDeplasare }));
    const impreuna = calculeazaDiurna(
      intrare({ salariuBazaBrut, zile: [...primaDeplasare, ...aDouaDeplasare] }),
    );

    // Fiecare, luată singură, stă confortabil sub plafonul de 990 de lei.
    expect(doarPrima.impozabila).toBe(0);
    expect(doarADoua.impozabila).toBe(0);
    expect(doarPrima.probleme).toEqual([]);
    expect(doarADoua.probleme).toEqual([]);

    // Împreună, 1150 > 990. Dacă plafonul s-ar verifica pe deplasare, cei 160 de
    // lei ar rămâne neimpozitați și nimeni n-ar afla până la control.
    expect(impreuna.neimpozabila).toBe(990);
    expect(impreuna.impozabila).toBe(160);
    expect(coduri(impreuna)).toEqual(["SAL_DIURNA_PESTE_PLAFON_LUNAR"]);
    expect(dupaId(impreuna.peDeplasare)).toEqual([
      { deplasareId: "DEP-A", sumaTotala: 575, neimpozabila: 495, impozabila: 80 },
      { deplasareId: "DEP-B", sumaTotala: 575, neimpozabila: 495, impozabila: 80 },
    ]);
  });

  it("ORDINEA DE IMPUTARE: plafonul lunar se aplică peste ce a rămas neimpozabil, nu peste suma brută", () => {
    // 10 zile x 150 de lei: plafonul zilnic lasă neimpozabili 10 x 57,50 = 575
    // de lei, sub plafonul lunar de 990. Aplicat greșit — întâi lunar, pe cei
    // 1500 de lei bruți — rezultatul ar fi 990 de lei neimpozabili, adică 415
    // de lei peste baremul zilnic scăpați de impozit.
    const rezultat = calculeazaDiurna(
      intrare({ salariuBazaBrut: 3000, zile: zileConsecutive("DEP-A", 2, 10, 150) }),
    );

    expect(rezultat.totalAcordat).toBe(1500);
    expect(rezultat.plafonLunar).toBe(990);
    expect(rezultat.neimpozabila).toBe(575);
    expect(rezultat.neimpozabila).not.toBe(990);
    expect(rezultat.impozabila).toBe(925);
    expect(coduri(rezultat)).toEqual(["SAL_DIURNA_PESTE_PLAFON_ZILNIC"]);
  });

  it("ambele plafoane depășite: se raportează amândouă, iar impozabilul le cuprinde pe amândouă", () => {
    // 20 de zile x 150 de lei, salariu 3000. Plafonul zilnic mută 1850 de lei la
    // impozabil; din cei 1150 rămași, plafonul lunar mai mută 160.
    const rezultat = calculeazaDiurna(
      intrare({ salariuBazaBrut: 3000, zile: zileConsecutive("DEP-A", 2, 20, 150) }),
    );

    expect(rezultat.totalAcordat).toBe(3000);
    expect(rezultat.neimpozabila).toBe(990);
    expect(rezultat.impozabila).toBe(2010);
    expect(coduri(rezultat)).toEqual([
      "SAL_DIURNA_PESTE_PLAFON_ZILNIC",
      "SAL_DIURNA_PESTE_PLAFON_LUNAR",
    ]);
  });

  it("totalul exact pe plafonul lunar nu e depășire", () => {
    // 33% din 6000 = 1980 de lei, acordați ca 40 de zile x 49,50.
    const rezultat = calculeazaDiurna(
      intrare({ zile: zileConsecutive("DEP-A", 1, 40, 49.5, BAREM_FARA_LIMITA) }),
    );

    expect(rezultat.totalAcordat).toBe(1980);
    expect(rezultat.neimpozabila).toBe(1980);
    expect(rezultat.probleme).toEqual([]);
  });
});

describe("repartizarea reducerii lunare", () => {
  it("se face proporțional cu partea neimpozabilă a fiecărei deplasări", () => {
    // DEP-A aduce 600 de lei neimpozabili, DEP-B 200 — raport 3:1. Plafonul
    // lunar (33% din 2000 = 660) taie 140 de lei, iar raportul se păstrează:
    // 495 și 165.
    const rezultat = calculeazaDiurna(
      intrare({
        salariuBazaBrut: 2000,
        zile: [
          ...zileConsecutive("DEP-A", 2, 3, 200, BAREM_FARA_LIMITA),
          ...zileConsecutive("DEP-B", 20, 1, 200, BAREM_FARA_LIMITA),
        ],
      }),
    );

    expect(rezultat.plafonLunar).toBe(660);
    expect(dupaId(rezultat.peDeplasare)).toEqual([
      { deplasareId: "DEP-A", sumaTotala: 600, neimpozabila: 495, impozabila: 105 },
      { deplasareId: "DEP-B", sumaTotala: 200, neimpozabila: 165, impozabila: 35 },
    ]);
    expect(rezultat.neimpozabila).toBe(660);
  });

  it("INVARIANT: rezultatul nu depinde de ordinea zilelor în listă", () => {
    // Trei deplasări egale și un plafon care nu se împarte la trei — cazul în
    // care o imputare „în ordine, până se umple plafonul" ar da fiecărei ordini
    // alt rezultat. Fracțiunea 0,5 e aleasă doar ca plafonul să cadă exact pe o
    // treime; regula legală rămâne cea din celelalte teste.
    const zileleLunii = [
      zi("2026-03-02", 100, BAREM_FARA_LIMITA, "DEP-A"),
      zi("2026-03-10", 100, BAREM_FARA_LIMITA, "DEP-B"),
      zi("2026-03-20", 100, BAREM_FARA_LIMITA, "DEP-C"),
    ];
    const comun = { salariuBazaBrut: 200, fractiePlafonLunar: 0.5 };

    const ordini: readonly (readonly ZiDiurna[])[] = [
      zileleLunii,
      [...zileleLunii].reverse(),
      [zileleLunii[1], zileleLunii[0], zileleLunii[2]].filter(
        (candidat): candidat is ZiDiurna => candidat !== undefined,
      ),
      [zileleLunii[2], zileleLunii[0], zileleLunii[1]].filter(
        (candidat): candidat is ZiDiurna => candidat !== undefined,
      ),
    ];

    const referinta = dupaId(
      calculeazaDiurna(intrare({ ...comun, zile: zileleLunii })).peDeplasare,
    );

    // Banul care nu se împarte la trei merge la deplasarea cu identificatorul
    // cel mai mic, nu la prima din listă — de aceea repartiția e aceeași.
    expect(referinta).toEqual([
      { deplasareId: "DEP-A", sumaTotala: 100, neimpozabila: 33.34, impozabila: 66.66 },
      { deplasareId: "DEP-B", sumaTotala: 100, neimpozabila: 33.33, impozabila: 66.67 },
      { deplasareId: "DEP-C", sumaTotala: 100, neimpozabila: 33.33, impozabila: 66.67 },
    ]);

    for (const ordine of ordini) {
      const rezultat = calculeazaDiurna(intrare({ ...comun, zile: ordine }));

      expect(dupaId(rezultat.peDeplasare), ordine.map((z) => z.deplasareId).join(" ")).toEqual(
        referinta,
      );
      expect(rezultat.neimpozabila).toBe(100);
      expect(rezultat.impozabila).toBe(200);
    }
  });

  it("INVARIANT: ordinea rândurilor nu poate muta un ban, pe zile cu depășire zilnică", () => {
    // REGRESIE. Testul de mai sus verifica doar departajarea resturilor egale:
    // trei zile identice, sume în lei întregi, barem fără limită — adică exact
    // cazul în care adunarea nu are ce strica. Nu atingea deloc ACUMULAREA
    // depășirilor zilnice, care se făcea în lei pe virgulă mobilă, unde `a+b+c`
    // nu e asociativ.
    //
    // Cele cinci zile de mai jos sunt date perfect obișnuite — sume cu două
    // zecimale, bareme legale, multiplicatorul 2,5, salariu 6000 — iar depășirile
    // lor (62,64 + 71,165 + 142,67 + 83,215 + 11,265) însumează EXACT 370,955
    // lei, adică fix o jumătate de ban. Pe ce parte a jumătății cădea suma
    // depindea de ordinea rândurilor: 110 din cele 120 de permutări dădeau 709,57
    // lei neimpozabili, celelalte 10 dădeau 709,58. Un ban mutat între partea
    // neimpozabilă și baza de CAS, CASS și impozit, la aceleași date, doar pentru
    // că interogarea a avut alt `order by`.
    //
    // Corect e rezultatul sumei EXACTE: 370,955 se rotunjește la 370,96
    // (jumătatea urcă — regula unică din `src/domain/bani.ts`), deci rămân
    // neimpozabili 1080,53 − 370,96 = 709,57 lei.
    const zileleLunii = [
      zi("2026-03-03", 281.39, 87.5),
      zi("2026-03-04", 171.14, 39.99),
      zi("2026-03-05", 200.17, 23),
      zi("2026-03-07", 249.89, 66.67),
      zi("2026-03-08", 177.94, 66.67),
    ];

    const rezultate = new Set<string>();
    for (const ordine of permutari(zileleLunii)) {
      const rezultat = calculeazaDiurna(intrare({ zile: ordine }));
      rezultate.add(
        JSON.stringify([rezultat.totalAcordat, rezultat.neimpozabila, rezultat.impozabila]),
      );
    }

    expect(permutari(zileleLunii)).toHaveLength(120);
    expect([...rezultate]).toEqual([JSON.stringify([1080.53, 709.57, 370.96])]);
  });

  it("zilele aceleiași deplasări se adună chiar dacă vin intercalate", () => {
    const rezultat = calculeazaDiurna(
      intrare({
        zile: [
          zi("2026-03-02", 50, BAREM_INTERN, "DEP-A"),
          zi("2026-03-03", 50, BAREM_INTERN, "DEP-B"),
          zi("2026-03-04", 50, BAREM_INTERN, "DEP-A"),
        ],
      }),
    );

    expect(rezultat.peDeplasare).toEqual([
      { deplasareId: "DEP-A", sumaTotala: 100, neimpozabila: 100, impozabila: 0 },
      { deplasareId: "DEP-B", sumaTotala: 50, neimpozabila: 50, impozabila: 0 },
    ]);
  });

  it("suma repartizată pe deplasări e exact plafonul lunar, fără ban pierdut la rotunjire", () => {
    const seturi: readonly IntrareDiurna[] = [
      intrare({
        salariuBazaBrut: 1234.56,
        zile: [
          ...zileConsecutive("DEP-A", 2, 3, 199.99, BAREM_FARA_LIMITA),
          ...zileConsecutive("DEP-B", 12, 4, 33.33, BAREM_FARA_LIMITA),
          ...zileConsecutive("DEP-C", 20, 1, 77.77, BAREM_FARA_LIMITA),
        ],
      }),
      intrare({
        salariuBazaBrut: 3001.01,
        fractiePlafonLunar: 0.3333,
        zile: [
          ...zileConsecutive("DEP-A", 2, 7, 151.11, BAREM_FARA_LIMITA),
          ...zileConsecutive("DEP-B", 12, 7, 149.89, BAREM_FARA_LIMITA),
        ],
      }),
    ];

    for (const set of seturi) {
      const rezultat = calculeazaDiurna(set);
      const adunate = rezultat.peDeplasare.reduce(
        (total, parte) => total + bani(parte.neimpozabila),
        0,
      );

      expect(bani(rezultat.neimpozabila)).toBe(bani(rezultat.plafonLunar));
      expect(adunate).toBe(bani(rezultat.plafonLunar));
    }
  });
});

describe("salariul de bază lipsă", () => {
  it("salariul zero face plafonul lunar zero și toată diurna impozabilă", () => {
    const rezultat = calculeazaDiurna(
      intrare({ salariuBazaBrut: 0, zile: zileConsecutive("DEP-A", 2, 5, 57.5) }),
    );

    expect(rezultat.totalAcordat).toBe(287.5);
    expect(rezultat.plafonLunar).toBe(0);
    expect(rezultat.neimpozabila).toBe(0);
    expect(rezultat.impozabila).toBe(287.5);
    // Un singur cod, cel care spune DE CE: „peste plafonul lunar" ar fi adevărat
    // și complet inutil când plafonul e zero pentru că lipsește salariul.
    expect(coduri(rezultat)).toEqual(["SAL_DIURNA_FARA_SALARIU_BAZA"]);
    expect(rezultat.probleme[0]?.detalii).toContain("287.50");
  });

  it("salariul negativ e tratat la fel, nu produce un plafon negativ", () => {
    const rezultat = calculeazaDiurna(
      intrare({ salariuBazaBrut: -100, zile: zileConsecutive("DEP-A", 2, 2, 57.5) }),
    );

    expect(rezultat.plafonLunar).toBe(0);
    expect(rezultat.neimpozabila).toBe(0);
    expect(rezultat.impozabila).toBe(115);
    expect(coduri(rezultat)).toEqual(["SAL_DIURNA_FARA_SALARIU_BAZA"]);
  });

  it("depășirea plafonului zilnic se raportează chiar și fără salariu de bază", () => {
    const rezultat = calculeazaDiurna(
      intrare({ salariuBazaBrut: 0, zile: zileConsecutive("DEP-A", 2, 2, 100) }),
    );

    expect(coduri(rezultat)).toEqual([
      "SAL_DIURNA_PESTE_PLAFON_ZILNIC",
      "SAL_DIURNA_FARA_SALARIU_BAZA",
    ]);
  });
});

describe("luna fără nicio zi de diurnă", () => {
  it("dă totul zero, fără nicio problemă", () => {
    const rezultat = calculeazaDiurna(intrare());

    expect(rezultat.totalAcordat).toBe(0);
    expect(rezultat.neimpozabila).toBe(0);
    expect(rezultat.impozabila).toBe(0);
    expect(rezultat.peDeplasare).toEqual([]);
    expect(rezultat.probleme).toEqual([]);
    // Plafonul lunar rămâne raportat: e o proprietate a salariului, nu a
    // zilelor, iar zero l-ar arăta ca inexistent celui care îl afișează.
    expect(rezultat.plafonLunar).toBe(1980);
  });

  it("lista goală nu raportează lipsa salariului de bază — n-a devenit nimic impozabil", () => {
    const rezultat = calculeazaDiurna(intrare({ salariuBazaBrut: 0 }));

    expect(rezultat.probleme).toEqual([]);
    expect(rezultat.plafonLunar).toBe(0);
  });
});

describe("invariantul de sumă", () => {
  const SETURI: readonly (readonly [string, IntrareDiurna])[] = [
    ["lună goală", intrare()],
    ["totul sub plafoane", intrare({ zile: zileConsecutive("DEP-A", 2, 5, 57.5) })],
    [
      "o zi peste plafonul zilnic",
      intrare({ zile: [...zileConsecutive("DEP-A", 2, 4, 57.5), zi("2026-03-06", 100)] }),
    ],
    [
      "peste plafonul lunar",
      intrare({ salariuBazaBrut: 3000, zile: zileConsecutive("DEP-A", 2, 20, 57.5) }),
    ],
    [
      "ambele plafoane",
      intrare({ salariuBazaBrut: 3000, zile: zileConsecutive("DEP-A", 2, 20, 150) }),
    ],
    [
      "bani impari, trei țări, trei deplasări",
      intrare({
        salariuBazaBrut: 4237.83,
        zile: [
          ...zileConsecutive("DEP-A", 2, 3, 61.37, 23.33),
          ...zileConsecutive("DEP-B", 8, 2, 512.19, BAREM_EXTERN),
          ...zileConsecutive("DEP-C", 14, 7, 0.07, 23.33),
        ],
      }),
    ],
    [
      "sume mărunte sub un ban pe zi",
      intrare({
        salariuBazaBrut: 100,
        zile: [
          ...zileConsecutive("DEP-A", 2, 9, 0.004, 23.33),
          ...zileConsecutive("DEP-B", 12, 9, 0.006, 23.33),
        ],
      }),
    ],
    [
      "fără salariu de bază",
      intrare({ salariuBazaBrut: 0, zile: zileConsecutive("DEP-A", 2, 5, 57.5) }),
    ],
    [
      "multiplicator zero — niciun leu neimpozabil",
      intrare({ multiplicatorPlafonZilnic: 0, zile: zileConsecutive("DEP-A", 2, 5, 57.5) }),
    ],
    [
      "fracțiune lunară zero",
      intrare({ fractiePlafonLunar: 0, zile: zileConsecutive("DEP-A", 2, 5, 57.5) }),
    ],
    [
      // Depășirile însumează exact 370,955 lei — o jumătate de ban. Vezi testul
      // „ordinea rândurilor nu poate muta un ban".
      "depășiri care cad pe exact o jumătate de ban",
      intrare({
        zile: [
          zi("2026-03-03", 281.39, 87.5),
          zi("2026-03-04", 171.14, 39.99),
          zi("2026-03-05", 200.17, 23),
          zi("2026-03-07", 249.89, 66.67, "DEP-B"),
          zi("2026-03-08", 177.94, 66.67, "DEP-B"),
        ],
      }),
    ],
  ];

  it("INVARIANT: neimpozabila + impozabila dau exact totalul acordat, la ban", () => {
    for (const [nume, set] of SETURI) {
      const rezultat = calculeazaDiurna(set);

      expect(bani(rezultat.neimpozabila) + bani(rezultat.impozabila), nume).toBe(
        bani(rezultat.totalAcordat),
      );

      for (const parte of rezultat.peDeplasare) {
        expect(
          bani(parte.neimpozabila) + bani(parte.impozabila),
          `${nume} / ${parte.deplasareId}`,
        ).toBe(bani(parte.sumaTotala));
      }
    }
  });

  it("INVARIANT: totalurile sunt suma deplasărilor, nu o a doua numărătoare", () => {
    for (const [nume, set] of SETURI) {
      const rezultat = calculeazaDiurna(set);
      const aduna = (alege: (parte: DiurnaPeDeplasare) => number): number =>
        rezultat.peDeplasare.reduce((total, parte) => total + bani(alege(parte)), 0);

      expect(
        aduna((parte) => parte.sumaTotala),
        nume,
      ).toBe(bani(rezultat.totalAcordat));
      expect(
        aduna((parte) => parte.neimpozabila),
        nume,
      ).toBe(bani(rezultat.neimpozabila));
      expect(
        aduna((parte) => parte.impozabila),
        nume,
      ).toBe(bani(rezultat.impozabila));
    }
  });

  it("INVARIANT: partea neimpozabilă nu trece niciodată peste plafonul lunar și nu e negativă", () => {
    for (const [nume, set] of SETURI) {
      const rezultat = calculeazaDiurna(set);

      expect(bani(rezultat.neimpozabila), nume).toBeLessThanOrEqual(bani(rezultat.plafonLunar));
      expect(rezultat.neimpozabila, nume).toBeGreaterThanOrEqual(0);
      expect(rezultat.impozabila, nume).toBeGreaterThanOrEqual(0);

      // Și PE FIECARE DEPLASARE, nu doar la total: banul de rest al repartizării
      // proporționale se adaugă unei singure deplasări, iar o deplasare integral
      // impozabilă (sau de zero lei) care l-ar primi ar ajunge cu impozabila
      // negativă — invizibil în totalul care rămâne, totuși, corect.
      for (const parte of rezultat.peDeplasare) {
        const unde = `${nume} / ${parte.deplasareId}`;
        expect(parte.neimpozabila, unde).toBeGreaterThanOrEqual(0);
        expect(parte.impozabila, unde).toBeGreaterThanOrEqual(0);
        expect(bani(parte.neimpozabila), unde).toBeLessThanOrEqual(bani(parte.sumaTotala));
      }
    }
  });

  it("INVARIANT: același set de zile în altă ordine dă exact aceleași sume", () => {
    // Se compară pe deplasări SORTATE, nu în ordinea din rezultat: `peDeplasare`
    // urmează declarat prima apariție în `zile`, deci ordinea LUI are voie să se
    // schimbe. Sumele nu.
    const amprenta = (rezultat: ReturnType<typeof calculeazaDiurna>): string =>
      JSON.stringify([
        rezultat.totalAcordat,
        rezultat.neimpozabila,
        rezultat.impozabila,
        rezultat.plafonLunar,
        dupaId(rezultat.peDeplasare),
        rezultat.probleme,
      ]);

    for (const [nume, set] of SETURI) {
      const referinta = amprenta(calculeazaDiurna(set));

      for (const ordine of ordiniEsantion(set.zile)) {
        expect(
          amprenta(calculeazaDiurna({ ...set, zile: ordine })),
          `${nume} / ${ordine.map((z) => `${z.data}:${String(z.sumaAcordata)}`).join(" ")}`,
        ).toBe(referinta);
      }
    }
  });

  it("INVARIANT: un cod de depășire apare doar când a devenit efectiv ceva impozabil", () => {
    for (const [nume, set] of SETURI) {
      const rezultat = calculeazaDiurna(set);

      if (coduri(rezultat).length > 0) {
        expect(bani(rezultat.impozabila), nume).toBeGreaterThan(0);
      }
    }
  });
});

describe("date imposibile", () => {
  it("o sumă negativă oprește calculul în loc să inventeze o corecție", () => {
    expect(() => calculeazaDiurna(intrare({ zile: [zi("2026-03-02", -50)] }))).toThrow(RangeError);
  });

  it("un barem negativ oprește calculul", () => {
    expect(() => calculeazaDiurna(intrare({ zile: [zi("2026-03-02", 50, -23)] }))).toThrow(
      RangeError,
    );
  });

  it("o rată nefinită oprește calculul, nu produce un plafon NaN", () => {
    expect(() =>
      calculeazaDiurna(
        intrare({ multiplicatorPlafonZilnic: Number.NaN, zile: [zi("2026-03-02", 50)] }),
      ),
    ).toThrow(RangeError);
    expect(() =>
      calculeazaDiurna(intrare({ fractiePlafonLunar: -0.1, zile: [zi("2026-03-02", 50)] })),
    ).toThrow(RangeError);
    expect(() =>
      calculeazaDiurna(
        intrare({ salariuBazaBrut: Number.POSITIVE_INFINITY, zile: [zi("2026-03-02", 50)] }),
      ),
    ).toThrow(RangeError);
  });

  it("o sumă sau un barem NaN opresc calculul, nu contaminează tăcut comparațiile", () => {
    // `NaN - orice` e NaN, iar `NaN > 0` e fals: fără verificarea asta, o zi cu
    // sumă NaN nu produce nicio depășire, nicio problemă și niciun total — doar
    // un `NaN` care ajunge pe fluturaș.
    expect(() => calculeazaDiurna(intrare({ zile: [zi("2026-03-02", Number.NaN)] }))).toThrow(
      RangeError,
    );
    expect(() => calculeazaDiurna(intrare({ zile: [zi("2026-03-02", 50, Number.NaN)] }))).toThrow(
      RangeError,
    );
    expect(() =>
      calculeazaDiurna(intrare({ zile: [zi("2026-03-02", Number.POSITIVE_INFINITY)] })),
    ).toThrow(RangeError);
  });

  it("o sumă absurd de mare oprește calculul în loc să piardă tăcut precizia", () => {
    // Acumularea lunii se face pe întregi, în milionimi de ban. Peste ~90 de
    // milioane de lei aritmetica ar ieși din intervalul exact al lui `Number` și
    // ar începe să piardă bani fără să spună nimic — pragul e și cel la care o
    // valoare e aproape sigur lei confundați cu bani.
    expect(() => calculeazaDiurna(intrare({ zile: [zi("2026-03-02", 1e12)] }))).toThrow(RangeError);

    // Sub prag, o sumă mare rămâne un calcul normal.
    const rezultat = calculeazaDiurna(
      intrare({ salariuBazaBrut: 1e6, zile: [zi("2026-03-02", 1e6, BAREM_FARA_LIMITA)] }),
    );
    expect(rezultat.totalAcordat).toBe(1e6);
  });

  it("un multiplicator absurd de mare nu produce o depășire negativă", () => {
    // `verificaRata` acceptă orice număr finit nenegativ, deci plafonul zilnic
    // poate ieși mai mare decât suma zilei. Depășirea trebuie să rămână zero.
    const rezultat = calculeazaDiurna(
      intrare({ multiplicatorPlafonZilnic: Number.MAX_VALUE, zile: [zi("2026-03-02", 57.5)] }),
    );

    expect(rezultat.impozabila).toBe(0);
    expect(rezultat.neimpozabila).toBe(57.5);
    expect(rezultat.probleme).toEqual([]);
  });
});
