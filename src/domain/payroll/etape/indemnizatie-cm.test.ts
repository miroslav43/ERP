// src/domain/payroll/etape/indemnizatie-cm.test.ts
//
// Cifrele sunt alese ca să iasă rotunde și verificabile pe hârtie:
// 6 luni × 6300 lei / 21 zile lucrate = 37 800 / 126 = 300 lei bază zilnică,
// iar 75% din ea înseamnă 225 lei pe zi lucrătoare.

import { describe, expect, it } from "vitest";

import {
  calculeazaIndemnizatieCm,
  type CertificatMedical,
  type CodIndemnizatie,
  type IntrareIndemnizatieCm,
  type LunaIstoricCm,
} from "./indemnizatie-cm";

/**
 * Boală obișnuită, exact ca în nomenclatorul din migrarea 0009: 75%, primele 5
 * zile calendaristice la firmă, plafon de 12 salarii minime, bază pe 6 luni.
 */
const COD_01: CodIndemnizatie = {
  cod: "01",
  procent: 75,
  zileAngajator: 5,
  platitor: "mixt",
  luniBazaCalcul: 6,
  plafonSalariiMinime: 12,
};

/** Același cod, fără plafon — codurile 03, 05, 09, 10 chiar n-au plafon. */
const COD_01_FARA_PLAFON: CodIndemnizatie = { ...COD_01, plafonSalariiMinime: null };

/** Accident de muncă — 100%, firma nu suportă nimic. */
const COD_03: CodIndemnizatie = {
  cod: "03",
  procent: 100,
  zileAngajator: 0,
  platitor: "fnuass",
  luniBazaCalcul: 6,
  plafonSalariiMinime: null,
};

/**
 * Cod INVENTAT pentru testarea ramurii `platitor = 'angajator'`. Nomenclatorul
 * din 0009 nu are azi niciun astfel de cod, dar enumul `medical_payer` îl
 * permite, deci ramura există și trebuie acoperită.
 */
const COD_TOT_ANGAJATOR: CodIndemnizatie = {
  cod: "99",
  procent: 75,
  zileAngajator: 5,
  platitor: "angajator",
  luniBazaCalcul: 6,
  plafonSalariiMinime: null,
};

function luna(peste: Partial<LunaIstoricCm> = {}): LunaIstoricCm {
  return { an: 2026, luna: 1, venitBrut: 6300, zileLucrate: 21, ...peste };
}

/** `n` luni identice, cele mai recente primele — exact ce cere contractul funcției. */
function istoric(n: number, peste: Partial<LunaIstoricCm> = {}): readonly LunaIstoricCm[] {
  return Array.from({ length: n }, (_, i) => luna({ luna: 7 - i, ...peste }));
}

function certificat(peste: Partial<CertificatMedical> = {}): CertificatMedical {
  return {
    serie: "AA",
    numar: "1001",
    dataInceput: "2026-08-03",
    dataSfarsit: "2026-08-12",
    zileCalendaristice: 10,
    zileLucratoare: 8,
    esteContinuare: false,
    cod: COD_01,
    ...peste,
  };
}

function intrare(peste: Partial<IntrareIndemnizatieCm> = {}): IntrareIndemnizatieCm {
  return {
    certificate: [certificat()],
    istoric: istoric(6),
    salariuMinimBrut: 4050,
    zileLucratoareLuna: 21,
    zileAngajatorDejaConsumate: 0,
    ...peste,
  };
}

const coduriProbleme = (rezultat: { probleme: readonly { cod: string }[] }): string[] =>
  rezultat.probleme.map((p) => p.cod);

describe("calculeazaIndemnizatieCm — cazul obișnuit, cod 01", () => {
  it("baza zilnică e media brută pe zi LUCRATĂ, iar 75% din ea se plătește pe zile lucrătoare", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare());

    expect(rezultat.bazaZilnica).toBe(300);
    expect(rezultat.bazaZilnicaPlafonata).toBe(false);
    expect(rezultat.luniFolosite).toBe(6);
    expect(coduriProbleme(rezultat)).toEqual([]);

    // 5 din 10 zile calendaristice la firmă → jumătate din cele 8 zile lucrătoare.
    expect(rezultat.peCertificat).toEqual([
      {
        serie: "AA",
        numar: "1001",
        cod: "01",
        zileAngajator: 4,
        zileFnuass: 4,
        sumaAngajator: 900,
        sumaFnuass: 900,
      },
    ]);
    expect(rezultat.totalAngajator).toBe(900);
    expect(rezultat.totalFnuass).toBe(900);
    expect(rezultat.total).toBe(1800);
  });

  it("zilele raportate sunt cele LUCRĂTOARE și acoperă exact certificatul", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare());
    const linie = rezultat.peCertificat[0];
    expect(linie).toBeDefined();
    expect((linie?.zileAngajator ?? 0) + (linie?.zileFnuass ?? 0)).toBe(8);
  });

  it("totalul e suma celor două părți", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare());
    expect(rezultat.total).toBe(rezultat.totalAngajator + rezultat.totalFnuass);
  });

  it("fără niciun certificat rezultatul e gol și NU se reclamă lipsa istoricului", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare({ certificate: [], istoric: [] }));
    expect(rezultat.total).toBe(0);
    expect(rezultat.bazaZilnica).toBe(0);
    expect(rezultat.luniFolosite).toBe(0);
    expect(rezultat.peCertificat).toEqual([]);
    expect(coduriProbleme(rezultat)).toEqual([]);
  });
});

describe("calculeazaIndemnizatieCm — plătitorul", () => {
  it("codul cu plătitor 'fnuass' nu lasă nicio zi în sarcina firmei", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({ certificate: [certificat({ cod: COD_03 })] }),
    );

    expect(rezultat.peCertificat[0]?.zileAngajator).toBe(0);
    expect(rezultat.peCertificat[0]?.zileFnuass).toBe(8);
    expect(rezultat.totalAngajator).toBe(0);
    // 100% din 300 lei × 8 zile lucrătoare.
    expect(rezultat.totalFnuass).toBe(2400);
    expect(coduriProbleme(rezultat)).toEqual([]);
  });

  it("'fnuass' ignoră `zileAngajator` al codului, oricât ar fi", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({ certificate: [certificat({ cod: { ...COD_03, zileAngajator: 30 } })] }),
    );
    expect(rezultat.totalAngajator).toBe(0);
    expect(rezultat.totalFnuass).toBe(2400);
  });

  it("codul cu plătitor 'angajator' lasă totul în sarcina firmei", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({ certificate: [certificat({ cod: COD_TOT_ANGAJATOR })] }),
    );
    expect(rezultat.peCertificat[0]?.zileAngajator).toBe(8);
    expect(rezultat.peCertificat[0]?.zileFnuass).toBe(0);
    expect(rezultat.totalAngajator).toBe(1800);
    expect(rezultat.totalFnuass).toBe(0);
  });
});

describe("calculeazaIndemnizatieCm — contorul de zile de angajator e pe EPISOD", () => {
  it("o continuare pornește din zilele rămase, nu de la capăt", () => {
    // 3 zile consumate înainte de luna calculată → au mai rămas 2 din cele 5.
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        certificate: [certificat({ esteContinuare: true })],
        zileAngajatorDejaConsumate: 3,
      }),
    );

    // 2 din 10 zile calendaristice → 8 × 0,2 = 1,6, rotunjit la 2 zile lucrătoare.
    expect(rezultat.peCertificat[0]?.zileAngajator).toBe(2);
    expect(rezultat.peCertificat[0]?.zileFnuass).toBe(6);
    expect(rezultat.totalAngajator).toBe(450);
    expect(rezultat.totalFnuass).toBe(1350);
    expect(coduriProbleme(rezultat)).toEqual([]);
  });

  it("o continuare cu cele 5 zile deja consumate nu mai primește nimic de la firmă", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        certificate: [certificat({ esteContinuare: true })],
        zileAngajatorDejaConsumate: 5,
      }),
    );

    expect(rezultat.totalAngajator).toBe(0);
    expect(rezultat.peCertificat[0]?.zileFnuass).toBe(8);
    expect(rezultat.totalFnuass).toBe(1800);
    expect(coduriProbleme(rezultat)).toEqual(["SAL_CM_ZILE_ANGAJATOR_EPUIZATE"]);
    expect(rezultat.probleme[0]?.detalii).toContain("AA 1001");
  });

  it("a doua continuare din aceeași lună NU repornește contorul", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        certificate: [
          certificat({
            numar: "1001",
            zileCalendaristice: 4,
            zileLucratoare: 3,
            esteContinuare: true,
          }),
          certificat({ numar: "1002", esteContinuare: true }),
        ],
        zileAngajatorDejaConsumate: 3,
      }),
    );

    // Primul consumă ultimele 2 zile de angajator, al doilea nu mai găsește niciuna.
    expect(rezultat.peCertificat[0]?.zileAngajator).toBe(2);
    expect(rezultat.peCertificat[1]?.zileAngajator).toBe(0);
    expect(rezultat.peCertificat[1]?.zileFnuass).toBe(8);
    expect(coduriProbleme(rezultat)).toEqual(["SAL_CM_ZILE_ANGAJATOR_EPUIZATE"]);
    expect(rezultat.probleme[0]?.detalii).toContain("AA 1002");
  });

  it("un certificat NOU (nu continuare) repornește contorul la zilele codului lui", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        certificate: [
          certificat({
            numar: "1001",
            zileCalendaristice: 4,
            zileLucratoare: 3,
            esteContinuare: true,
          }),
          certificat({ numar: "1002", esteContinuare: false }),
        ],
        zileAngajatorDejaConsumate: 3,
      }),
    );

    expect(rezultat.peCertificat[0]?.zileAngajator).toBe(2);
    // Episod nou: din nou 5 zile calendaristice de firmă → 4 din 8 zile lucrătoare.
    expect(rezultat.peCertificat[1]?.zileAngajator).toBe(4);
    expect(rezultat.peCertificat[1]?.zileFnuass).toBe(4);
    expect(coduriProbleme(rezultat)).toEqual([]);
  });

  it("mai multe certificate în aceeași lună împart aceleași 5 zile calendaristice", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        certificate: [
          certificat({ numar: "1001", zileCalendaristice: 3, zileLucratoare: 2 }),
          certificat({
            numar: "1002",
            zileCalendaristice: 3,
            zileLucratoare: 3,
            esteContinuare: true,
          }),
          certificat({ numar: "1003", esteContinuare: true }),
        ],
      }),
    );

    expect(rezultat.peCertificat.map((linie) => linie.zileAngajator)).toEqual([2, 2, 0]);
    expect(rezultat.peCertificat.map((linie) => linie.zileFnuass)).toEqual([0, 1, 8]);
    expect(rezultat.totalAngajator).toBe(900);
    expect(rezultat.totalFnuass).toBe(2025);
    expect(rezultat.total).toBe(2925);
    expect(coduriProbleme(rezultat)).toEqual(["SAL_CM_ZILE_ANGAJATOR_EPUIZATE"]);
  });
});

describe("calculeazaIndemnizatieCm — plafonarea bazei", () => {
  it("baza care depășește plafonul e tăiată și problema spune ambele valori", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({ istoric: istoric(6, { venitBrut: 63_000 }) }),
    );

    // 12 × 4050 / 21 = 2314,29 lei pe zi, față de 3000 lei cât ar fi ieșit din medie.
    expect(rezultat.bazaZilnica).toBe(2314.29);
    expect(rezultat.bazaZilnicaPlafonata).toBe(true);
    expect(coduriProbleme(rezultat)).toEqual(["SAL_CM_BAZA_PLAFONATA"]);
    expect(rezultat.probleme[0]?.detalii).toContain("3000.00");
    expect(rezultat.probleme[0]?.detalii).toContain("2314.29");

    // Sumele se calculează din baza EXACTĂ, nu din cea afișată: plafonul e
    // 48600/21 = 2314,285714..., 75% din el e 1735,714285..., iar 4 zile fac
    // 6942,857... → 6942,86. Cu baza rotunjită la 2314,29 ar fi ieșit 6942,88 —
    // doi bani apăruți din rotunjire, pe fiecare jumătate de certificat.
    expect(rezultat.totalAngajator).toBe(6942.86);
    expect(rezultat.totalFnuass).toBe(6942.86);
    expect(rezultat.total).toBe(13_885.72);
  });

  it("baza sub plafon rămâne neatinsă", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare());
    expect(rezultat.bazaZilnica).toBe(300);
    expect(rezultat.bazaZilnicaPlafonata).toBe(false);
    expect(coduriProbleme(rezultat)).toEqual([]);
  });

  it("codul fără plafon nu se plafonează niciodată", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        certificate: [certificat({ cod: COD_01_FARA_PLAFON })],
        istoric: istoric(6, { venitBrut: 63_000 }),
      }),
    );
    expect(rezultat.bazaZilnica).toBe(3000);
    expect(rezultat.bazaZilnicaPlafonata).toBe(false);
  });

  it("o lună fără zile lucrătoare nu produce Infinity în plafon", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare({ zileLucratoareLuna: 0 }));
    expect(Number.isFinite(rezultat.total)).toBe(true);
    expect(rezultat.bazaZilnica).toBe(300);
    expect(rezultat.bazaZilnicaPlafonata).toBe(false);
  });
});

describe("calculeazaIndemnizatieCm — istoricul", () => {
  it("mai puține luni decât cere codul: media se face pe ce există, cu avertisment", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare({ istoric: istoric(3) }));

    expect(rezultat.luniFolosite).toBe(3);
    expect(rezultat.bazaZilnica).toBe(300);
    expect(coduriProbleme(rezultat)).toEqual(["SAL_CM_ISTORIC_INCOMPLET"]);
    expect(rezultat.probleme[0]?.detalii).toContain("3");
    expect(rezultat.probleme[0]?.detalii).toContain("6");
    expect(rezultat.total).toBe(1800);
  });

  it("istoric gol: nicio bază de calcul, totul zero, dar zilele rămân împărțite", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare({ istoric: [] }));

    expect(rezultat.bazaZilnica).toBe(0);
    expect(rezultat.luniFolosite).toBe(0);
    expect(rezultat.totalAngajator).toBe(0);
    expect(rezultat.totalFnuass).toBe(0);
    expect(rezultat.total).toBe(0);
    expect(coduriProbleme(rezultat)).toEqual(["SAL_CM_FARA_ISTORIC"]);
    expect(rezultat.probleme[0]?.detalii).toContain("6");
    // Împărțirea pe plătitori nu depinde de bază — ea rămâne raportată.
    expect(rezultat.peCertificat[0]?.zileAngajator).toBe(4);
    expect(rezultat.peCertificat[0]?.sumaAngajator).toBe(0);
  });

  it("istoric numai cu luni fără zile lucrate: tot fără bază, fără dublu avertisment", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({ istoric: istoric(6, { venitBrut: 5000, zileLucrate: 0 }) }),
    );
    expect(rezultat.bazaZilnica).toBe(0);
    expect(rezultat.luniFolosite).toBe(0);
    expect(coduriProbleme(rezultat)).toEqual(["SAL_CM_FARA_ISTORIC"]);
  });

  it("lunile cu zero zile lucrate se sar, iar cele 6 luni se completează din vechime", () => {
    // Două luni fără zile lucrate în față — una dintre ele chiar cu venit, ca să
    // se vadă că nu intră în medie. În spate, 6 luni normale.
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        istoric: [
          luna({ luna: 7, venitBrut: 0, zileLucrate: 0 }),
          luna({ luna: 6, venitBrut: 5000, zileLucrate: 0 }),
          ...istoric(6),
        ],
      }),
    );

    expect(rezultat.luniFolosite).toBe(6);
    expect(rezultat.bazaZilnica).toBe(300);
    expect(coduriProbleme(rezultat)).toEqual([]);
  });

  it("se folosesc cel mult `luniBazaCalcul` luni, chiar dacă istoricul e mai lung", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({ istoric: [...istoric(6), ...istoric(6, { venitBrut: 21_000 })] }),
    );
    // Dacă ar fi intrat și lunile vechi, media ar fi urcat la 650 lei pe zi.
    expect(rezultat.luniFolosite).toBe(6);
    expect(rezultat.bazaZilnica).toBe(300);
  });

  it("venituri inegale: media e pe TOTAL venit / TOTAL zile, nu media mediilor", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        istoric: [
          luna({ luna: 7, venitBrut: 12_600, zileLucrate: 21 }),
          luna({ luna: 6, venitBrut: 1500, zileLucrate: 5 }),
        ],
        certificate: [certificat({ zileCalendaristice: 2, zileLucratoare: 2 })],
      }),
    );
    // (12 600 + 1500) / (21 + 5) = 14 100 / 26 = 542,3076... → 542,31 lei pe zi.
    expect(rezultat.bazaZilnica).toBe(542.31);
    expect(rezultat.luniFolosite).toBe(2);
    expect(coduriProbleme(rezultat)).toEqual(["SAL_CM_ISTORIC_INCOMPLET"]);
    // 75% din 542,31 = 406,73 lei pe zi, 2 zile, ambele la firmă.
    expect(rezultat.totalAngajator).toBe(813.46);
    expect(rezultat.totalFnuass).toBe(0);
  });
});

describe("calculeazaIndemnizatieCm — funcție pură", () => {
  it("nu modifică intrarea și întoarce același rezultat la două apeluri", () => {
    const date = intrare();
    const copie = structuredClone(date) as IntrareIndemnizatieCm;

    const unu = calculeazaIndemnizatieCm(date);
    const doi = calculeazaIndemnizatieCm(date);

    expect(date).toEqual(copie);
    expect(unu).toEqual(doi);
  });
});

describe("calculeazaIndemnizatieCm — cele trei rețineri (0127)", () => {
  /** Boala obișnuită e singurul cod din care se reține și CASS. */
  const COD_01_RETINERI: CodIndemnizatie = {
    ...COD_01,
    retineCas: true,
    retineImpozit: true,
    retineCass: true,
  };
  /** Maternitatea: CAS da, impozit NU (venit neimpozabil), CASS nu. */
  const COD_11: CodIndemnizatie = {
    cod: "11",
    procent: 100,
    zileAngajator: 0,
    platitor: "fnuass",
    luniBazaCalcul: 6,
    plafonSalariiMinime: 12,
    retineCas: true,
    retineImpozit: false,
    retineCass: false,
  };

  it("boala obișnuită intră în toate cele trei baze", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({ certificate: [certificat({ cod: COD_01_RETINERI })] }),
    );

    expect(rezultat.total).toBeGreaterThan(0);
    expect(rezultat.bazaCas).toBe(rezultat.total);
    expect(rezultat.bazaCass).toBe(rezultat.total);
    expect(rezultat.bazaImpozit).toBe(rezultat.total);
  });

  it("maternitatea intră doar în baza CAS — nu se impozitează și nu poartă CASS", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({ certificate: [certificat({ cod: COD_11 })] }),
    );

    expect(rezultat.total).toBeGreaterThan(0);
    expect(rezultat.bazaCas).toBe(rezultat.total);
    expect(rezultat.bazaImpozit).toBe(0);
    expect(rezultat.bazaCass).toBe(0);
  });

  it("o lună cu două coduri diferite dă trei baze distincte", () => {
    const rezultat = calculeazaIndemnizatieCm(
      intrare({
        certificate: [
          certificat({ serie: "AA", numar: "1", cod: COD_01_RETINERI }),
          certificat({
            serie: "BB",
            numar: "2",
            dataInceput: "2026-08-17",
            dataSfarsit: "2026-08-21",
            zileCalendaristice: 5,
            zileLucratoare: 5,
            cod: COD_11,
          }),
        ],
      }),
    );

    const sumaCertificat = (serie: string): number => {
      const linie = rezultat.peCertificat.find((l) => l.serie === serie);
      return (linie?.sumaAngajator ?? 0) + (linie?.sumaFnuass ?? 0);
    };

    // CAS le ia pe amândouă, CASS și impozitul doar pe prima.
    expect(rezultat.bazaCas).toBeCloseTo(rezultat.total, 2);
    expect(rezultat.bazaCass).toBeCloseTo(sumaCertificat("AA"), 2);
    expect(rezultat.bazaImpozit).toBeCloseTo(sumaCertificat("AA"), 2);
    expect(rezultat.bazaCass).toBeLessThan(rezultat.bazaCas);
  });

  it("un cod fără steaguri cade pe implicitele majoritare: CAS și impozit, fără CASS", () => {
    const rezultat = calculeazaIndemnizatieCm(intrare());

    expect(rezultat.bazaCas).toBe(rezultat.total);
    expect(rezultat.bazaImpozit).toBe(rezultat.total);
    expect(rezultat.bazaCass).toBe(0);
  });
});
