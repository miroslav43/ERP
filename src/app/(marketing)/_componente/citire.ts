/**
 * Calculul din spatele evenimentului `citire` — cât a stat cineva pe o pagină,
 * cât a derulat și ce secțiuni a avut efectiv sub ochi.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Umami calculează durata unei vizite din diferența dintre prima și ultima
 * afișare de pagină. Vizitatorul care citește prima pagină cinci minute și
 * pleacă are, pentru Umami, ZERO secunde: o singură afișare, nicio diferență.
 * Pe 6 oct 2026, 58% din vizite erau așa, iar mediana duratei ieșea 0 s —
 * cifra spunea „nimeni nu citește", când de fapt nu se măsura nimic.
 *
 * ── DE CE MODUL NEUTRU ────────────────────────────────────────────────────
 * Fără directivă, ca `consimtamant.ts`: se testează în mediul `node`, fără
 * DOM, și nu devine proxy dacă îl importă vreodată un component de server.
 */

/** Plafonul duratei: o filă uitată deschisă peste noapte nu e citire. */
export const SECUNDE_MAXIME = 1800;

/** Umami taie valorile de tip șir la 500 de caractere. */
const LUNGIME_MAXIMA = 500;

/**
 * Cât din pagină a ajuns în fereastră, în procente rotunjite la zece.
 *
 * Rotunjirea e intenționată: 63% și 67% nu spun lucruri diferite, iar treptele
 * de zece fac din proprietate o distribuție care se citește dintr-o privire în
 * panoul Umami, nu o listă de o sută de valori cu câte un vizitator.
 */
export function procentDerulat(
  scrollY: number,
  inaltimeFereastra: number,
  inaltimeDocument: number,
): number {
  if (inaltimeDocument <= 0) return 100;
  const vazut = (scrollY + inaltimeFereastra) / inaltimeDocument;
  return Math.min(100, Math.max(0, Math.round(vazut * 10) * 10));
}

export type StareCitire = {
  /** Milisecunde cu fila VIZIBILĂ — nu timpul de ceas de la intrare. */
  readonly msActive: number;
  readonly procentMaxim: number;
  /** Identificatorii secțiunilor văzute, în ordinea în care au apărut. */
  readonly sectiuni: readonly string[];
};

/**
 * Datele evenimentului, în forma pe care o acceptă `umami.track`.
 *
 * `ultima` e secțiunea cea mai de jos din pagină care a fost văzută — nu
 * ultima în timp. De aici se citește unde se opresc oamenii: dacă majoritatea
 * au `ultima = module` și aproape nimeni `preturi`, prețurile stau prea jos.
 */
export function dateCitire(
  stare: StareCitire,
  ordineInPagina: readonly string[],
): Record<string, string | number> {
  const secunde = Math.min(SECUNDE_MAXIME, Math.round(stare.msActive / 1000));
  const vazute = new Set(stare.sectiuni);
  const ultima = ordineInPagina.filter((id) => vazute.has(id)).at(-1);

  const date: Record<string, string | number> = {
    secunde,
    derulat: stare.procentMaxim,
  };
  if (stare.sectiuni.length > 0) {
    date.sectiuni = stare.sectiuni.join(",").slice(0, LUNGIME_MAXIMA);
  }
  if (ultima !== undefined) {
    date.ultima = ultima;
  }
  return date;
}
