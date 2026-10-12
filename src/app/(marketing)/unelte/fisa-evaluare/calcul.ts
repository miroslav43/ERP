/**
 * Calculul fișei de evaluare: punctaj pe criteriu, nota finală, calificativ.
 *
 * ── DE CE ÎN SUTIMI, NU ÎN ZECIMALE ───────────────────────────────────────
 * Ponderile sunt procente întregi, notele sunt întregi de la 1 la 5. Produsul
 * pondere × notă e deci un număr întreg de sutimi de punct: 20 % × 4 = 80
 * sutimi = 0,80. Suma lor, cu ponderile făcând 100, e nota finală exactă cu
 * două zecimale, fără nicio rotunjire și fără virgulă mobilă. Pragurile
 * calificativelor se țin tot în sutimi, ca 3,50 să nu devină 3,4999999.
 *
 * ── CE NU E LEGE ──────────────────────────────────────────────────────────
 * Codul muncii nu dă nici scala, nici formula, nici calificativele (art. 40
 * alin. (1) lit. f) lasă criteriile la angajator; art. 242 lit. i) le trimite
 * în regulamentul intern). Scala 1–5, media ponderată și cele patru
 * calificative sunt convenția obișnuită din practică, puse aici ca implicit;
 * pragurile se pot schimba din formular.
 *
 * Fișier pur, fără importuri: îl folosesc și serverul (documentul), și grila
 * din browser (calculul pe loc).
 */

export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 5;
/** Cât încape într-o fișă de o pagină și jumătate și într-o adresă sub ~12 KB. */
export const MAX_CRITERII = 15;
export const MAX_CRITERIU = 120;

/** Ce înseamnă fiecare notă, față de cerințele postului (fișa postului). */
export const SCALA_NOTE: readonly Readonly<{ nota: number; descriere: string }>[] = [
  { nota: 1, descriere: "mult sub cerințele postului" },
  { nota: 2, descriere: "sub cerințele postului" },
  { nota: 3, descriere: "la nivelul cerințelor postului" },
  { nota: 4, descriere: "peste cerințele postului" },
  { nota: 5, descriere: "mult peste cerințele postului" },
];

export type Calificativ = "Foarte bine" | "Bine" | "Satisfăcător" | "Nesatisfăcător";

/** Pragurile de jos ale calificativelor, în sutimi de punct (450 = 4,50). */
export type Praguri = Readonly<{ foarteBine: number; bine: number; satisfacator: number }>;

export const PRAGURI_IMPLICITE: Praguri = { foarteBine: 450, bine: 350, satisfacator: 250 };

/** Un criteriu citit: ponderea în procente întregi, nota întreagă; `null` = necompletat. */
export type RandNotat = Readonly<{ pondere: number | null; nota: number | null }>;

export type RezultatGrila = Readonly<{
  /** Suma ponderilor completate. */
  sumaPonderi: number;
  /** Câte criterii n-au pondere. */
  faraPondere: number;
  /** Câte criterii n-au notă. */
  faraNota: number;
  /** Pondere × notă, în sutimi, pe fiecare criteriu; `null` unde lipsește una dintre ele. */
  punctaje: readonly (number | null)[];
  /** În sutimi; `null` până când toate criteriile au pondere și notă, iar ponderile fac 100. */
  notaFinala: number | null;
  calificativ: Calificativ | null;
}>;

const PONDERE = /^(\d{1,3})\s*%?$/u;
const NOTA = /^[1-5]$/u;
const SUTIMI = /^(\d)(?:[.,](\d{1,2}))?$/u;

/** „20”, „20%”, „ 20 % ” → 20. Doar întregi de la 1 la 100; altfel `null`. */
export function citestePondere(brut: string): number | null {
  const potrivire = PONDERE.exec(brut.trim());
  if (potrivire === null) return null;
  const valoare = Number(potrivire[1]);
  return valoare >= 1 && valoare <= 100 ? valoare : null;
}

/** „4” → 4. Doar întregi de la 1 la 5; altfel `null`. */
export function citesteNota(brut: string): number | null {
  const curat = brut.trim();
  return NOTA.test(curat) ? Number(curat) : null;
}

/** „4,5”, „4.50”, „4” → 450. Între 1,00 și 5,00; altfel `null`. */
export function citesteSutimi(brut: string): number | null {
  const potrivire = SUTIMI.exec(brut.trim());
  if (potrivire === null) return null;
  const intregi = Number(potrivire[1]);
  const zecimale = Number((potrivire[2] ?? "0").padEnd(2, "0"));
  const sutimi = intregi * 100 + zecimale;
  return sutimi >= NOTA_MINIMA * 100 && sutimi <= NOTA_MAXIMA * 100 ? sutimi : null;
}

/**
 * Pragurile din formular. Un câmp lipsă ia implicitul lui; dacă rezultatul nu
 * e strict descrescător peste 1,00 (Foarte bine > Bine > Satisfăcător > 1,00),
 * se folosesc toate implicitele și `corectate` spune asta, ca pagina să avizeze.
 */
export function citestePraguri(
  foarteBine: string | null,
  bine: string | null,
  satisfacator: string | null,
): Readonly<{ praguri: Praguri; corectate: boolean }> {
  const lipsa = (v: string | null) => v === null || v.trim() === "";
  if (lipsa(foarteBine) && lipsa(bine) && lipsa(satisfacator)) {
    return { praguri: PRAGURI_IMPLICITE, corectate: false };
  }
  const unul = (v: string | null, implicit: number) =>
    lipsa(v) ? implicit : citesteSutimi(v ?? "");
  const fb = unul(foarteBine, PRAGURI_IMPLICITE.foarteBine);
  const b = unul(bine, PRAGURI_IMPLICITE.bine);
  const s = unul(satisfacator, PRAGURI_IMPLICITE.satisfacator);
  if (fb === null || b === null || s === null || !(fb > b && b > s && s > NOTA_MINIMA * 100)) {
    return { praguri: PRAGURI_IMPLICITE, corectate: true };
  }
  return { praguri: { foarteBine: fb, bine: b, satisfacator: s }, corectate: false };
}

/**
 * 100 împărțit pe `n` criterii, în întregi: diferența dintre oricare două e cel
 * mult 1, iar restul merge la primele. 6 → 17, 17, 17, 17, 16, 16.
 */
export function ponderiEgale(n: number): number[] {
  if (n <= 0) return [];
  const baza = Math.floor(100 / n);
  const rest = 100 - baza * n;
  return Array.from({ length: n }, (_, i) => (i < rest ? baza + 1 : baza));
}

export function calificativPentru(notaSutimi: number, praguri: Praguri): Calificativ {
  if (notaSutimi >= praguri.foarteBine) return "Foarte bine";
  if (notaSutimi >= praguri.bine) return "Bine";
  if (notaSutimi >= praguri.satisfacator) return "Satisfăcător";
  return "Nesatisfăcător";
}

/** 385 → „3,85”; 80 → „0,80”. */
export function formateazaSutimi(sutimi: number): string {
  return `${String(Math.floor(sutimi / 100))},${String(sutimi % 100).padStart(2, "0")}`;
}

export function calculeazaGrila(randuri: readonly RandNotat[], praguri: Praguri): RezultatGrila {
  const punctaje = randuri.map((r) =>
    r.pondere === null || r.nota === null ? null : r.pondere * r.nota,
  );
  const sumaPonderi = randuri.reduce((s, r) => s + (r.pondere ?? 0), 0);
  const faraPondere = randuri.filter((r) => r.pondere === null).length;
  const faraNota = randuri.filter((r) => r.nota === null).length;
  const complet = randuri.length > 0 && faraPondere === 0 && faraNota === 0;
  const notaFinala =
    complet && sumaPonderi === 100 ? punctaje.reduce<number>((s, p) => s + (p ?? 0), 0) : null;
  return {
    sumaPonderi,
    faraPondere,
    faraNota,
    punctaje,
    notaFinala,
    calificativ: notaFinala === null ? null : calificativPentru(notaFinala, praguri),
  };
}

const criterii = (n: number) => (n === 1 ? "un criteriu" : `${String(n)} criterii`);

/**
 * Ce împiedică nota finală, în cuvinte, pentru pagină. Gol când nu e nimic de
 * spus. Notele lipsă NU sunt un aviz: fișa se tipărește des goală, pentru
 * notat de mână.
 */
export function avizePonderi(r: RezultatGrila): string[] {
  if (r.faraPondere > 0) {
    return [`Lipsește ponderea la ${criterii(r.faraPondere)}: nota finală nu se poate calcula.`];
  }
  if (r.sumaPonderi !== 100) {
    return [
      `Ponderile însumează ${String(r.sumaPonderi)}%, nu 100%: nota finală nu se poate calcula.`,
    ];
  }
  return [];
}
