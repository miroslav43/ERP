import {
  DEDUCERE_COPIL_SCOALA,
  PERIOADE_2026,
  type Perioada,
  PLAFON_DEDUCERE_PESTE_MINIM,
  valoareDeducereDeBaza,
  valoareDeducereSub26,
} from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry, type PayrollCalcInput } from "@/domain/payroll/calc";

/**
 * Brut → net și net → brut pentru calculatorul public, prin ACELAȘI motor ca
 * modulul de salarizare (`calculatePayrollEntry`). Un calculator public care ar
 * socoti altfel decât produsul ar arăta, pe aceeași cifră, două neturi diferite.
 *
 * Întrebarea e „cât iese net din brutul ăsta”: o lună întreagă lucrată, fără
 * absențe, sporuri sau rețineri, într-una din cele două perioade ale lui 2026
 * (`PERIOADE_2026`: salariul minim și suma scutită diferă).
 *
 * Singurul lucru pe care motorul nu-l știe e suma neimpozabilă de la salariul
 * minim (OUG 89/2025 art. III): 300 de lei în ianuarie–iunie 2026 și 200 de lei
 * în iulie–decembrie, scoși din baza de impozit, CAS, CASS și CAM. Se aplică
 * aici, peste motor.
 */

export type OptiuniSalariu = Readonly<{
  perioada: Perioada;
  /** 0–4; 4 înseamnă „4 și peste”, ca în tabelul art. 77 alin. (4). */
  persoane: number;
  functieDeBaza: boolean;
  /** Până la 26 de ani: deducerea suplimentară de 15% din minim (art. 77 alin. (10) lit. a)). */
  sub26: boolean;
  /** Copii sub 18 ani înscriși la școală: 100 de lei fiecare (art. 77 alin. (10) lit. b)). */
  copiiScoala: number;
  /** Tichetele de masă din lună: valoarea unuia și câte (cel mult unul pe zi lucrată). */
  tichete: Readonly<{ valoare: number; numar: number }>;
  /** Ore pe zi din contract, 1–8; 8 înseamnă normă întreagă. */
  oreZi: number;
  /**
   * CAS și CASS cel puțin la baza minimă (art. 146 alin. (5^6), art. 168 alin. (6^1)).
   * `false` pentru excepțiile din art. 146 alin. (5^7).
   */
  contributieMinima: boolean;
}>;

/** Normă întreagă, funcția de bază, fără persoane, în iulie–decembrie 2026. */
export const OPTIUNI_IMPLICITE: OptiuniSalariu = {
  perioada: "2026-2",
  persoane: 0,
  functieDeBaza: true,
  sub26: false,
  copiiScoala: 0,
  tichete: { valoare: 0, numar: 0 },
  oreZi: 8,
  contributieMinima: true,
};

export type RezultatSalariu = Readonly<{
  brut: number;
  cas: number;
  cass: number;
  /** Deducerea ACORDATĂ: suma celor trei de mai jos, în limita venitului impozabil (art. 77 alin. (2)). */
  deducerePersonala: number;
  deducereDeBaza: number;
  deducereSub26: number;
  deducereCopii: number;
  impozit: number;
  /** Suma scoasă din baza de impozit și contribuții (OUG 89/2025 art. III); 0 când nu se aplică. */
  sumaNeimpozabila: number;
  /** Salariul net, în cont — fără tichete. */
  net: number;
  /** Valoarea tichetelor de masă din lună, pe card. */
  tichete: number;
  /** Diferența până la CAS-ul de la baza minimă, plătită de firmă „în numele angajatului” (art. 146 alin. (5^9)). */
  casSuportatAngajator: number;
  cassSuportatAngajator: number;
  cam: number;
  /** Brut + CAM + tichete + diferențele de mai sus. */
  costTotal: number;
}>;

const BRUT_MIN = 1;
export const BRUT_MAX = 500_000;
const NORMA_INTREAGA = 8;

const margineste = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

function intrare(
  brutImpozabil: number,
  o: OptiuniSalariu,
  deducere: number,
  tichete: number,
): PayrollCalcInput {
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
    // Deducerea o calculează `deduceri()` (art. 77, cu partea suplimentară, pe care
    // grila motorului n-o are); motorul o primește ca un singur prag, valabil
    // pentru orice venit. Funcția de bază se verifică tot în `deduceri()`.
    settings: {
      ...setari,
      // Tichetele pe calea motorului, deci cu regimul din produs: impozabile, cu
      // CASS, fără CAS și fără CAM. Luna e o singură „zi” (vezi `attendance`), iar
      // motorul înmulțește valoarea pe tichet cu zilele lucrate: aici, cu 1.
      valoareTichetMasa: tichete,
      ticheteImpozabile: true,
      ticheteSupuseCass: true,
      deducerePersonala:
        deducere > 0
          ? [
              {
                nrPersoaneIntretinereMin: 0,
                nrPersoaneIntretinereMax: null,
                venitBrutMax: Number.MAX_SAFE_INTEGER,
                valoare: deducere,
              },
            ]
          : [],
    },
    contract: { salariuBaza: brutImpozabil, nrPersoaneIntretinere: o.persoane },
    // Luna întreagă, ca O SINGURĂ zi lucrătoare. Motorul împarte salariul la
    // zilele lucrătoare și îl înmulțește înapoi cu zilele lucrate; cu 21 de zile,
    // 5.394 / 21 × 21 ieșea 5.393,999… în virgulă mobilă, iar CAS-ul de 1.348,50
    // se rotunjea la 1.348 în loc de 1.349 (OUG 59/2005: 50 de bani în sus).
    // Circa 225 de bruturi între 4.325 și 20.000 aveau un leu greșit (8 oct 2026).
    attendance: {
      zileLucratoareLuna: 1,
      zileLucrate: 1,
      oreLucrate: setari.normaZilnicaOre,
      oreSuplimentare: 0,
      oreNoapte: 0,
      zileConcediuOdihna: 0,
      zileConcediuMedical: 0,
      zileAbsentaNemotivata: 0,
    },
    bonuses: [],
    deductions: [],
  };
}

/**
 * Condițiile art. III alin. (1): funcția de bază, normă întreagă (presupusă de
 * calculator), salariul de bază egal cu minimul PERIOADEI, venit brut de cel
 * mult plafonul ei. Fără sporuri, brutul calculatorului ESTE salariul de bază.
 */
function sumaNeimpozabila(brut: number, o: OptiuniSalariu): number {
  const v = PERIOADE_2026[o.perioada];
  // Art. III alin. (1) cere „normă întreagă”: la timp parțial, nicio sumă scutită.
  return o.oreZi >= NORMA_INTREAGA &&
    o.functieDeBaza &&
    brut === v.salariuMinim &&
    brut <= v.facilitate.plafonVenitBrut
    ? v.facilitate.suma
    : 0;
}

/** Baza minimă de CAS și CASS: salariul minim al perioadei, diminuat (OUG 89/2025 art. III alin. (5)). */
export function bazaMinimaContributii(o: OptiuniSalariu): number {
  const v = PERIOADE_2026[o.perioada];
  return v.salariuMinim - v.reducereBazaMinima;
}

/**
 * Cât plătește firma peste ce i se reține angajatului, ca CAS și CASS să ajungă
 * la baza minimă (art. 146 alin. (5^6) și (5^9), art. 168 alin. (6^1)). Pentru
 * o lună întreagă cu contract activ, baza e minimul întreg, nu proporțional cu
 * orele. La normă întreagă, peste minim, diferența e zero.
 */
function suportatDeAngajator(cas: number, cass: number, o: OptiuniSalariu) {
  if (!o.contributieMinima) return { cas: 0, cass: 0 };
  const baza = bazaMinimaContributii(o);
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
    cas: Math.max(0, Math.round(baza * setari.cotaCas) - cas),
    cass: Math.max(0, Math.round(baza * setari.cotaCass) - cass),
  };
}

/** Valoarea tichetelor din lună, la ban: 21 × 40,18 = 843,78. Zero dacă lipsește valoarea sau numărul. */
function valoareTichete(o: OptiuniSalariu): number {
  const valoare = margineste(o.tichete.valoare, 0, 1000);
  const numar = Math.round(margineste(o.tichete.numar, 0, 31));
  return valoare > 0 && numar > 0 ? Math.round(valoare * numar * 100) / 100 : 0;
}

type Deduceri = Readonly<{ deBaza: number; sub26: number; copii: number }>;

/**
 * Deducerea personală, art. 77 Cod fiscal: cea de bază (alin. (4)) plus cea
 * suplimentară (alin. (10)) — 15% din minim până la 26 de ani, pentru un venit de
 * cel mult minim + 2.000 de lei, și 100 de lei pe copil înscris la școală,
 * indiferent de venit. Toată se acordă numai la funcția de bază (alin. (1)).
 */
function deduceri(venitBrut: number, o: OptiuniSalariu): Deduceri {
  if (!o.functieDeBaza) return { deBaza: 0, sub26: 0, copii: 0 };
  const minim = PERIOADE_2026[o.perioada].salariuMinim;
  return {
    deBaza: valoareDeducereDeBaza(minim, o.persoane, venitBrut),
    sub26:
      o.sub26 && venitBrut <= minim + PLAFON_DEDUCERE_PESTE_MINIM ? valoareDeducereSub26(minim) : 0,
    copii: DEDUCERE_COPIL_SCOALA * o.copiiScoala,
  };
}

export function calculeazaDinBrut(brut: number, optiuni: OptiuniSalariu): RezultatSalariu {
  const b = Math.round(margineste(brut, BRUT_MIN, BRUT_MAX) * 100) / 100;
  const o: OptiuniSalariu = {
    ...optiuni,
    persoane: Math.round(margineste(optiuni.persoane, 0, 10)),
    copiiScoala: Math.round(margineste(optiuni.copiiScoala, 0, 10)),
    oreZi: Math.round(margineste(optiuni.oreZi, 1, NORMA_INTREAGA)),
  };
  const scutit = sumaNeimpozabila(b, o);
  const tichete = valoareTichete(o);
  // ⚠ Tichetele intră în venitul brut lunar al grilei (art. 76 alin. (3) lit. h));
  // motorul produsului nu le pune acolo. Întrebare deschisă în NOTES.md §3.
  const d = deduceri(b + tichete, o);
  // Motorul calculează impozitul și contribuțiile pe brutul FĂRĂ suma scutită;
  // omul primește însă tot brutul, deci suma scutită se adaugă înapoi la net.
  const r = calculatePayrollEntry(intrare(b - scutit, o, d.deBaza + d.sub26 + d.copii, tichete));
  // Art. 77 alin. (2): deducerea se acordă „în limita venitului impozabil lunar”.
  // Motorul o plafonează deja (baza de impozit nu coboară sub zero); aici se
  // plafonează și cifra afișată — la 4,5 lei brut se afișa „Deducere 865 lei”.
  const venitInainteDeDeducere = Math.max(0, b - scutit + tichete - r.cas - r.cass);
  // ⚠ Diferența plătită de firmă nu intră în baza de impozit a angajatului (NOTES.md §3).
  const suportat = suportatDeAngajator(r.cas, r.cass, o);
  return {
    brut: b,
    cas: r.cas,
    cass: r.cass,
    deducerePersonala: Math.min(r.deducerePersonala, venitInainteDeDeducere),
    deducereDeBaza: d.deBaza,
    deducereSub26: d.sub26,
    deducereCopii: d.copii,
    impozit: r.impozit,
    sumaNeimpozabila: scutit,
    net: r.net + scutit,
    tichete,
    casSuportatAngajator: suportat.cas,
    cassSuportatAngajator: suportat.cass,
    cam: r.camAngajator,
    costTotal: b + r.camAngajator + tichete + suportat.cas + suportat.cass,
  };
}

/** Cât poate coborî înapoi căutarea: o treaptă a grilei de deducere (50 de lei), cu rezervă. */
const RECUL_MAXIM_LEI = 60;

/**
 * Net → brut: cel mai mic brut întreg care atinge netul cerut.
 *
 * Netul NU e strict monoton în brut: la fiecare prag de 50 de lei, deducerea
 * personală scade cu 0,5% din salariul minim, iar netul coboară cu până la ~2
 * lei înainte să urce iar. Bisecția găsește un brut bun, dar nu neapărat pe cel
 * mai mic — de aceea se caută înapoi, leu cu leu, o treaptă întreagă. Un brut cu
 * câțiva lei prea mare ar fi bani în plus pentru angajator.
 */
function celMaiMicBrut(tinta: number, optiuni: OptiuniSalariu): RezultatSalariu {
  const calc = (b: number) => calculeazaDinBrut(b, optiuni);
  // Pragul deducerii (art. 77 alin. (3), minim + 2.000 de lei). Peste el, deducerea
  // de bază dispare dintr-o dată (la 4 persoane, 25% × 4.325 = 1.081 de lei) și
  // netul cade cu peste 100 de lei. Căutarea înapoi de 60 de lei nu trecea peste
  // cădere: net 3.715 cu 4 persoane întorcea 6.291 (net 3.788) în loc de 6.153,
  // adică 138 de lei de brut în plus (live, 8 oct 2026). Sub prag și peste el,
  // netul e aproape monoton, așa că se caută doar în partea care conține răspunsul.
  // Tichetele intră în venitul grilei (vezi `calculeazaDinBrut`), deci pragul,
  // socotit în brut, coboară cu valoarea lor: cu 20 × 45 lei, de la 6.325 la 5.425.
  const prag = Math.max(
    BRUT_MIN,
    Math.floor(
      PERIOADE_2026[optiuni.perioada].salariuMinim +
        PLAFON_DEDUCERE_PESTE_MINIM -
        valoareTichete(optiuni),
    ),
  );
  // Sub prag, netul e cel mai mare în ultimii lei dinaintea lui. O rotunjire de 50
  // de bani îl poate muta cu un leu (cu tichete, CASS 632,50 → 633 la 5.425 face
  // netul de acolo mai mic decât cel de la 5.424), deci se încearcă ultimii cinci
  // lei. Dacă niciunul nu atinge ținta, niciun brut de dedesubt n-o atinge, iar
  // brutul găsit devine capătul de sus al bisecției, care rămâne valid.
  let atinsSubPrag: number | null = null;
  for (let b = prag; b >= Math.max(BRUT_MIN, prag - 5) && atinsSubPrag === null; b -= 1) {
    if (calc(b).net >= tinta) atinsSubPrag = b;
  }
  let jos = atinsSubPrag === null ? prag : BRUT_MIN;
  let sus = atinsSubPrag ?? BRUT_MAX;
  for (let i = 0; i < 60 && sus - jos > 0.01; i += 1) {
    const mijloc = (jos + sus) / 2;
    if (calc(mijloc).net < tinta) jos = mijloc;
    else sus = mijloc;
  }
  let start = Math.ceil(sus);
  let ales = calc(start);
  // Bisecția merge pe bruturi cu bani: un brut fracționar poate atinge ținta prin
  // rotunjirea contribuțiilor, iar întregul de deasupra să rămână cu un leu SUB
  // ea. Auditul din 7 oct 2026 a găsit 26 din 124 de ținte rotunde (2.700–15.000)
  // întoarse cu netul = ținta − 1. Se urcă leu cu leu până când ținta e atinsă.
  for (let pas = 0; ales.net < tinta && pas < 4 * RECUL_MAXIM_LEI && start < BRUT_MAX; pas += 1) {
    start += 1;
    ales = calc(start);
  }
  // La salariul minim, suma neimpozabilă face netul să sară în sus, iar brutul
  // de imediat deasupra are un net MAI MIC. Minimul perioadei se încearcă explicit.
  const laMinim = calc(PERIOADE_2026[optiuni.perioada].salariuMinim);
  if (laMinim.net >= tinta && laMinim.brut < ales.brut) ales = laMinim;
  for (let b = start - 1; b >= Math.max(BRUT_MIN, start - RECUL_MAXIM_LEI); b -= 1) {
    const r = calc(b);
    if (r.net >= tinta && r.brut < ales.brut) ales = r;
  }
  return ales;
}

/**
 * Brutul minim legal pentru opțiunile alese: salariul minim al perioadei,
 * proporțional cu orele din contract (minimul e stabilit „pentru un program
 * normal de lucru”, cu valoare orară — HG 146/2026 art. 1, HG 1506/2024 art. 1),
 * rotunjit în sus la leu: 4 ore → 2.162,50 → 2.163.
 */
export function brutMinimLegal(o: OptiuniSalariu): number {
  const ore = Math.round(margineste(o.oreZi, 1, NORMA_INTREAGA));
  return Math.ceil((PERIOADE_2026[o.perioada].salariuMinim * ore) / NORMA_INTREAGA);
}

export type RezultatNet = Readonly<{
  rezultat: RezultatSalariu;
  /** Netul cerut era sub cel de la brutul minim legal: s-a întors brutul minim, nu unul ilegal. */
  ridicatLaMinim: boolean;
}>;

/**
 * Net → brut, cu două refuzuri pe față:
 * - un net peste ce dă brutul maxim întoarce `null` (era „Net 292.500 din brut
 *   500.000” pentru un net cerut de 500.000);
 * - un net sub cel de la brutul minim legal întoarce brutul minim legal, marcat:
 *   auditul din 8 oct 2026 a găsit 2.614 → 4.320, 2.500 → 4.127, 1.500 → 2.417,
 *   salarii pe care nu le poți plăti.
 */
export function calculeazaDinNet(net: number, optiuni: OptiuniSalariu): RezultatNet | null {
  const tinta = margineste(net, BRUT_MIN, BRUT_MAX);
  if (calculeazaDinBrut(BRUT_MAX, optiuni).net < tinta) return null;
  const ales = celMaiMicBrut(tinta, optiuni);
  const minim = brutMinimLegal(optiuni);
  if (ales.brut >= minim) return { rezultat: ales, ridicatLaMinim: false };
  let b = Math.ceil(minim);
  let r = calculeazaDinBrut(b, optiuni);
  for (let pas = 0; r.net < tinta && pas < 4 * RECUL_MAXIM_LEI && b < BRUT_MAX; pas += 1) {
    b += 1;
    r = calculeazaDinBrut(b, optiuni);
  }
  return { rezultat: r, ridicatLaMinim: true };
}

/** Forma scurtă, cu valorile din iulie–decembrie 2026 (ghidul salariului minim, viniețele). */
export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  return calculeazaDinBrut(brut, { ...OPTIUNI_IMPLICITE, persoane, functieDeBaza });
}

/** Netul de neatins cade pe brutul maxim: forma scurtă nu are cum să spună „nu se poate”. */
export function dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  const o: OptiuniSalariu = { ...OPTIUNI_IMPLICITE, persoane, functieDeBaza };
  return calculeazaDinNet(net, o)?.rezultat ?? calculeazaDinBrut(BRUT_MAX, o);
}
