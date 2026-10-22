// src/lib/unelte/salariu.paritate.test.ts
//
// Calculatorul public (`calculeazaDinBrut`) și motorul aplicației trebuie să dea
// ACELEAȘI cifre pentru aceeași lună a veniturilor. Partea „motor” e
// `calculatePayrollEntry` chemat cum îl cheamă `calculeazaPerioada`
// (`src/app/(app)/salarizare/actions.ts`): luna perioadei în `lunaVenituri`,
// contractul cu ambele norme, scutirea pentru handicap ca rând din
// `employee_tax_exemptions` (procent 100, fără plafon), setările legale ale lunii
// și regimul fiscal al tichetelor (impozabile, cu CASS, fără CAS și CAM).
//
// Luna intră ca O SINGURĂ zi lucrătoare, ca în calculator (C3, decizia 4): pe 21
// de zile motorul are încă rotunjirea în virgulă mobilă — fixată mai jos ca
// DEFECT, fiindcă repararea ei e decizia utilizatorului (README-ul planului,
// „Decizii care sunt ale tale”, punctul 2). Tichetele lunii intră, deci, ca
// valoarea lor totală pe acea zi.
//
// Unde cele două diferă deliberat, testul o spune pe față, cu ⚠ (întrebare
// deschisă în NOTES.md §3) sau cu `it.fails("DEFECT: …")` (defect al motorului,
// nereparat): o divergență ascunsă e exact ce trebuie să prindă fișierul ăsta.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEDUCERE_COPIL_SCOALA,
  grilaDeducerePersonala,
  PERIOADE_2026,
  PLAFON_DEDUCERE_PESTE_MINIM,
  perioadaPentruZi,
  valoareDeducereDeBaza,
  valoareDeducereSub26,
  type Perioada,
} from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry, type PragDeducerePersonala } from "@/domain/payroll/calc";
import {
  FACILITATE_IANUARIE_IUNIE_2026,
  FACILITATE_IULIE_DECEMBRIE_2026,
} from "@/domain/payroll/etape/facilitate-salariu-minim";
import {
  brutMinimLegal,
  calculeazaDinBrut,
  OPTIUNI_IMPLICITE,
  type OptiuniSalariu,
} from "./salariu";

const LUNILE_2026 = Array.from(
  { length: 12 },
  (_, i) => `2026-${String(i + 1).padStart(2, "0")}`,
) as readonly string[];

const DOMENIU: Readonly<Record<Perioada, typeof FACILITATE_IULIE_DECEMBRIE_2026>> = {
  "2026-1": FACILITATE_IANUARIE_IUNIE_2026,
  "2026-2": FACILITATE_IULIE_DECEMBRIE_2026,
};

type Caz = Readonly<{
  luna: string;
  brut: number;
  persoane?: number;
  functieDeBaza?: boolean;
  oreZi?: number;
  tichete?: Readonly<{ valoare: number; numar: number }>;
  handicap?: boolean;
  sub26?: boolean;
  copiiScoala?: number;
}>;

const perioadaLunii = (luna: string): Perioada => perioadaPentruZi(`${luna}-01`);

function optiuni(c: Caz): OptiuniSalariu {
  return {
    ...OPTIUNI_IMPLICITE,
    perioada: perioadaLunii(c.luna),
    persoane: c.persoane ?? 0,
    functieDeBaza: c.functieDeBaza ?? true,
    oreZi: c.oreZi ?? 8,
    tichete: c.tichete ?? { valoare: 0, numar: 0 },
    scutitImpozit: c.handicap ?? false,
    sub26: c.sub26 ?? false,
    copiiScoala: c.copiiScoala ?? 0,
  };
}

const valoareTichete = (c: Caz): number =>
  c.tichete === undefined ? 0 : Math.round(c.tichete.valoare * c.tichete.numar * 100) / 100;

function unealta(c: Caz) {
  return calculeazaDinBrut(c.brut, optiuni(c));
}

/** Motorul, cu intrarea pe care i-o face `calculeazaPerioada` pentru același om. */
function motorul(
  c: Caz,
  peste: Readonly<{ grila?: readonly PragDeducerePersonala[]; minimContributii?: boolean }> = {},
) {
  const setari = PERIOADE_2026[perioadaLunii(c.luna)].setari;
  const oreZi = c.oreZi ?? 8;
  return calculatePayrollEntry({
    settings: {
      ...setari,
      valoareTichetMasa: valoareTichete(c),
      ticheteImpozabile: true,
      ticheteSupuseCass: true,
      ...(peste.grila === undefined ? {} : { deducerePersonala: peste.grila }),
      ...(peste.minimContributii === true ? { aplicaMinimContributii: true } : {}),
    },
    lunaVenituri: c.luna,
    contract: {
      salariuBaza: c.brut,
      nrPersoaneIntretinere: c.persoane ?? 0,
      normaZilnicaOre: oreZi,
      normaOreSaptamana: oreZi * 5,
      functieDeBaza: c.functieDeBaza ?? true,
      exemptii: c.handicap === true ? [{ procentScutire: 1, plafonLunar: null }] : [],
    },
    attendance: {
      zileLucratoareLuna: 1,
      zileLucrate: 1,
      oreLucrate: oreZi,
      oreSuplimentare: 0,
      oreNoapte: 0,
      zileConcediuOdihna: 0,
      zileConcediuMedical: 0,
      zileAbsentaNemotivata: 0,
    },
    bonuses: [],
    deductions: [],
  });
}

const eticheta = (c: Caz): string => JSON.stringify(c);

/**
 * Deducerea ACORDATĂ de motor: art. 77 alin. (2), „în limita venitului impozabil
 * lunar”. Motorul plafonează doar baza de impozit (nu coboară sub zero), iar
 * coloana rămâne valoarea din grilă; calculatorul o plafonează și pe cea afișată.
 */
const deducereAcordata = (m: ReturnType<typeof motorul>): number =>
  Math.min(
    m.deducerePersonala,
    Math.max(0, m.brut - m.sumaNeimpozabila + m.valoareTichete - m.cas - m.cass),
  );

/** Ce vede angajatul și ce plătește firma pe calea motorului. */
function cifre(c: Caz) {
  const u = unealta(c);
  const m = motorul(c);
  return {
    unealta: [
      u.brut,
      u.cas,
      u.cass,
      u.deducerePersonala,
      u.impozit,
      u.sumaNeimpozabila,
      u.net,
      // Motorul rotunjește coloana tichetelor la leu (`rotunjireLei`), calculatorul
      // o arată la ban: 21 × 40,18 = 843,78 față de 844. Calculul folosește în
      // amândouă valoarea la ban.
      Math.round(u.tichete),
      u.cam,
    ],
    motorul: [
      m.brut,
      m.cas,
      m.cass,
      deducereAcordata(m),
      m.impozit,
      m.sumaNeimpozabila,
      m.net,
      m.valoareTichete,
      m.camAngajator,
    ],
  };
}

function bruturi(minim: number, pana: number): readonly number[] {
  const fin = Array.from({ length: 401 }, (_, i) => minim + i);
  const rar: number[] = [];
  for (let b = minim + 425; b <= pana; b += 25) rar.push(b);
  return [...fin, ...rar];
}

describe("cifrele perioadelor trăiesc într-un singur loc: tabelul domeniului", () => {
  it("salariul minim, suma scutită, plafonul, datele și baza minimă vin din `facilitate-salariu-minim.ts`", () => {
    for (const p of ["2026-1", "2026-2"] as const) {
      const v = PERIOADE_2026[p];
      const d = DOMENIU[p];
      expect(
        [
          v.salariuMinim,
          v.facilitate.suma,
          v.facilitate.plafonVenitBrut,
          v.reducereBazaMinima,
          v.valabilDeLa,
          v.valabilPana,
          v.setari.salariuMinimBrut,
        ],
        p,
      ).toEqual([
        d.salariuMinim,
        d.suma,
        d.plafonVenitBrut,
        d.suma,
        d.valabilDeLa,
        d.valabilPana,
        d.salariuMinim,
      ]);
    }
  });

  it("`salarizare-publica.ts` nu mai scrie cifrele facilității ca literale", () => {
    const sursa = readFileSync(
      join(process.cwd(), "src/content/legal/salarizare-publica.ts"),
      "utf8",
    );
    expect(sursa).toMatch(/from "@\/domain\/payroll\/etape\/facilitate-salariu-minim"/);
    expect(sursa).not.toMatch(/suma:\s*\d|plafonVenitBrut:\s*\d|reducereBazaMinima:\s*\d/);
    expect(sursa).not.toMatch(/SALARIU_MINIM_BRUT_2026_(IANUARIE|IULIE)\s*=\s*\d/);
    expect(sursa).not.toMatch(/valabil(DeLa|Pana):\s*"\d{4}-/);
  });

  it("`salariu.ts` nu mai socotește singur suma neimpozabilă: i-o lasă motorului, prin `lunaVenituri`", () => {
    const sursa = readFileSync(join(process.cwd(), "src/lib/unelte/salariu.ts"), "utf8");
    expect(sursa).toMatch(/lunaVenituri/);
    expect(sursa).not.toMatch(/plafonVenitBrut|facilitate\.suma|function sumaNeimpozabila/);
  });
});

describe("paritatea calculator public ↔ motorul aplicației, pe aceeași lună", () => {
  it.each(LUNILE_2026)(
    "%s: minim … minim + 400 din leu în leu, apoi din 25 în 25 până la 9.000; 0–4 persoane; funcția de bază da/nu",
    (luna) => {
      const minim = PERIOADE_2026[perioadaLunii(luna)].salariuMinim;
      for (const brut of bruturi(minim, 9000)) {
        for (let persoane = 0; persoane <= 4; persoane += 1) {
          for (const functieDeBaza of [true, false]) {
            const c: Caz = { luna, brut, persoane, functieDeBaza };
            const { unealta: u, motorul: m } = cifre(c);
            expect(u, eticheta(c)).toEqual(m);
          }
        }
      }
    },
  );

  it("la salariul minim: 2.574 în ianuarie–iunie și 2.699 în iulie–decembrie 2026, în ambele", () => {
    for (const [luna, brut, net] of [
      ["2026-03", 4050, 2574],
      ["2026-10", 4325, 2699],
    ] as const) {
      expect(unealta({ luna, brut }).net).toBe(net);
      expect(motorul({ luna, brut }).net).toBe(net);
    }
  });

  it("deducerea suplimentară (sub 26 de ani, copii la școală): aceeași cifră ca grila motorului care o conține", () => {
    // Aplicația n-are încă niciun câmp pentru ele (art. 77 alin. (10)); calculatorul
    // îi dă motorului deducerea gata socotită. Paritatea verifică drumul ăsta față de
    // căutarea motorului într-o grilă care include partea suplimentară: aceeași treaptă,
    // același plafon (minim + 2.000), copiii „indiferent de venit”.
    for (const luna of ["2026-02", "2026-09"]) {
      const minim = PERIOADE_2026[perioadaLunii(luna)].salariuMinim;
      for (const sub26 of [false, true]) {
        for (const copiiScoala of [0, 1, 3]) {
          const supliment =
            (sub26 ? valoareDeducereSub26(minim) : 0) + DEDUCERE_COPIL_SCOALA * copiiScoala;
          const grila: PragDeducerePersonala[] = [
            ...grilaDeducerePersonala(minim).map((p) => ({ ...p, valoare: p.valoare + supliment })),
            {
              nrPersoaneIntretinereMin: 0,
              nrPersoaneIntretinereMax: null,
              venitBrutMax: Number.MAX_SAFE_INTEGER,
              valoare: DEDUCERE_COPIL_SCOALA * copiiScoala,
            },
          ];
          for (let brut = minim; brut <= minim + PLAFON_DEDUCERE_PESTE_MINIM + 500; brut += 7) {
            for (const persoane of [0, 2, 4]) {
              const c: Caz = { luna, brut, persoane, sub26, copiiScoala };
              const u = unealta(c);
              const m = motorul(c, { grila });
              expect(
                [u.deducerePersonala, u.impozit, u.net, u.sumaNeimpozabila],
                eticheta(c),
              ).toEqual([deducereAcordata(m), m.impozit, m.net, m.sumaNeimpozabila]);
            }
          }
        }
      }
    }
  });

  it("timpul parțial, 1–7 ore pe zi: fără sumă scutită, aceleași rețineri ale angajatului", () => {
    // Fără `aplica_minim_contributii` (stins implicit, 0055): diferența până la baza
    // minimă e în calculator un cost al firmei, nu o reținere — vezi ⚠ de mai jos.
    for (const luna of ["2026-04", "2026-11"]) {
      for (let oreZi = 1; oreZi <= 7; oreZi += 1) {
        const o = optiuni({ luna, brut: 0, oreZi });
        const minim = PERIOADE_2026[o.perioada].salariuMinim;
        for (let brut = brutMinimLegal(o); brut <= minim + 2500; brut += 13) {
          for (const persoane of [0, 3]) {
            const c: Caz = { luna, brut, persoane, oreZi };
            const u = unealta(c);
            const m = motorul(c);
            // Deducerea AFIȘATĂ de calculator e plafonată la venitul impozabil (art. 77
            // alin. (2)); motorul plafonează doar baza de impozit, deci se compară
            // efectul ei: impozitul și netul.
            expect(
              [u.cas, u.cass, u.impozit, u.sumaNeimpozabila, u.net, u.cam],
              eticheta(c),
            ).toEqual([m.cas, m.cass, m.impozit, m.sumaNeimpozabila, m.net, m.camAngajator]);
            expect(u.sumaNeimpozabila, eticheta(c)).toBe(0);
          }
        }
      }
    }
  });

  it("tichetele peste pragul deducerii: aceleași CAS, CASS, impozit, net și CAM", () => {
    for (const luna of ["2026-01", "2026-12"]) {
      const minim = PERIOADE_2026[perioadaLunii(luna)].salariuMinim;
      for (let brut = minim + PLAFON_DEDUCERE_PESTE_MINIM + 1; brut <= 12_000; brut += 37) {
        for (const tichete of [
          { valoare: 45, numar: 20 },
          { valoare: 40.18, numar: 21 },
          { valoare: 30, numar: 3 },
        ]) {
          const c: Caz = { luna, brut, persoane: 2, tichete };
          const { unealta: u, motorul: m } = cifre(c);
          expect(u, eticheta(c)).toEqual(m);
        }
      }
    }
  });

  it("tichetele nu strică suma scutită: plafonul OUG 89/2025 le exclude în ambele", () => {
    for (const luna of LUNILE_2026) {
      const minim = PERIOADE_2026[perioadaLunii(luna)].salariuMinim;
      const c: Caz = { luna, brut: minim, tichete: { valoare: 45, numar: 22 } };
      const u = unealta(c);
      const m = motorul(c);
      expect(u.sumaNeimpozabila, luna).toBe(DOMENIU[perioadaLunii(luna)].suma);
      expect([u.cas, u.cass, u.sumaNeimpozabila, u.cam], luna).toEqual([
        m.cas,
        m.cass,
        m.sumaNeimpozabila,
        m.camAngajator,
      ]);
    }
  });

  it("⚠ NOTES.md §3: sub prag, tichetele mută treapta deducerii doar în calculator — singura diferență", () => {
    // Calculatorul pune tichetele în „venitul brut lunar” al grilei (art. 76 alin. (3)
    // lit. h)); motorul caută treapta pe brut. Brut 5.000 + 20 × 45: 173 față de 562.
    // Când răspunde contabilul, cele două se aliniază, iar testul ăsta se rescrie.
    const c: Caz = { luna: "2026-10", brut: 5000, tichete: { valoare: 45, numar: 20 } };
    const u = unealta(c);
    const m = motorul(c);
    expect(u.deducerePersonala).toBe(valoareDeducereDeBaza(4325, 0, 5900));
    expect(m.deducerePersonala).toBe(valoareDeducereDeBaza(4325, 0, 5000));
    expect([u.deducerePersonala, m.deducerePersonala]).toEqual([173, 562]);
    expect([u.cas, u.cass, u.cam]).toEqual([m.cas, m.cass, m.camAngajator]);
  });

  it("scutirea pentru handicap, fără tichete: impozit zero în ambele, restul egal", () => {
    for (const luna of ["2026-05", "2026-08"]) {
      const minim = PERIOADE_2026[perioadaLunii(luna)].salariuMinim;
      for (const brut of bruturi(minim, 12_000).filter((_, i) => i % 3 === 0)) {
        for (const functieDeBaza of [true, false]) {
          const c: Caz = { luna, brut, persoane: 1, functieDeBaza, handicap: true };
          const { unealta: u, motorul: m } = cifre(c);
          // Deducerea nu mai contează când impozitul e zero; se compară restul.
          expect([u[0], u[1], u[2], u[4], u[5], u[6], u[7], u[8]], eticheta(c)).toEqual([
            m[0],
            m[1],
            m[2],
            m[4],
            m[5],
            m[6],
            m[7],
            m[8],
          ]);
          expect(u[4], eticheta(c)).toBe(0);
        }
      }
    }
  });

  it.fails(
    "DEFECT: scutirea de 100% din motor nu acoperă tichetele impozabile — handicap, 5.000 + 20 × 45 lei: impozitul ar trebui să fie 0 (art. 60 pct. 1, art. 76 alin. (3) lit. h))",
    () => {
      // `scutireFiscala` se ia din `brut`, iar tichetele nu sunt în brut: motorul
      // impozitează tichetele unui angajat scutit. Calculatorul le scutește
      // (`salariu.test.ts`, „scutește și tichetele”). Formula e ⚠ în `calc.ts`.
      const c: Caz = {
        luna: "2026-10",
        brut: 5000,
        handicap: true,
        tichete: { valoare: 45, numar: 20 },
      };
      expect(unealta(c).impozit).toBe(0);
      expect(motorul(c).impozit).toBe(0);
    },
  );

  it("⚠ NOTES.md §3: cu `aplica_minim_contributii`, motorul reține angajatului CAS și CASS pe baza minimă; calculatorul trece diferența la firmă", () => {
    // 4 ore, 2.163 brut, iulie–decembrie: baza minimă 4.325 − 200 = 4.125. Art. 146
    // alin. (5^9): diferența „se suportă de către angajator … în numele angajatului”.
    const c: Caz = { luna: "2026-10", brut: 2163, oreZi: 4 };
    const u = unealta(c);
    const m = motorul(c, { minimContributii: true });
    expect([u.cas, u.casSuportatAngajator, u.cass, u.cassSuportatAngajator]).toEqual([
      541, 490, 216, 197,
    ]);
    expect([m.cas, m.cass]).toEqual([1031, 413]);
    expect(u.cas + u.casSuportatAngajator).toBe(m.cas);
    expect(u.cass + u.cassSuportatAngajator).toBe(m.cass);
  });

  it.fails(
    "DEFECT: pe o lună reală de 21 de zile, motorul rotunjește CAS-ul de 1.348,50 la 1.348 (5.394 brut) — calculatorul dă 1.349",
    () => {
      // 5.394 / 21 × 21 = 5.393,999… în virgulă mobilă (`salariuZi * zilePlatiteInProgram`).
      // Repararea mută statele de plată: decizia 2 din README-ul planului de unelte.
      const r = calculatePayrollEntry({
        settings: PERIOADE_2026["2026-2"].setari,
        lunaVenituri: "2026-10",
        contract: { salariuBaza: 5394, nrPersoaneIntretinere: 0 },
        attendance: {
          zileLucratoareLuna: 21,
          zileLucrate: 21,
          oreLucrate: 168,
          oreSuplimentare: 0,
          oreNoapte: 0,
          zileConcediuOdihna: 0,
          zileConcediuMedical: 0,
          zileAbsentaNemotivata: 0,
        },
        bonuses: [],
        deductions: [],
      });
      expect(unealta({ luna: "2026-10", brut: 5394 }).cas).toBe(1349);
      expect(r.cas).toBe(1349);
    },
  );
});
