// src/lib/audit/diff.ts
/**
 * Comparație pură între `before` și `after` din `audit_logs`.
 *
 * Nu atinge rețeaua, nu citește ceasul și nu modifică argumentele: primește
 * două valori JSON și întoarce lista câmpurilor schimbate. Este folosită atât
 * de interfață, cât și de exportul CSV, deci trebuie să rămână deterministă.
 *
 * Plasă de siguranță (dublează allow-list-ul de la scriere): orice cheie care
 * seamănă a secret este afișată mascată, chiar dacă ar ajunge din greșeală în
 * jurnal.
 */

export type Json =
  string | number | boolean | null | readonly Json[] | { readonly [cheie: string]: Json };

export type TipModificare = "adaugat" | "modificat" | "sters";

export type ModificareCamp = Readonly<{
  /** Calea completă până la câmp, ex. ['settings', 'limita']. */
  cale: readonly string[];
  tip: TipModificare;
  /** `undefined` înseamnă „câmpul lipsea", `null` înseamnă „era gol". */
  inainte: Json | undefined;
  dupa: Json | undefined;
  mascat: boolean;
}>;

export const VALOARE_MASCATA = "••••••";

const TIPARE_SENSIBILE = /token|secret|parol|password|cnp|iban|hash|api[_-]?key/i;

export const esteCheieSensibila = (cheie: string): boolean => TIPARE_SENSIBILE.test(cheie);

const ADANCIME_IMPLICITA = 3;
const LUNGIME_MAXIMA_TEXT = 200;

type HartaJson = { readonly [cheie: string]: Json };

const esteHartaJson = (valoare: Json | undefined): valoare is HartaJson =>
  typeof valoare === "object" && valoare !== null && !Array.isArray(valoare);

/** Aduce orice `unknown` (jsonb, Date, undefined) la forma `Json | undefined`. */
const normalizeaza = (valoare: unknown): Json | undefined => {
  if (valoare === undefined) return undefined;
  if (valoare === null) return null;
  if (typeof valoare === "string" || typeof valoare === "number" || typeof valoare === "boolean") {
    return valoare;
  }
  if (Array.isArray(valoare)) {
    return valoare.map((element) => normalizeaza(element) ?? null);
  }
  if (typeof valoare === "object") {
    const intrari = Object.entries(valoare as Record<string, unknown>).flatMap<[string, Json]>(
      ([cheie, val]) => {
        const normalizat = normalizeaza(val);
        return normalizat === undefined ? [] : [[cheie, normalizat]];
      },
    );
    return Object.fromEntries(intrari);
  }
  return String(valoare);
};

const suntEgale = (a: Json | undefined, b: Json | undefined): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((element, index) => suntEgale(element, b[index]));
  }
  if (esteHartaJson(a) && esteHartaJson(b)) {
    const chei = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...chei].every((cheie) => suntEgale(a[cheie], b[cheie]));
  }
  return false;
};

const mascheaza = (valoare: Json | undefined, mascat: boolean): Json | undefined => {
  if (!mascat) return valoare;
  if (valoare === undefined || valoare === null) return valoare;
  return VALOARE_MASCATA;
};

const construiesteModificare = (
  cale: readonly string[],
  inainte: Json | undefined,
  dupa: Json | undefined,
): ModificareCamp => {
  const mascat = cale.some(esteCheieSensibila);
  const tip: TipModificare =
    inainte === undefined ? "adaugat" : dupa === undefined ? "sters" : "modificat";
  return {
    cale,
    tip,
    inainte: mascheaza(inainte, mascat),
    dupa: mascheaza(dupa, mascat),
    mascat,
  };
};

/** `null` de o parte și obiect de cealaltă = câmpul practic lipsea. */
const caHarta = (valoare: Json | undefined): HartaJson | undefined =>
  esteHartaJson(valoare) ? valoare : undefined;

const potFiParcurse = (a: Json | undefined, b: Json | undefined): boolean => {
  const aParcurgibil = esteHartaJson(a) || a === undefined || a === null;
  const bParcurgibil = esteHartaJson(b) || b === undefined || b === null;
  return aParcurgibil && bParcurgibil && (esteHartaJson(a) || esteHartaJson(b));
};

const comparaHarti = (
  a: HartaJson | undefined,
  b: HartaJson | undefined,
  cale: readonly string[],
  adancime: number,
): readonly ModificareCamp[] => {
  const chei = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].sort((x, y) =>
    x.localeCompare(y, "ro"),
  );
  return chei.flatMap((cheie) => {
    const valoareA = a === undefined ? undefined : a[cheie];
    const valoareB = b === undefined ? undefined : b[cheie];
    if (suntEgale(valoareA, valoareB)) return [];
    const caleNoua = [...cale, cheie];
    if (adancime > 0 && potFiParcurse(valoareA, valoareB)) {
      return comparaHarti(caHarta(valoareA), caHarta(valoareB), caleNoua, adancime - 1);
    }
    return [construiesteModificare(caleNoua, valoareA, valoareB)];
  });
};

export const comparaPayload = (
  inainteBrut: unknown,
  dupaBrut: unknown,
  optiuni: Readonly<{ adancimeMaxima?: number }> = {},
): readonly ModificareCamp[] => {
  const adancime = optiuni.adancimeMaxima ?? ADANCIME_IMPLICITA;
  const inainte = normalizeaza(inainteBrut);
  const dupa = normalizeaza(dupaBrut);
  if (suntEgale(inainte, dupa)) return [];
  if (potFiParcurse(inainte, dupa)) {
    return comparaHarti(caHarta(inainte), caHarta(dupa), [], adancime);
  }
  // Payload scalar sau listă: o singură intrare, la rădăcină.
  return [construiesteModificare(["valoare"], inainte, dupa)];
};

const scurteaza = (text: string): string =>
  text.length > LUNGIME_MAXIMA_TEXT ? `${text.slice(0, LUNGIME_MAXIMA_TEXT)}…` : text;

/** Reprezentare textuală, folosită identic în interfață și în exportul CSV. */
export const formateazaValoare = (valoare: Json | undefined): string => {
  if (valoare === undefined) return "—";
  if (valoare === null) return "(gol)";
  if (typeof valoare === "boolean") return valoare ? "Da" : "Nu";
  if (typeof valoare === "number") return String(valoare);
  if (typeof valoare === "string") return valoare.trim() === "" ? "(gol)" : scurteaza(valoare);
  return scurteaza(JSON.stringify(valoare));
};
