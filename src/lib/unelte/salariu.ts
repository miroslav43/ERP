import { SETARI_SALARIZARE_PUBLICE } from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry, type PayrollCalcInput } from "@/domain/payroll/calc";

/**
 * Brut → net și net → brut pentru calculatorul public, prin ACELAȘI motor ca
 * modulul de salarizare (`calculatePayrollEntry`). Un calculator public care ar
 * socoti altfel decât produsul ar arăta, pe aceeași cifră, două neturi diferite.
 *
 * Întrebarea e „cât iese net din brutul ăsta”: o lună întreagă lucrată, fără
 * absențe, sporuri, tichete sau rețineri.
 */

export type RezultatSalariu = Readonly<{
  brut: number;
  cas: number;
  cass: number;
  deducerePersonala: number;
  impozit: number;
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

export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  const b = Math.round(margineste(brut, BRUT_MIN, BRUT_MAX) * 100) / 100;
  const p = Math.round(margineste(persoane, 0, 10));
  const r = calculatePayrollEntry(intrare(b, p, functieDeBaza));
  return {
    brut: r.brut,
    cas: r.cas,
    cass: r.cass,
    deducerePersonala: r.deducerePersonala,
    impozit: r.impozit,
    net: r.net,
    cam: r.camAngajator,
    costTotal: r.costTotalAngajator,
  };
}

/**
 * Bisecție pe brut. Netul e monoton în brut pe intervalul uzual (testul o cere),
 * deci căutarea converge; la capete, rezultatul rămâne mărginit, nu aruncă.
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
  return dinBrut(Math.ceil(sus), persoane, functieDeBaza);
}
