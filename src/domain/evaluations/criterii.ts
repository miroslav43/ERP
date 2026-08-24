// src/domain/evaluations/criterii.ts

/**
 * Criteriile unui șablon de evaluare: forma lor, codurile lor și ponderile.
 *
 * ── DE CE E DOMENIU, NU CODUL ACȚIUNII ────────────────────────────────────
 * `codDinDenumire` a stat până acum în `src/app/(app)/evaluari/actions.ts`,
 * unde nu putea fi testată — `PROGRESS.md` numește „zero teste pe actions /
 * queries / pagini" blocajul #3, iar defectul de mai jos a trăit acolo tocmai
 * fiindcă nimic nu-l executa în afara unui request.
 *
 * ── DEFECTUL REPARAT AICI ─────────────────────────────────────────────────
 * Slug-ul nu deduplica. Două criterii care se reduc la același cod („Calitatea
 * muncii" și „Calitatea muncii!", sau „Lucru în echipă" și „Lucru in echipa")
 * produceau două elemente cu `cod` identic. Consecințele erau două, ambele
 * tăcute: React primea `key` duplicat în lista de criterii, iar răspunsurile,
 * strânse într-un `Record<string, number>` indexat pe cod, se suprascriau —
 * omul nota două criterii și se salva unul singur.
 *
 * ── FORMA VECHE ȘI FORMA NOUĂ ─────────────────────────────────────────────
 * `0038` scria `{cod, denumire, scala_max}`. `0071` a lărgit-o cu `descriere`,
 * `tip` și `pondere`. `normalizeazaCriterii` ridică forma veche la cea nouă la
 * CITIRE, nu printr-o migrare de date, fiindcă `criterii` e jsonb liber: un
 * rând scris de o versiune mai veche a aplicației, sau editat manual în bază,
 * ar trece oricând de orice migrare. Poarta trebuie să fie la citire.
 *
 * `da_nu` se reprezintă ca scală cu maximul 1. Nu e un artificiu de stocare:
 * face ca punctajul ponderat să aibă o singură formulă pentru toate tipurile
 * (`scor / scala_max`), în loc de o ramură separată care se uită cu ușurință.
 */

export const TIPURI_CRITERIU = ["scala", "da_nu", "text"] as const;
export type TipCriteriu = (typeof TIPURI_CRITERIU)[number];

/** Scalele oferite în constructor. 1..N, unde N e una dintre valorile astea. */
export const SCALE_PERMISE = [3, 4, 5, 10] as const;
export type ScalaPermisa = (typeof SCALE_PERMISE)[number];

export const MAXIM_CRITERII = 30;

export interface CriteriuSablon {
  readonly cod: string;
  readonly denumire: string;
  /** Ghid de notare, arătat sub criteriu la completare. */
  readonly descriere: string | null;
  readonly tip: TipCriteriu;
  /** Maximul scalei. `1` la `da_nu`, `0` la `text` (nu se punctează). */
  readonly scala_max: number;
  /** 0..100, sau `null` peste tot dacă șablonul nu folosește ponderi. */
  readonly pondere: number | null;
}

/**
 * Cod stabil dintr-o denumire: fără diacritice, fără semne, spații → underscore.
 *
 * Descompunerea NFD separă litera de semnul diacritic, iar intervalul U+0300 -
 * U+036F („Combining Diacritical Marks") le șterge pe acestea din urmă. Pe
 * ș/ț cu virgulă dedesubt (U+0219/U+021B), pe care le cere proiectul, asta dă
 * `s` și `t`, nu un caracter pierdut.
 */
export function codDinDenumire(denumire: string): string {
  return denumire
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 80);
}

/**
 * Atribuie coduri unice unei liste de denumiri, în ordinea dată.
 *
 * La coliziune se adaugă `_2`, `_3`… — nu un indice de poziție și nu un uuid.
 * Poziția s-ar schimba la reordonare, iar codul e cheia sub care stau
 * răspunsurile deja date: mutarea unui criteriu în sus n-are voie să rupă
 * legătura cu notele istorice. Un uuid ar fi stabil, dar ar face jsonb-ul
 * ilizibil la o inspecție în bază, unde e citit cel mai des.
 *
 * Codul gol (o denumire numai din semne, „???") cade pe `criteriu`, ca să nu
 * se producă niciodată o cheie vidă.
 */
export function atribuieCoduri(denumiri: readonly string[]): readonly string[] {
  const folosite = new Set<string>();
  return denumiri.map((denumire) => {
    const baza = codDinDenumire(denumire) === "" ? "criteriu" : codDinDenumire(denumire);
    if (!folosite.has(baza)) {
      folosite.add(baza);
      return baza;
    }
    let n = 2;
    while (folosite.has(`${baza}_${String(n)}`)) n += 1;
    const unic = `${baza}_${String(n)}`;
    folosite.add(unic);
    return unic;
  });
}

/**
 * Reatribuie codurile păstrându-le pe cele deja stabilite.
 *
 * La editarea unui șablon, criteriile existente își păstrează codul chiar dacă
 * li se schimbă denumirea — altfel evaluările vechi ar arăta „calitate_munca"
 * ca text brut, fiindcă instantaneul lor ar rămâne pe codul vechi în timp ce
 * șablonul l-ar fi schimbat. Doar criteriile NOI (fără cod) primesc unul.
 */
export function completeazaCoduri(
  criterii: readonly Readonly<{ cod?: string | null; denumire: string }>[],
): readonly string[] {
  const folosite = new Set<string>();
  for (const c of criterii) {
    if (typeof c.cod === "string" && c.cod !== "") folosite.add(c.cod);
  }
  return criterii.map((c) => {
    if (typeof c.cod === "string" && c.cod !== "") return c.cod;
    const brut = codDinDenumire(c.denumire);
    const baza = brut === "" ? "criteriu" : brut;
    if (!folosite.has(baza)) {
      folosite.add(baza);
      return baza;
    }
    let n = 2;
    while (folosite.has(`${baza}_${String(n)}`)) n += 1;
    const unic = `${baza}_${String(n)}`;
    folosite.add(unic);
    return unic;
  });
}

/** Maximul implicit pentru un tip, când jsonb-ul nu-l poartă. */
function scalaImplicita(tip: TipCriteriu): number {
  if (tip === "da_nu") return 1;
  if (tip === "text") return 0;
  return 5;
}

function esteObiect(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Ridică `criterii` din jsonb la forma curentă, tolerant la ce lipsește.
 *
 * Nu aruncă niciodată. O coloană jsonb poate conține orice, iar un ecran de
 * citire care aruncă pe un rând stricat scoate din funcțiune toată pagina, nu
 * doar rândul. Ce nu se poate interpreta se lasă deoparte în tăcere; ce se
 * poate, se afișează.
 */
export function normalizeazaCriterii(valoare: unknown): readonly CriteriuSablon[] {
  if (!Array.isArray(valoare)) return [];
  const iesire: CriteriuSablon[] = [];
  for (const brut of valoare) {
    if (!esteObiect(brut)) continue;
    const denumire = typeof brut.denumire === "string" ? brut.denumire.trim() : "";
    if (denumire === "") continue;

    const tipBrut = brut.tip;
    const tip: TipCriteriu =
      typeof tipBrut === "string" && (TIPURI_CRITERIU as readonly string[]).includes(tipBrut)
        ? (tipBrut as TipCriteriu)
        : "scala";

    const scalaBruta = brut.scala_max;
    const scala_max =
      typeof scalaBruta === "number" && Number.isFinite(scalaBruta) && scalaBruta > 0
        ? Math.trunc(scalaBruta)
        : scalaImplicita(tip);

    const pondereBruta = brut.pondere;
    const pondere =
      typeof pondereBruta === "number" && Number.isFinite(pondereBruta) && pondereBruta >= 0
        ? Math.min(100, Math.round(pondereBruta))
        : null;

    iesire.push({
      cod: typeof brut.cod === "string" && brut.cod !== "" ? brut.cod : codDinDenumire(denumire),
      denumire,
      descriere:
        typeof brut.descriere === "string" && brut.descriere.trim() !== ""
          ? brut.descriere.trim()
          : null,
      tip,
      // `text` nu se punctează niciodată, oricât ar scrie în jsonb.
      scala_max: tip === "text" ? 0 : tip === "da_nu" ? 1 : scala_max,
      pondere,
    });
  }
  return iesire;
}

export interface StarePonderi {
  /** Șablonul folosește ponderi (cel puțin una e completată). */
  readonly arePonderi: boolean;
  readonly total: number;
  /** Ori toate lipsesc, ori toate sunt puse și dau 100. */
  readonly valida: boolean;
  /** Criteriile punctabile fără pondere, când restul au. */
  readonly fara: readonly string[];
}

/**
 * Ponderile sunt „tot sau nimic".
 *
 * Un șablon cu trei criterii din care doar unul are 40 % nu are o interpretare
 * evidentă: nici nu se poate normaliza (restul n-au greutate declarată), nici
 * nu se poate ignora (cineva a scris 40 cu un scop). Constructorul cere deci
 * ori zero ponderi, ori toate, însumând 100. Criteriile de tip `text` nu intră
 * în sumă: nu se punctează.
 */
export function valideazaPonderi(criterii: readonly CriteriuSablon[]): StarePonderi {
  const punctabile = criterii.filter((c) => c.tip !== "text");
  const cuPondere = punctabile.filter((c) => c.pondere !== null);
  const arePonderi = cuPondere.length > 0;
  const total = cuPondere.reduce((s, c) => s + (c.pondere ?? 0), 0);
  const fara = punctabile.filter((c) => c.pondere === null).map((c) => c.denumire);
  if (!arePonderi) return { arePonderi: false, total: 0, valida: true, fara: [] };
  return { arePonderi: true, total, valida: fara.length === 0 && total === 100, fara };
}
