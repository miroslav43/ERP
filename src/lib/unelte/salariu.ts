import {
  FACILITATE_SALARIU_MINIM,
  SALARIU_MINIM_BRUT_2026_IULIE,
  SETARI_SALARIZARE_PUBLICE,
} from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry, type PayrollCalcInput } from "@/domain/payroll/calc";

/**
 * Brut → net și net → brut pentru calculatorul public, prin ACELAȘI motor ca
 * modulul de salarizare (`calculatePayrollEntry`). Un calculator public care ar
 * socoti altfel decât produsul ar arăta, pe aceeași cifră, două neturi diferite.
 *
 * Întrebarea e „cât iese net din brutul ăsta”: o lună întreagă lucrată, cu
 * normă întreagă, fără absențe, sporuri, tichete sau rețineri.
 *
 * Singurul lucru pe care motorul nu-l știe e suma neimpozabilă de la salariul
 * minim (OUG 89/2025 art. III): 200 de lei pe lună în iulie–decembrie 2026,
 * scoși din baza de impozit, CAS, CASS și CAM. Se aplică aici, peste motor.
 */

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
const BRUT_MAX = 500_000;
const ZILE_LUNA = 21;

const margineste = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

function intrare(brut: number, persoane: number, functieDeBaza: boolean): PayrollCalcInput {
  return {
    // Deducerea personală se acordă numai la funcția de bază (art. 77 alin. (1)
    // Cod fiscal). Motorul n-are noțiunea; în afara ei, grila e goală.
    settings: functieDeBaza
      ? SETARI_SALARIZARE_PUBLICE
      : { ...SETARI_SALARIZARE_PUBLICE, deducerePersonala: [] },
    contract: { salariuBaza: brut, nrPersoaneIntretinere: persoane },
    attendance: {
      zileLucratoareLuna: ZILE_LUNA,
      zileLucrate: ZILE_LUNA,
      oreLucrate: ZILE_LUNA * SETARI_SALARIZARE_PUBLICE.normaZilnicaOre,
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
 * calculator), salariul de bază egal cu minimul, venit brut de cel mult 4.600
 * de lei. Fără sporuri, brutul calculatorului ESTE salariul de bază.
 */
function sumaNeimpozabila(brut: number, functieDeBaza: boolean): number {
  return functieDeBaza &&
    brut === SALARIU_MINIM_BRUT_2026_IULIE &&
    brut <= FACILITATE_SALARIU_MINIM.plafonVenitBrut
    ? FACILITATE_SALARIU_MINIM.suma
    : 0;
}

export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  const b = Math.round(margineste(brut, BRUT_MIN, BRUT_MAX) * 100) / 100;
  const p = Math.round(margineste(persoane, 0, 10));
  const scutit = sumaNeimpozabila(b, functieDeBaza);
  // Motorul calculează impozitul și contribuțiile pe brutul FĂRĂ suma scutită;
  // omul primește însă tot brutul, deci suma scutită se adaugă înapoi la net.
  const r = calculatePayrollEntry(intrare(b - scutit, p, functieDeBaza));
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
export function dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  const tinta = margineste(net, BRUT_MIN, BRUT_MAX);
  let jos = BRUT_MIN;
  let sus = BRUT_MAX;
  for (let i = 0; i < 60 && sus - jos > 0.01; i += 1) {
    const mijloc = (jos + sus) / 2;
    if (dinBrut(mijloc, persoane, functieDeBaza).net < tinta) jos = mijloc;
    else sus = mijloc;
  }
  let start = Math.ceil(sus);
  let ales = dinBrut(start, persoane, functieDeBaza);
  // Bisecția merge pe bruturi cu bani: un brut fracționar poate atinge ținta prin
  // rotunjirea contribuțiilor, iar întregul de deasupra să rămână cu un leu SUB
  // ea. Auditul din 7 oct 2026 a găsit 26 din 124 de ținte rotunde (2.700–15.000)
  // întoarse cu netul = ținta − 1. Se urcă leu cu leu până când ținta e atinsă.
  for (let pas = 0; ales.net < tinta && pas < 4 * RECUL_MAXIM_LEI && start < BRUT_MAX; pas += 1) {
    start += 1;
    ales = dinBrut(start, persoane, functieDeBaza);
  }
  // La salariul minim, suma neimpozabilă face netul să sară în sus, iar brutul
  // de imediat deasupra are un net MAI MIC. Minimul se încearcă explicit.
  const laMinim = dinBrut(SALARIU_MINIM_BRUT_2026_IULIE, persoane, functieDeBaza);
  if (laMinim.net >= tinta && laMinim.brut < ales.brut) ales = laMinim;
  for (let b = start - 1; b >= Math.max(BRUT_MIN, start - RECUL_MAXIM_LEI); b -= 1) {
    const r = dinBrut(b, persoane, functieDeBaza);
    if (r.net >= tinta && r.brut < ales.brut) ales = r;
  }
  return ales;
}
