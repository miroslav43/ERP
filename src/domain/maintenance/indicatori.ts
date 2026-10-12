// src/domain/maintenance/indicatori.ts
/**
 * Indicatorii raportului de mentenanță (M8). Funcții pure, fără I/O: apelantul
 * aduce rândurile deja citite (paginate, cu plafon) și ceasul (`azi`, `acum`),
 * aici doar se numără și se împarte.
 *
 * ── NICIO ÎMPĂRȚIRE LA ZERO ───────────────────────────────────────────────
 * Orice medie sau procent trece prin `imparte`, care întoarce `null` la numitor
 * zero. Ecranul scrie „—” pentru `null` (`formatProcent`, `formatOreIndicator`).
 * O firmă cu opt angajați și două utilaje are luni întregi fără nicio oprire:
 * „MTBF = Infinity h” sau „NaN %” ar fi primul lucru pe care îl vede.
 *
 * ── CE E RECONSTITUIT, NU CITIT ───────────────────────────────────────────
 * Baza nu păstrează scadența de la momentul execuției. „La timp” se judecă din
 * execuția REUȘITĂ precedentă a aceluiași plan + periodicitatea lui (zile și/sau
 * contor); prima execuție cunoscută nu se poate judeca și nu intră în procent.
 * O execuție făcută după o amânare apare întârziată față de calcul — amânările
 * se raportează separat, cu `numar_amanari` (cazul 27).
 *
 * ── ORELE DE PROGRAM ──────────────────────────────────────────────────────
 * Programul e al FIRMEI (`maintenance_settings`): `ore_functionare_pe_zi` în
 * primele `zile_pe_saptamana` zile ale săptămânii (luni = 1). O oprire numără,
 * pe fiecare zi de program, cel mult `ore_functionare_pe_zi` ore — o oprire de
 * trei zile nu scade 72 de ore dintr-un program de 8 pe zi. Nu știm ora de
 * început a schimbului, deci o oprire nocturnă scurtă se numără ca oprire în
 * program; e o aproximare declarată.
 */
import { momentDinOraRomaniei, toBucharestDateString } from "@/lib/format/date";
import type { StatusSesizare, TipContor, TipMentenanta, TipOprire } from "@/schemas/maintenance";

import { contorInvechit } from "./proiectie";

// ── Constante ───────────────────────────────────────────────────────────────

/** Raportul cost anual / valoare peste care echipamentul e semnalat pentru înlocuire. */
export const PRAG_COST_VALOARE_INLOCUIRE = 0.4;
/** Fereastra în care o a doua sesizare pe același echipament e „defect repetat”. */
export const ZILE_DEFECT_REPETAT = 30;
/** Câte rânduri intră într-un clasament Pareto. */
export const TOP_PARETO = 10;
/** Perioada cea mai lungă acceptată — ține citirile sub plafon. */
export const MAXIM_ZILE_PERIOADA = 731;

const ZI_MS = 86_400_000;
const ORA_MS = 3_600_000;

// ── Aritmetică de zile și împărțirea sigură ─────────────────────────────────

function ziUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function plusZile(iso: string, zile: number): string {
  return new Date(ziUtc(iso) + zile * ZI_MS).toISOString().slice(0, 10);
}

/** Ziua din `iso` mutată cu `luni` luni; ziua 31 într-o lună mai scurtă devine ultima zi. */
export function plusLuni(iso: string, luni: number): string {
  const [an, luna, zi] = iso.split("-").map(Number) as [number, number, number];
  const tinta = new Date(Date.UTC(an, luna - 1 + luni, 1));
  const ultimaZi = new Date(
    Date.UTC(tinta.getUTCFullYear(), tinta.getUTCMonth() + 1, 0),
  ).getUTCDate();
  tinta.setUTCDate(Math.min(zi, ultimaZi));
  return tinta.toISOString().slice(0, 10);
}

function zileIntre(deLa: string, panaLa: string): number {
  return Math.round((ziUtc(panaLa) - ziUtc(deLa)) / ZI_MS);
}

/** Împărțirea fără numitor zero: `null` când numitorul nu e un număr strict pozitiv. */
export function imparte(numarator: number, numitor: number): number | null {
  if (!Number.isFinite(numarator) || !Number.isFinite(numitor) || numitor <= 0) return null;
  return numarator / numitor;
}

const PROCENT = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });
const ZECIMALA = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });

/** „87,5 %” sau „—”. */
export function formatProcent(rata: number | null): string {
  return rata === null ? "—" : `${PROCENT.format(rata * 100)} %`;
}

/** „3,3 h”, „3 zile” (peste 48 de ore) sau „—”. */
export function formatOreIndicator(ore: number | null): string {
  if (ore === null) return "—";
  if (ore > 48) {
    const zile = ore / 24;
    return `${ZECIMALA.format(zile)} ${zile === 1 ? "zi" : "zile"}`;
  }
  return `${ZECIMALA.format(ore)} h`;
}

function rotunjeste(x: number): number {
  return Math.round(x * 100) / 100;
}

// ── Perioada ────────────────────────────────────────────────────────────────

/** Zile calendaristice ISO, ambele capete incluse. */
export interface Perioada {
  readonly deLa: string;
  readonly panaLa: string;
}

/** Ultimele 12 luni, cu azi inclus. */
export function perioadaImplicita(azi: string): Perioada {
  return { deLa: plusZile(plusLuni(azi, -12), 1), panaLa: azi };
}

/**
 * Perioada cerută din adresă, adusă la o formă pe care raportul o poate
 * calcula: capetele inversate se schimbă, viitorul se taie la azi (programul
 * unei zile neîncepute ar umfla disponibilitatea), iar o perioadă mai lungă de
 * `MAXIM_ZILE_PERIOADA` se scurtează de la început. Fiecare corecție spune ce a
 * făcut — un raport care își schimbă tăcut intervalul arată cifre pentru alt
 * interval decât cel din antet.
 */
export function normalizeazaPerioada(
  deLa: string | null,
  panaLa: string | null,
  azi: string,
): { readonly perioada: Perioada; readonly avertisment: string | null } {
  const implicita = perioadaImplicita(azi);
  let inceput = deLa ?? (panaLa === null ? implicita.deLa : plusZile(plusLuni(panaLa, -12), 1));
  let sfarsit = panaLa ?? azi;
  const avertismente: string[] = [];

  if (inceput > sfarsit) {
    [inceput, sfarsit] = [sfarsit, inceput];
    avertismente.push("Capetele perioadei erau inversate și au fost schimbate între ele.");
  }
  if (sfarsit > azi) {
    sfarsit = azi;
    if (inceput > azi) inceput = azi;
    avertismente.push("Perioada se oprește azi: zilele care n-au trecut nu au date.");
  }
  if (zileIntre(inceput, sfarsit) + 1 > MAXIM_ZILE_PERIOADA) {
    inceput = plusZile(sfarsit, -(MAXIM_ZILE_PERIOADA - 1));
    avertismente.push(
      `Perioada a fost scurtată la ${String(MAXIM_ZILE_PERIOADA)} de zile, cele mai recente.`,
    );
  }
  return {
    perioada: { deLa: inceput, panaLa: sfarsit },
    avertisment: avertismente.length === 0 ? null : avertismente.join(" "),
  };
}

/**
 * Intervalul care trebuie CITIT ca raportul să poată fi calculat: cu 30 de zile
 * înainte (defectele repetate se uită înapoi) și cel puțin ultimele 12 luni până
 * la capăt (raportul cost/valoare e anual, oricât de scurtă e perioada).
 */
export function fereastraCitire(perioada: Perioada): Perioada {
  const pentruRepetate = plusZile(perioada.deLa, -ZILE_DEFECT_REPETAT);
  const pentruAn = plusZile(plusLuni(perioada.panaLa, -12), 1);
  return {
    deLa: pentruRepetate < pentruAn ? pentruRepetate : pentruAn,
    panaLa: perioada.panaLa,
  };
}

/** Ziua săptămânii, luni = 1 … duminică = 7. */
function ziSaptamana(iso: string): number {
  const d = new Date(ziUtc(iso)).getUTCDay();
  return d === 0 ? 7 : d;
}

function esteZiDeProgram(iso: string, zilePeSaptamana: number): boolean {
  return ziSaptamana(iso) <= zilePeSaptamana;
}

/** Câte zile de program are perioada. */
export function zileDeProgram(perioada: Perioada, zilePeSaptamana: number): number {
  if (perioada.deLa > perioada.panaLa) return 0;
  let n = 0;
  for (let zi = perioada.deLa; zi <= perioada.panaLa; zi = plusZile(zi, 1)) {
    if (esteZiDeProgram(zi, zilePeSaptamana)) n += 1;
  }
  return n;
}

/** Miezul nopții (ora României) al zilei `iso`, ca milisecunde UTC. */
function inceputZi(iso: string): number {
  const moment = momentDinOraRomaniei(`${iso}T00:00`);
  return moment === null ? ziUtc(iso) : Date.parse(moment);
}

// ── Intrările ───────────────────────────────────────────────────────────────

export interface ProgramLucru {
  readonly orePeZi: number;
  readonly zilePeSaptamana: number;
  /** Costul unei ore de oprire, din setări; `null` = nesetat. */
  readonly costOraOprire: number | null;
}

export interface EchipamentRaport {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly valoare_achizitie: number | null;
  readonly casat_la: string | null;
  readonly data_punerii_in_functiune: string | null;
}

export interface InterventieRaport {
  readonly id: string;
  readonly equipment_id: string;
  readonly data: string;
  readonly tip: TipMentenanta;
  readonly rezultat: string;
  readonly cost_total: number | null;
  readonly acoperit_de_garantie: boolean;
  readonly executant_extern: string | null;
  readonly plan_id: string | null;
}

/** O execuție REUȘITĂ a unui plan — singura care mută scadența (`ssm_intervention_apply`). */
export interface ExecutiePlan {
  readonly id: string;
  readonly plan_id: string;
  readonly data: string;
  readonly citire_contor: number | null;
}

export interface PlanRaport {
  readonly id: string;
  readonly equipment_id: string;
  readonly denumire: string;
  readonly tip: TipMentenanta;
  readonly activ: boolean;
  readonly periodicitate_zile: number | null;
  readonly periodicitate_contor: number | null;
  readonly numar_amanari: number;
  readonly urmatoarea_scadenta: string | null;
  readonly tip_contor: TipContor | null;
  readonly urmatoarea_scadenta_contor: number | null;
}

export interface SesizareRaport {
  readonly id: string;
  readonly equipment_id: string;
  readonly raportat_la: string;
  readonly atribuit_la: string | null;
  readonly rezolvat_la: string | null;
  readonly status: StatusSesizare;
}

export interface OprireRaport {
  readonly id: string;
  readonly equipment_id: string;
  readonly inceput: string;
  readonly sfarsit: string | null;
  readonly tip: TipOprire;
}

export interface IntrareRaport {
  readonly perioada: Perioada;
  readonly azi: string;
  /** Momentul curent, ISO — capătul opririlor încă deschise. */
  readonly acum: string;
  readonly program: ProgramLucru;
  readonly echipamente: readonly EchipamentRaport[];
  /** Intervențiile din `fereastraCitire(perioada)`. */
  readonly interventii: readonly InterventieRaport[];
  /** Execuțiile reușite ale planurilor, până la capătul perioadei. */
  readonly executiiPlanuri: readonly ExecutiePlan[];
  readonly planuri: readonly PlanRaport[];
  /** Sesizările raportate în `fereastraCitire(perioada)`. */
  readonly sesizari: readonly SesizareRaport[];
  /** Opririle care se suprapun cu perioada. */
  readonly opriri: readonly OprireRaport[];
}

// ── Ieșirile ────────────────────────────────────────────────────────────────

export interface CosturiDefalcate {
  /** Preventivă + predictivă. */
  readonly preventiv: number;
  readonly corectiv: number;
  readonly legal: number;
  readonly intern: number;
  readonly extern: number;
  /** Acoperit de garanție — raportat separat, NU intră în `suportat`. */
  readonly garantie: number;
  /** Ce a plătit firma: preventiv + corectiv + legal = intern + extern. */
  readonly suportat: number;
}

export interface RandEchipamentIndicatori {
  readonly equipmentId: string;
  readonly numarInterventii: number;
  readonly costuri: CosturiDefalcate;
  /** Costul suportat în ultimele 12 luni până la capătul perioadei. */
  readonly cost12Luni: number;
  readonly raportCostValoare: number | null;
  readonly semnalInlocuire: boolean;
  readonly sesizari: number;
  readonly opririNeplanificate: number;
  readonly oreProgram: number;
  readonly oreOprire: number;
  readonly disponibilitate: number | null;
  readonly mtbfOre: number | null;
  readonly costOpriri: number | null;
}

export interface RandPareto {
  readonly equipmentId: string;
  readonly valoare: number;
  /** Cota din total, 0–1. */
  readonly procent: number;
  readonly cumulat: number;
}

export interface Proportie {
  readonly laTimp: number;
  readonly evaluate: number;
  readonly rata: number | null;
}

export interface TotaluriRaport {
  readonly costuri: CosturiDefalcate;
  readonly numarInterventii: number;
  readonly sesizari: number;
  readonly oreProgram: number;
  readonly oreOprire: number;
  readonly disponibilitate: number | null;
  readonly mttrOre: number | null;
  readonly mtbfOre: number | null;
  readonly timpRezolvareOre: number | null;
  readonly timpAtribuireOre: number | null;
  readonly defecteRepetate: {
    readonly repetate: number;
    readonly total: number;
    readonly rata: number | null;
  };
  readonly planuriLaTimp: Proportie;
  readonly legaleLaTimp: Proportie;
  readonly zileDepasire: { readonly total: number; readonly maxim: number; readonly numar: number };
  readonly amanari: { readonly planuri: number; readonly total: number };
  readonly costOpriri: number | null;
}

export interface RaportMentenanta {
  readonly echipamente: readonly RandEchipamentIndicatori[];
  readonly paretoSesizari: readonly RandPareto[];
  readonly paretoCost: readonly RandPareto[];
  /** Planurile active cu amânări în curs, cele mai amânate primele. */
  readonly amanari: readonly PlanRaport[];
  /** Echipamentele peste `PRAG_COST_VALOARE_INLOCUIRE`. */
  readonly semnaleInlocuire: readonly string[];
  readonly totaluri: TotaluriRaport;
}

// ── Opririle ────────────────────────────────────────────────────────────────

/**
 * Orele unei opriri care cad în PROGRAM, în interiorul perioadei: pe fiecare zi
 * de program, cel mult `orePeZi`. O oprire încă deschisă se termină la `acum`.
 */
export function oreOprireInProgram(
  oprire: Pick<OprireRaport, "inceput" | "sfarsit">,
  perioada: Perioada,
  program: Pick<ProgramLucru, "orePeZi" | "zilePeSaptamana">,
  acum: string,
): number {
  const start = Math.max(Date.parse(oprire.inceput), inceputZi(perioada.deLa));
  const sfarsit = Math.min(
    Date.parse(oprire.sfarsit ?? acum),
    inceputZi(plusZile(perioada.panaLa, 1)),
  );
  if (!Number.isFinite(start) || !Number.isFinite(sfarsit) || sfarsit <= start) return 0;

  let ore = 0;
  const ultimaZi = toBucharestDateString(new Date(sfarsit - 1));
  for (let zi = toBucharestDateString(new Date(start)); zi <= ultimaZi; zi = plusZile(zi, 1)) {
    if (!esteZiDeProgram(zi, program.zilePeSaptamana)) continue;
    const a = Math.max(start, inceputZi(zi));
    const b = Math.min(sfarsit, inceputZi(plusZile(zi, 1)));
    if (b > a) ore += Math.min((b - a) / ORA_MS, program.orePeZi);
  }
  return ore;
}

/** Ziua românească a unui moment ISO. */
function ziua(moment: string): string {
  return toBucharestDateString(new Date(moment));
}

function inPerioada(zi: string, perioada: Perioada): boolean {
  return zi >= perioada.deLa && zi <= perioada.panaLa;
}

function medie(valori: readonly number[]): number | null {
  return imparte(
    valori.reduce((s, v) => s + v, 0),
    valori.length,
  );
}

function oreIntre(de: string, pana: string): number {
  return (Date.parse(pana) - Date.parse(de)) / ORA_MS;
}

// ── Costurile ───────────────────────────────────────────────────────────────

const COSTURI_ZERO: CosturiDefalcate = {
  preventiv: 0,
  corectiv: 0,
  legal: 0,
  intern: 0,
  extern: 0,
  garantie: 0,
  suportat: 0,
};

function adaugaCost(c: CosturiDefalcate, i: InterventieRaport): CosturiDefalcate {
  const cost = i.cost_total ?? 0;
  if (i.acoperit_de_garantie) return { ...c, garantie: c.garantie + cost };
  const extern = i.executant_extern !== null;
  return {
    ...c,
    preventiv: c.preventiv + (i.tip === "preventiva" || i.tip === "predictiva" ? cost : 0),
    corectiv: c.corectiv + (i.tip === "corectiva" ? cost : 0),
    legal: c.legal + (i.tip === "verificare_legala" ? cost : 0),
    intern: c.intern + (extern ? 0 : cost),
    extern: c.extern + (extern ? cost : 0),
    suportat: c.suportat + cost,
  };
}

function rotunjesteCosturi(c: CosturiDefalcate): CosturiDefalcate {
  return {
    preventiv: rotunjeste(c.preventiv),
    corectiv: rotunjeste(c.corectiv),
    legal: rotunjeste(c.legal),
    intern: rotunjeste(c.intern),
    extern: rotunjeste(c.extern),
    garantie: rotunjeste(c.garantie),
    suportat: rotunjeste(c.suportat),
  };
}

function pareto(valori: ReadonlyMap<string, number>): readonly RandPareto[] {
  const pozitive = [...valori].filter(([, v]) => v > 0);
  const total = pozitive.reduce((s, [, v]) => s + v, 0);
  let cumulat = 0;
  return pozitive
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_PARETO)
    .map(([equipmentId, valoare]) => {
      cumulat += valoare;
      return {
        equipmentId,
        valoare: rotunjeste(valoare),
        procent: imparte(valoare, total) ?? 0,
        cumulat: imparte(cumulat, total) ?? 0,
      };
    });
}

// ── Planurile ───────────────────────────────────────────────────────────────

interface JudecataExecutie {
  readonly laTimp: boolean;
  readonly zileIntarziere: number;
  readonly legal: boolean;
}

/** Execuțiile din perioadă care au o execuție precedentă, judecate față de ea. */
function judecaExecutii(
  executii: readonly ExecutiePlan[],
  planuri: ReadonlyMap<string, PlanRaport>,
  perioada: Perioada,
): readonly JudecataExecutie[] {
  const pePlan = new Map<string, ExecutiePlan[]>();
  for (const e of executii) {
    const lista = pePlan.get(e.plan_id) ?? [];
    lista.push(e);
    pePlan.set(e.plan_id, lista);
  }
  const judecati: JudecataExecutie[] = [];
  for (const [planId, lista] of pePlan) {
    const plan = planuri.get(planId);
    if (plan === undefined) continue;
    lista.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
    for (let k = 1; k < lista.length; k += 1) {
      const curenta = lista[k] as ExecutiePlan;
      const precedenta = lista[k - 1] as ExecutiePlan;
      if (!inPerioada(curenta.data, perioada)) continue;

      let evaluata = false;
      let laTimp = true;
      let zileIntarziere = 0;
      if (plan.periodicitate_zile !== null && plan.periodicitate_zile > 0) {
        evaluata = true;
        const scadenta = plusZile(precedenta.data, plan.periodicitate_zile);
        if (curenta.data > scadenta) {
          laTimp = false;
          zileIntarziere = zileIntre(scadenta, curenta.data);
        }
      }
      if (
        plan.periodicitate_contor !== null &&
        plan.periodicitate_contor > 0 &&
        curenta.citire_contor !== null &&
        precedenta.citire_contor !== null
      ) {
        evaluata = true;
        if (curenta.citire_contor > precedenta.citire_contor + plan.periodicitate_contor) {
          laTimp = false;
        }
      }
      if (evaluata) {
        judecati.push({ laTimp, zileIntarziere, legal: plan.tip === "verificare_legala" });
      }
    }
  }
  return judecati;
}

function proportie(judecati: readonly JudecataExecutie[]): Proportie {
  const laTimp = judecati.filter((j) => j.laTimp).length;
  return { laTimp, evaluate: judecati.length, rata: imparte(laTimp, judecati.length) };
}

// ── Raportul ────────────────────────────────────────────────────────────────

const STATUSURI_NENUMARATE: ReadonlySet<StatusSesizare> = new Set(["respins", "retrasa"]);

/** Fereastra în care echipamentul a fost în parc, în interiorul perioadei; `null` = deloc. */
function perioadaInParc(e: EchipamentRaport, perioada: Perioada): Perioada | null {
  const deLa =
    e.data_punerii_in_functiune !== null && e.data_punerii_in_functiune > perioada.deLa
      ? e.data_punerii_in_functiune
      : perioada.deLa;
  const panaLa = e.casat_la !== null && e.casat_la < perioada.panaLa ? e.casat_la : perioada.panaLa;
  return deLa > panaLa ? null : { deLa, panaLa };
}

export function calculeazaRaport(intrare: IntrareRaport): RaportMentenanta {
  const { perioada, program, acum } = intrare;
  const inceputAn = plusZile(plusLuni(perioada.panaLa, -12), 1);

  // ── Echipamentele din parc și orele lor de program ──
  const oreProgram = new Map<string, number>();
  for (const e of intrare.echipamente) {
    const fereastra = perioadaInParc(e, perioada);
    if (fereastra === null) continue;
    oreProgram.set(e.id, zileDeProgram(fereastra, program.zilePeSaptamana) * program.orePeZi);
  }
  const valoare = new Map(intrare.echipamente.map((e) => [e.id, e.valoare_achizitie] as const));

  // ── Costuri ──
  const costuri = new Map<string, CosturiDefalcate>();
  const numarInterventii = new Map<string, number>();
  const cost12Luni = new Map<string, number>();
  for (const i of intrare.interventii) {
    if (i.data <= perioada.panaLa && i.data >= inceputAn && !i.acoperit_de_garantie) {
      cost12Luni.set(i.equipment_id, (cost12Luni.get(i.equipment_id) ?? 0) + (i.cost_total ?? 0));
    }
    if (!inPerioada(i.data, perioada)) continue;
    costuri.set(i.equipment_id, adaugaCost(costuri.get(i.equipment_id) ?? COSTURI_ZERO, i));
    numarInterventii.set(i.equipment_id, (numarInterventii.get(i.equipment_id) ?? 0) + 1);
  }

  // ── Sesizări ──
  const valide = intrare.sesizari.filter((s) => !STATUSURI_NENUMARATE.has(s.status));
  const dinPerioada = valide.filter((s) => inPerioada(ziua(s.raportat_la), perioada));
  const sesizariPeEchipament = new Map<string, number>();
  for (const s of dinPerioada) {
    sesizariPeEchipament.set(s.equipment_id, (sesizariPeEchipament.get(s.equipment_id) ?? 0) + 1);
  }
  const repetate = dinPerioada.filter((s) => {
    const t = Date.parse(s.raportat_la);
    return valide.some(
      (alta) =>
        alta.id !== s.id &&
        alta.equipment_id === s.equipment_id &&
        Date.parse(alta.raportat_la) < t &&
        t - Date.parse(alta.raportat_la) <= ZILE_DEFECT_REPETAT * ZI_MS,
    );
  }).length;
  const timpAtribuire = dinPerioada
    .filter((s) => s.atribuit_la !== null)
    .map((s) => oreIntre(s.raportat_la, s.atribuit_la as string))
    .filter((h) => h >= 0);
  const timpRezolvare = dinPerioada
    .filter((s) => s.rezolvat_la !== null)
    .map((s) => oreIntre(s.raportat_la, s.rezolvat_la as string))
    .filter((h) => h >= 0);

  // ── Opriri ──
  const oreOprire = new Map<string, number>();
  const oreNeplanificate = new Map<string, number>();
  const caderi = new Map<string, number>();
  const durateReparatie: number[] = [];
  for (const o of intrare.opriri) {
    const ore = oreOprireInProgram(o, perioada, program, acum);
    oreOprire.set(o.equipment_id, (oreOprire.get(o.equipment_id) ?? 0) + ore);
    if (o.tip !== "neplanificata") continue;
    oreNeplanificate.set(o.equipment_id, (oreNeplanificate.get(o.equipment_id) ?? 0) + ore);
    if (inPerioada(ziua(o.inceput), perioada)) {
      caderi.set(o.equipment_id, (caderi.get(o.equipment_id) ?? 0) + 1);
    }
    if (o.sfarsit !== null && inPerioada(ziua(o.sfarsit), perioada)) {
      const h = oreIntre(o.inceput, o.sfarsit);
      if (h >= 0) durateReparatie.push(h);
    }
  }

  const costOra = program.costOraOprire;

  // ── Rândurile pe echipament ──
  const iduri = new Set<string>([
    ...oreProgram.keys(),
    ...costuri.keys(),
    ...sesizariPeEchipament.keys(),
    ...oreOprire.keys(),
  ]);
  const randuri: RandEchipamentIndicatori[] = [...iduri].map((id) => {
    const program_ = oreProgram.get(id) ?? 0;
    const oprire = oreOprire.get(id) ?? 0;
    const neplanificate = oreNeplanificate.get(id) ?? 0;
    const nrCaderi = caderi.get(id) ?? 0;
    const an = rotunjeste(cost12Luni.get(id) ?? 0);
    const val = valoare.get(id) ?? null;
    const raport = val === null ? null : imparte(an, val);
    const disponibilitate = imparte(program_ - oprire, program_);
    return {
      equipmentId: id,
      numarInterventii: numarInterventii.get(id) ?? 0,
      costuri: rotunjesteCosturi(costuri.get(id) ?? COSTURI_ZERO),
      cost12Luni: an,
      raportCostValoare: raport,
      semnalInlocuire: raport !== null && raport > PRAG_COST_VALOARE_INLOCUIRE,
      sesizari: sesizariPeEchipament.get(id) ?? 0,
      opririNeplanificate: nrCaderi,
      oreProgram: program_,
      oreOprire: rotunjeste(oprire),
      disponibilitate: disponibilitate === null ? null : Math.min(1, Math.max(0, disponibilitate)),
      mtbfOre: oreProgram.has(id) ? imparte(program_ - neplanificate, nrCaderi) : null,
      costOpriri: costOra === null ? null : rotunjeste(oprire * costOra),
    };
  });
  randuri.sort(
    (a, b) =>
      b.costuri.suportat - a.costuri.suportat ||
      b.sesizari - a.sesizari ||
      b.oreOprire - a.oreOprire ||
      a.equipmentId.localeCompare(b.equipmentId),
  );

  // ── Planuri ──
  const harta = new Map(intrare.planuri.map((p) => [p.id, p] as const));
  const judecati = judecaExecutii(intrare.executiiPlanuri, harta, perioada);
  const legale = judecati.filter((j) => j.legal);
  const referinta = perioada.panaLa < intrare.azi ? perioada.panaLa : intrare.azi;
  const depasiri = [
    ...legale.filter((j) => !j.laTimp).map((j) => j.zileIntarziere),
    ...intrare.planuri
      .filter(
        (p) =>
          p.activ &&
          p.tip === "verificare_legala" &&
          p.urmatoarea_scadenta !== null &&
          p.urmatoarea_scadenta < referinta,
      )
      .map((p) => zileIntre(p.urmatoarea_scadenta as string, referinta)),
  ].filter((z) => z > 0);
  const amanate = intrare.planuri
    .filter((p) => p.activ && p.numar_amanari > 0)
    .sort((a, b) => b.numar_amanari - a.numar_amanari || a.denumire.localeCompare(b.denumire));

  // ── Totaluri ──
  const sumaProgram = [...oreProgram.values()].reduce((s, v) => s + v, 0);
  const sumaOprire = [...oreOprire.values()].reduce((s, v) => s + v, 0);
  const sumaNeplanificateInParc = [...oreProgram.keys()].reduce(
    (s, id) => s + (oreNeplanificate.get(id) ?? 0),
    0,
  );
  const sumaCaderi = [...oreProgram.keys()].reduce((s, id) => s + (caderi.get(id) ?? 0), 0);
  const disponibilitateParc = imparte(sumaProgram - sumaOprire, sumaProgram);

  const totalCosturi = [...costuri.values()].reduce(
    (acc, c) => ({
      preventiv: acc.preventiv + c.preventiv,
      corectiv: acc.corectiv + c.corectiv,
      legal: acc.legal + c.legal,
      intern: acc.intern + c.intern,
      extern: acc.extern + c.extern,
      garantie: acc.garantie + c.garantie,
      suportat: acc.suportat + c.suportat,
    }),
    COSTURI_ZERO,
  );

  return {
    echipamente: randuri,
    paretoSesizari: pareto(sesizariPeEchipament),
    paretoCost: pareto(new Map([...costuri].map(([id, c]) => [id, c.suportat] as const))),
    amanari: amanate,
    semnaleInlocuire: randuri.filter((r) => r.semnalInlocuire).map((r) => r.equipmentId),
    totaluri: {
      costuri: rotunjesteCosturi(totalCosturi),
      numarInterventii: [...numarInterventii.values()].reduce((s, v) => s + v, 0),
      sesizari: dinPerioada.length,
      oreProgram: sumaProgram,
      oreOprire: rotunjeste(sumaOprire),
      disponibilitate:
        disponibilitateParc === null ? null : Math.min(1, Math.max(0, disponibilitateParc)),
      mttrOre: medie(durateReparatie),
      mtbfOre: imparte(sumaProgram - sumaNeplanificateInParc, sumaCaderi),
      timpRezolvareOre: medie(timpRezolvare),
      timpAtribuireOre: medie(timpAtribuire),
      defecteRepetate: {
        repetate,
        total: dinPerioada.length,
        rata: imparte(repetate, dinPerioada.length),
      },
      planuriLaTimp: proportie(judecati),
      legaleLaTimp: proportie(legale),
      zileDepasire: {
        total: depasiri.reduce((s, z) => s + z, 0),
        maxim: depasiri.length === 0 ? 0 : Math.max(...depasiri),
        numar: depasiri.length,
      },
      amanari: {
        planuri: amanate.length,
        total: amanate.reduce((s, p) => s + p.numar_amanari, 0),
      },
      costOpriri: costOra === null ? null : rotunjeste(sumaOprire * costOra),
    },
  };
}

/** Câte contoare (cu plan pe ele) n-au mai fost citite peste prag — sau deloc. */
export function citiriRestante(
  ultimeleDate: readonly (string | null)[],
  azi: string,
  pragZile: number,
): number {
  return ultimeleDate.filter((data) => contorInvechit(data, azi, pragZile)).length;
}

/**
 * Contoarele pe care stau planuri ACTIVE cu scadență pe contor, fiecare o dată —
 * aceeași mulțime pe care panoul o verifică pentru „Contoare necitite”.
 */
export function contoareCuPlan(
  planuri: readonly PlanRaport[],
): readonly { readonly equipmentId: string; readonly tip: TipContor }[] {
  const unice = new Map<string, { readonly equipmentId: string; readonly tip: TipContor }>();
  for (const p of planuri) {
    if (!p.activ || p.tip_contor === null || p.urmatoarea_scadenta_contor === null) continue;
    unice.set(`${p.equipment_id}:${p.tip_contor}`, {
      equipmentId: p.equipment_id,
      tip: p.tip_contor,
    });
  }
  return [...unice.values()];
}
