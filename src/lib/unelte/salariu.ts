import {
  PERIOADE_2026,
  type Perioada,
  PLAFON_DEDUCERE_PESTE_MINIM,
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
}>;

/** Normă întreagă, funcția de bază, fără persoane, în iulie–decembrie 2026. */
export const OPTIUNI_IMPLICITE: OptiuniSalariu = {
  perioada: "2026-2",
  persoane: 0,
  functieDeBaza: true,
};

export type RezultatSalariu = Readonly<{
  brut: number;
  cas: number;
  cass: number;
  deducerePersonala: number;
  impozit: number;
  /** Suma scoasă din baza de impozit și contribuții (OUG 89/2025 art. III); 0 când nu se aplică. */
  sumaNeimpozabila: number;
  net: number;
  cam: number;
  costTotal: number;
}>;

const BRUT_MIN = 1;
export const BRUT_MAX = 500_000;

const margineste = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

function intrare(brutImpozabil: number, o: OptiuniSalariu): PayrollCalcInput {
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
    // Deducerea personală se acordă numai la funcția de bază (art. 77 alin. (1)
    // Cod fiscal). Motorul n-are noțiunea; în afara ei, grila e goală.
    settings: o.functieDeBaza ? setari : { ...setari, deducerePersonala: [] },
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
  return o.functieDeBaza && brut === v.salariuMinim && brut <= v.facilitate.plafonVenitBrut
    ? v.facilitate.suma
    : 0;
}

export function calculeazaDinBrut(brut: number, optiuni: OptiuniSalariu): RezultatSalariu {
  const b = Math.round(margineste(brut, BRUT_MIN, BRUT_MAX) * 100) / 100;
  const o: OptiuniSalariu = {
    ...optiuni,
    persoane: Math.round(margineste(optiuni.persoane, 0, 10)),
  };
  const scutit = sumaNeimpozabila(b, o);
  // Motorul calculează impozitul și contribuțiile pe brutul FĂRĂ suma scutită;
  // omul primește însă tot brutul, deci suma scutită se adaugă înapoi la net.
  const r = calculatePayrollEntry(intrare(b - scutit, o));
  return {
    brut: b,
    cas: r.cas,
    cass: r.cass,
    deducerePersonala: r.deducerePersonala,
    impozit: r.impozit,
    sumaNeimpozabila: scutit,
    net: r.net + scutit,
    cam: r.camAngajator,
    costTotal: b + r.camAngajator,
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
  const prag = Math.max(
    BRUT_MIN,
    Math.floor(PERIOADE_2026[optiuni.perioada].salariuMinim + PLAFON_DEDUCERE_PESTE_MINIM),
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

/** Brutul minim legal pentru opțiunile alese: salariul minim al perioadei, la normă întreagă. */
export function brutMinimLegal(o: OptiuniSalariu): number {
  return PERIOADE_2026[o.perioada].salariuMinim;
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
