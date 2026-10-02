// src/domain/payroll/calc.lacune.test.ts
//
// Lacunele confirmate de audit în motorul de salarizare. Fiecare bloc de mai
// jos fie fixează o regulă documentată în cod, fie — unde regula e marcată ⚠
// în NOTES.md — fixează comportamentul ACTUAL, ca o schimbare să nu treacă
// neobservată până la răspunsul contabilului.
//
// `it.fails("DEFECT: …")` descrie comportamentul CORECT pe care codul de azi
// nu-l respectă. Suita rămâne verde; la reparare testul devine roșu și trebuie
// trecut pe `it`.

import { describe, expect, it } from "vitest";

import { calculatePayrollEntry, type PayrollCalcInput, type PayrollSettingsSnapshot } from "./calc";
import type { CertificatMedical, CodIndemnizatie } from "./etape/indemnizatie-cm";

/** Aceleași cote ilustrative ca în `calc.test.ts` — NU cotele legale. */
const SETARI: PayrollSettingsSnapshot = {
  valabilDeLa: "2026-01-01",
  cotaCas: 0.25,
  cotaCass: 0.1,
  cotaImpozit: 0.1,
  cotaCamAngajator: 0.0225,
  normaZilnicaOre: 8,
  procentSporNoapte: 0.25,
  procentSporWeekend: 0,
  procentOreSuplimentare: 0.75,
  valoareTichetMasa: 30,
  ticheteImpozabile: false,
  deducerePersonala: [
    { nrPersoaneIntretinereMin: 0, nrPersoaneIntretinereMax: 0, venitBrutMax: 4000, valoare: 600 },
    { nrPersoaneIntretinereMin: 1, nrPersoaneIntretinereMax: 1, venitBrutMax: 4000, valoare: 750 },
  ],
  rotunjireLei: false,
};

const PONTAJ_STANDARD = {
  zileLucratoareLuna: 21,
  zileLucrate: 21,
  oreLucrate: 168,
  oreSuplimentare: 0,
  oreNoapte: 0,
  zileConcediuOdihna: 0,
  zileConcediuMedical: 0,
  zileAbsentaNemotivata: 0,
} as const;

function calculeaza(peste: Partial<PayrollCalcInput> = {}) {
  return calculatePayrollEntry({
    settings: SETARI,
    contract: { salariuBaza: 5000, nrPersoaneIntretinere: 0 },
    attendance: PONTAJ_STANDARD,
    bonuses: [],
    deductions: [],
    ...peste,
  });
}

// ── Concediul de odihnă prin etapa de indemnizație ─────────────────────────

describe("calculatePayrollEntry — indemnizația de concediu de odihnă, prin etapă", () => {
  const CU_CO = {
    attendance: { ...PONTAJ_STANDARD, zileLucrate: 16, oreLucrate: 128, zileConcediuOdihna: 5 },
    concediuOdihna: { mod: "baza", istoric: [], luniNecesare: 3 },
  } as const;

  it("zilele de concediu nu se plătesc de două ori: brutul rămâne salariul lunii", () => {
    const r = calculeaza(CU_CO);
    // 5000/21 × 5 = 1190,476… → 1190,48; restul de 16 zile = 3809,52.
    expect(r.indemnizatieCo).toBeCloseTo(1190.48, 2);
    expect(r.bazaSalariu).toBeCloseTo((5000 / 21) * 16, 2);
    expect(r.brut).toBeCloseTo(5000, 2);
    expect(r.warnings.map((w) => w.cod)).not.toContain("INDEMNIZATIE_CO_SIMPLIFICATA");
  });

  // Indemnizația de CO e venit de natură salarială: pe calea fără etapă, zilele
  // de concediu stau în `bazaSalariu` și poartă CAS, CASS și impozit. Etapa le
  // scoate din `bazaSalariu` ca să nu fie plătite de două ori (`zilePlatite`),
  // dar `bazaComuna` nu adaugă `indemnizatieCo` la loc.
  it.fails(
    "DEFECT: indemnizația de CO intră în bazele CAS, CASS și impozit, ca salariul pe care îl înlocuiește",
    () => {
      const r = calculeaza(CU_CO);
      expect(r.bazaCas).toBeCloseTo(5000, 2);
      expect(r.bazaCass).toBeCloseTo(5000, 2);
      expect(r.cas).toBeCloseTo(1250, 2);
      expect(r.cass).toBeCloseTo(500, 2);
      expect(r.bazaImpozit).toBeCloseTo(3250, 2);
      expect(r.impozit).toBeCloseTo(325, 2);
      expect(r.net).toBeCloseTo(2925, 2);
    },
  );

  it.fails(
    "DEFECT: același concediu dă același net cu și fără etapa de indemnizație, la modul „baza”",
    () => {
      const faraEtapa = calculeaza({ attendance: CU_CO.attendance });
      const cuEtapa = calculeaza(CU_CO);
      expect(cuEtapa.net).toBeCloseTo(faraEtapa.net, 2);
    },
  );
});

// ── Diurna impozabilă ──────────────────────────────────────────────────────

describe("calculatePayrollEntry — diurna peste plafonul zilnic", () => {
  const CU_DIURNA = {
    diurna: {
      zile: [{ data: "2026-03-10", sumaAcordata: 100, baremLegalZi: 23, deplasareId: "D1" }],
      multiplicatorPlafonZilnic: 2.5,
      fractiePlafonLunar: 0.33,
    },
  } as const;

  it("partea peste plafon intră în brut, iar partea din plafon merge direct la plată", () => {
    const r = calculeaza(CU_DIURNA);
    // Plafonul zilnic e 23 × 2,5 = 57,5; din 100 de lei, 42,5 sunt impozabili.
    expect(r.diurnaNeimpozabila).toBeCloseTo(57.5, 2);
    expect(r.diurnaImpozabila).toBeCloseTo(42.5, 2);
    expect(r.brut).toBeCloseTo(5042.5, 2);
  });

  // Antetul `etape/diurna-plafoane.ts` și comentariul de la diurnă din calc.ts:
  // partea de peste plafon „devine venit asimilat salariului: intră în brut și
  // trece prin CAS + CASS + impozit”. `bazaCas` și `bazaCass` n-o adună.
  it.fails("DEFECT: diurna impozabilă trece prin CAS, CASS și impozit", () => {
    const r = calculeaza(CU_DIURNA);
    expect(r.bazaCas).toBeCloseTo(5042.5, 2);
    expect(r.bazaCass).toBeCloseTo(5042.5, 2);
    expect(r.cas).toBeCloseTo(1260.63, 2);
    expect(r.cass).toBeCloseTo(504.25, 2);
    // 5042,5 − 1260,625 − 504,25 = 3277,625
    expect(r.bazaImpozit).toBeCloseTo(3277.63, 2);
    expect(r.impozit).toBeCloseTo(327.76, 2);
    expect(r.restDePlata).toBeCloseTo(3007.36, 2);
  });
});

// ── Componentă impozabilă care intră doar în baza de sănătate ──────────────

describe("calculatePayrollEntry — componentă în CASS, nu în CAS, dar impozabilă", () => {
  const COMPONENTA = {
    bonuses: [{ suma: 400, impozabil: true, supusContributii: true, intraInBazaCas: false }],
  } as const;

  it("componenta intră în brut și în baza CASS, nu și în baza CAS", () => {
    const r = calculeaza(COMPONENTA);
    expect(r.brut).toBeCloseTo(5400, 2);
    expect(r.bazaCas).toBeCloseTo(5000, 2);
    expect(r.bazaCass).toBeCloseTo(5400, 2);
  });

  // `bazaImpozit` pornește de la `bazaCasFinala` și adaugă numai
  // primele cu `impozabil && !supusContributii`. Componenta de mai sus are
  // `impozabil: true`, deci e venit impozabil — dar nu ajunge în nicio bază.
  it.fails("DEFECT: un venit impozabil intră în baza de impozit oricare i-ar fi baza CAS", () => {
    const r = calculeaza(COMPONENTA);
    // 5400 − 1250 − 540 = 3610
    expect(r.bazaImpozit).toBeCloseTo(3610, 2);
    expect(r.impozit).toBeCloseTo(361, 2);
    expect(r.net).toBeCloseTo(3249, 2);
  });
});

// ── Sărbătoarea compensată cu zi liberă ────────────────────────────────────

describe("calculatePayrollEntry — munca în sărbătoare, compensată sau plătită", () => {
  const SETARI_SARBATOARE = { ...SETARI, procentSporSarbatoare: 1 };
  const PONTAJ_SARBATOARE = { ...PONTAJ_STANDARD, oreNormaleSarbatoare: 8 };

  function cuSarbatoare(tip: "zi_libera" | "spor", acordata: boolean) {
    return calculeaza({
      settings: SETARI_SARBATOARE,
      attendance: PONTAJ_SARBATOARE,
      compensari: {
        sarbatori: [
          {
            dataSarbatorii: "2026-06-01",
            oreLucrate: 8,
            tip,
            acordata,
            termenAcordare: "2026-07-01",
            sporProcent: tip === "spor" ? 100 : null,
          },
        ],
        suplimentare: [],
        ziReferinta: "2026-06-30",
        zileAvertizareTermen: 7,
      },
    });
  }

  it("o sărbătoare plătită cu spor primește tariful orar plus sporul", () => {
    const r = cuSarbatoare("spor", false);
    // 8 × (5000/168) × (1 + 1) = 476,19
    expect(r.sporSarbatoare).toBeCloseTo(476.19, 2);
    expect(r.brut).toBeCloseTo(5476.19, 2);
  });

  // Antetul `etape/compensare-ore.ts`: „Cele două forme se exclud: dacă ziua
  // liberă a fost efectiv ACORDATĂ, sporul nu se mai datorează.” Etapa întoarce
  // `oreSarbatoareCompensate`, dar `sporSarbatoare` plătește tot `oreNormaleSarbatoare`.
  it.fails("DEFECT: ziua liberă acordată stinge plata orelor de sărbătoare", () => {
    const r = cuSarbatoare("zi_libera", true);
    expect(r.sporSarbatoare).toBe(0);
    expect(r.brut).toBeCloseTo(5000, 2);
  });
});

// ── Scutirea de impozit cu plafon ──────────────────────────────────────────

describe("calculatePayrollEntry — scutire de impozit cu plafon lunar, brut peste plafon", () => {
  const PESTE_PLAFON = {
    contract: {
      salariuBaza: 15000,
      nrPersoaneIntretinere: 0,
      exemptii: [{ procentScutire: 1, plafonLunar: 10000 }],
    },
  } as const;

  it("contribuțiile se calculează pe tot brutul, scutirea nu le atinge", () => {
    const r = calculeaza(PESTE_PLAFON);
    expect(r.cas).toBeCloseTo(3750, 2);
    expect(r.cass).toBeCloseTo(1500, 2);
    expect(r.scutireFiscala).toBeCloseTo(10000, 2);
  });

  // Scutirea e o mărime BRUTĂ (min(brut, plafon) × procent), scăzută dintr-o
  // bază deja netă de CAS și CASS (`scutireFiscala`, `bazaImpozit`): 15000 − 3750 − 1500 − 10000
  // e negativ, tăiat la 0. Partea de 5000 de peste plafon nu mai e impozitată.
  // Cu contribuțiile aferente acelei părți: 5000 − 1250 − 500 = 3250, impozit
  // 325 — formula exactă e de confirmat (NOTES.md §3 Fiscal, facilitățile
  // sectoriale), dar orice formulă impozitează partea de peste plafon.
  it.fails("DEFECT: partea de venit de peste plafonul scutirii se impozitează", () => {
    const r = calculeaza(PESTE_PLAFON);
    expect(r.bazaImpozit).toBeGreaterThan(0);
    expect(r.bazaImpozit).toBeLessThanOrEqual(15000 - 10000);
    expect(r.impozit).toBeGreaterThan(0);
  });
});

// ── Baza minimă de contribuții ─────────────────────────────────────────────

describe("calculatePayrollEntry — baza CAS/CASS ridicată la minim, efectul pe net", () => {
  // Valoare de confirmat: NOTES.md §3 Fiscal (salariul minim și regimul bazei
  // minime). Codul reține de la angajat CAS și CASS pe minim și calculează
  // impozitul pe baza ridicată. Citirea „diferența o suportă angajatorul” ar
  // da cas 500, cass 200, bazaImpozit 700, impozit 70 și net 1230. Testul
  // fixează comportamentul ACTUAL până la răspunsul contabilului.
  it("fixează contribuțiile, impozitul și netul calculate azi", () => {
    const r = calculeaza({
      settings: { ...SETARI, salariuMinimBrut: 4050, aplicaMinimContributii: true },
      contract: { salariuBaza: 2000, nrPersoaneIntretinere: 0 },
    });
    expect(r.brut).toBe(2000);
    expect(r.cas).toBeCloseTo(1012.5, 2);
    expect(r.cass).toBeCloseTo(405, 2);
    expect(r.deducerePersonala).toBe(600);
    // 4050 − 1012,5 − 405 − 600
    expect(r.bazaImpozit).toBeCloseTo(2032.5, 2);
    expect(r.impozit).toBeCloseTo(203.25, 2);
    expect(r.net).toBeCloseTo(379.25, 2);
    expect(r.net).toBeGreaterThanOrEqual(0);
  });
});

// ── Coloanele fluturașului se verifică cu creionul ─────────────────────────

describe("calculatePayrollEntry — netul afișat închide cu coloanele afișate", () => {
  // Antetul `src/domain/bani.ts`: „la final suma coloanelor per angajat nu mai
  // închide cu totalul” e exact ce verifică un contabil primul. calc.ts lucrează
  // în virgulă mobilă și rotunjește fiecare câmp separat la final.
  it.fails("DEFECT: net = brut − CAS − CASS − impozit, pe valorile rotunjite la ban", () => {
    const r = calculeaza({ contract: { salariuBaza: 4000.04, nrPersoaneIntretinere: 0 } });
    // Azi: 4000,04 − 1000,01 − 400,00 − 260,00 = 2340,03, dar netul e 2340,02.
    expect(r.net).toBeCloseTo(r.brut - r.cas - r.cass - r.impozit, 2);
  });

  it.fails("DEFECT: cu rotunjire la leu, netul întreg închide cu coloanele întregi", () => {
    const r = calculeaza({
      settings: { ...SETARI, rotunjireLei: true },
      contract: { salariuBaza: 4004, nrPersoaneIntretinere: 0 },
    });
    // Azi: cas 1001, cass 400, impozit 260, net 2342 — dar 4004 − 1661 = 2343.
    expect(r.net).toBe(r.brut - r.cas - r.cass - r.impozit);
  });
});

// ── Indemnizația de concediu medical, prin motor ───────────────────────────

describe("calculatePayrollEntry — indemnizația de concediu medical", () => {
  const COD_01: CodIndemnizatie = {
    cod: "01",
    procent: 75,
    zileAngajator: 5,
    platitor: "mixt",
    luniBazaCalcul: 6,
    plafonSalariiMinime: null,
    retineCas: true,
    retineImpozit: true,
    retineCass: true,
  };

  function certificat(cod: CodIndemnizatie): CertificatMedical {
    return {
      serie: "AA",
      numar: "1001",
      dataInceput: "2026-08-03",
      dataSfarsit: "2026-08-12",
      zileCalendaristice: 10,
      zileLucratoare: 8,
      esteContinuare: false,
      cod,
    };
  }

  const ISTORIC = Array.from({ length: 6 }, (_, i) => ({
    an: 2026,
    luna: 7 - i,
    venitBrut: 6300,
    zileLucrate: 21,
  }));

  function cuCm(cod: CodIndemnizatie) {
    return calculeaza({
      contract: { salariuBaza: 6300, nrPersoaneIntretinere: 0 },
      attendance: { ...PONTAJ_STANDARD, zileLucrate: 13, oreLucrate: 104, zileConcediuMedical: 8 },
      concediuMedical: {
        certificate: [certificat(cod)],
        istoric: ISTORIC,
        salariuMinimBrut: 4050,
        zileAngajatorDejaConsumate: 0,
      },
    });
  }

  it("boala obișnuită: indemnizația intră în brut și în toate trei bazele codului", () => {
    const r = cuCm(COD_01);
    // Bază zilnică 300, 75% → 225 lei/zi × 8 zile lucrătoare = 1800.
    expect(r.bazaZilnicaCm).toBeCloseTo(300, 2);
    expect(r.indemnizatieCmAngajator + r.indemnizatieCmFnuass).toBeCloseTo(1800, 2);
    expect(r.bazaSalariu).toBeCloseTo(3900, 2);
    expect(r.brut).toBeCloseTo(5700, 2);
    expect(r.bazaCas).toBeCloseTo(5700, 2);
    expect(r.bazaCass).toBeCloseTo(5700, 2);
    expect(r.cas).toBeCloseTo(1425, 2);
    expect(r.cass).toBeCloseTo(570, 2);
    expect(r.bazaImpozit).toBeCloseTo(3705, 2);
    expect(r.impozit).toBeCloseTo(370.5, 2);
    expect(r.net).toBeCloseTo(3334.5, 2);
    expect(r.warnings.map((w) => w.cod)).not.toContain("CONCEDIU_MEDICAL_NECALCULAT");
  });

  // Valoare de confirmat: NOTES.md §3 Concedii (codurile de indemnizație CM și
  // reținerile lor). Pentru maternitate (CAS da, impozit nu), CAS-ul de 450 lei
  // reținut din indemnizația NEIMPOZABILĂ se scade azi și din baza de impozit a
  // salariului: 5700 + (0 − 1800) − 1425 − 390 = 2085. Citirea „contribuțiile
  // venitului neimpozabil nu reduc baza impozabilă” dă 3900 − 975 − 390 = 2535 și
  // impozit 253,5. Testul fixează comportamentul ACTUAL.
  it("maternitate: fixează baza de impozit calculată azi", () => {
    const r = cuCm({
      ...COD_01,
      cod: "11",
      retineCas: true,
      retineImpozit: false,
      retineCass: false,
    });
    expect(r.brut).toBeCloseTo(5700, 2);
    expect(r.bazaCas).toBeCloseTo(5700, 2);
    expect(r.bazaCass).toBeCloseTo(3900, 2);
    expect(r.bazaImpozit).toBeCloseTo(2085, 2);
    expect(r.impozit).toBeCloseTo(208.5, 2);
  });
});

// ── Poprire unică de întreținere ───────────────────────────────────────────

describe("calculatePayrollEntry — o singură poprire, creanță de întreținere", () => {
  // Valoare de confirmat: NOTES.md §3 Fiscal (plafonul legal al reținerilor) și
  // punctul 1 din antetul `etape/retineri-popriri.ts`. Art. 729 alin. (1) lit. a)
  // CPC ar ridica plafonul la 1/2 pentru întreținere chiar cu un singur dosar;
  // motorul trimite `plafonPoprireUnica` fără să se uite la `esteIntretinere`.
  // Pe netul de 2925, citirea 1/2 ar reține 1400; azi se rețin 975 (1/3).
  it("fixează plafonul de o treime aplicat azi și unei creanțe de întreținere", () => {
    const r = calculeaza({
      popriri: {
        dosare: [
          {
            id: "P1",
            sumaLunara: 1400,
            soldRamas: 9000,
            esteIntretinere: true,
            prioritate: 1,
            dosar: "100/2026",
          },
        ],
        retineri: [],
        plafonPoprireUnica: 1 / 3,
        plafonPopririConcurente: 1 / 2,
      },
    });
    expect(r.net).toBeCloseTo(2925, 2);
    expect(r.retineriTotal).toBeCloseTo(975, 2);
    expect(r.retineriAplicate[0]?.aplicata).toBeCloseTo(975, 2);
    expect(r.netDePlata).toBeCloseTo(1950, 2);
  });
});

// ── Pragul orelor de noapte, pe lună ───────────────────────────────────────

describe("calculatePayrollEntry — pragul de noapte aplicat pe totalul lunii", () => {
  // Valoare de confirmat: NOTES.md §3 Timp de muncă (prag de ore de noapte).
  // Art. 125–126 leagă sporul de cel puțin 3 ore de noapte PE ZI; `sporNoapteSeAplica`
  // compară pragul cu totalul lunii, ca aproximare declarată. 20 de ture de câte
  // o oră de noapte n-ar trece pragul în nicio zi, dar trec împreună. Reparația
  // cere orele eligibile pe zile în `pontaj_agregat_salarizare`.
  it("20 de zile cu câte o oră de noapte primesc azi spor pe toate cele 20 de ore", () => {
    const r = calculeaza({
      settings: { ...SETARI, pragOreNoapte: 3 },
      attendance: { ...PONTAJ_STANDARD, oreNoapte: 20 },
    });
    expect(r.sporNoapte).toBeCloseTo(20 * (5000 / 168) * 0.25, 2);
    expect(r.warnings.map((w) => w.cod)).not.toContain("SAL_SPOR_NOAPTE_SUB_PRAG");
  });
});
