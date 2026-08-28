// src/domain/reges/formate.ts
//
// Regulile de format din §8 ale documentației REGES, într-un singur loc.
//
// DE CE UN MODUL ÎNTREG PENTRU CINCI CONVERSII
// Fiindcă fiecare dintre ele are exact un mod de a fi greșită, iar greșeala nu
// se vede la citire. `4000` scris ca `4.000,00` trece de `JSON.stringify` fără
// o vorbă și e respins abia de server, la două ore după ce operatorul a plecat
// acasă. `toISOString()` pe un `Date` construit din „2026-03-14" dă
// „2026-03-13T22:00:00Z" în ora României — cu o zi mai devreme, adică exact
// diferența dintre „în termen" și „contravenție".
//
// De aceea datele NU trec niciodată printr-un `Date`: se validează ca text și se
// transmit ca text. Singurul `Date` din fișier e pentru marca de timp a
// antetului, care chiar e un moment, nu o zi.

/** Zi calendaristică `AAAA-LL-ZZ`, comparabilă lexicografic. */
export type ZiIso = string;

const TIPAR_ZI = /^\d{4}-\d{2}-\d{2}$/;
const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `AAAA-LL-ZZ`, verificată și ca dată reală (31 februarie nu trece). */
export function esteZi(valoare: unknown): valoare is ZiIso {
  if (typeof valoare !== "string" || !TIPAR_ZI.test(valoare)) return false;
  const [an, luna, zi] = valoare.split("-").map(Number);
  if (luna === undefined || zi === undefined || an === undefined) return false;
  if (luna < 1 || luna > 12 || zi < 1) return false;
  return zi <= new Date(Date.UTC(an, luna, 0)).getUTCDate();
}

/**
 * Ziua, așa cum o cere schema: `AAAA-LL-ZZ`, neatinsă.
 *
 * Funcția pare inutilă până observi ce înlocuiește: `new Date(zi).toISOString()`,
 * care mută ziua cu una înapoi pentru orice fus la est de Greenwich.
 */
export function zi(valoare: ZiIso): string {
  if (!esteZi(valoare)) {
    throw new TypeError(`Zi invalidă pentru REGES: „${String(valoare)}". Se aștepta AAAA-LL-ZZ.`);
  }
  return valoare;
}

/** Marcă de timp ISO-8601 cu fus explicit, pentru `Header.Timestamp`. */
export function momentIso(cand: Date = new Date()): string {
  if (Number.isNaN(cand.getTime())) {
    throw new TypeError("Moment invalid pentru REGES.");
  }
  return cand.toISOString();
}

/**
 * O zi transmisă acolo unde schema cere `dateTime` (`DataIncetare`, `DataInceput`).
 * Miezul zilei UTC, nu miezul nopții: la miezul nopții, orice bibliotecă de fus
 * orar care rotunjește în jos aterizează în ziua precedentă.
 */
export function ziCaMoment(valoare: ZiIso): string {
  return `${zi(valoare)}T12:00:00.000Z`;
}

/** Zecimal cu punct, fără separator de mii. `4000` → `"4000"`, `1234.5` → `"1234.5"`. */
export function zecimal(valoare: number): number {
  if (!Number.isFinite(valoare)) {
    throw new TypeError(`Valoare zecimală invalidă pentru REGES: „${String(valoare)}".`);
  }
  // Rotunjire la doi zecimali: salariile vin din `numeric(14,2)`, dar un calcul
  // intermediar în JavaScript poate produce 4000.0000000000005, iar schema
  // REGES nu spune nicăieri câți zecimali acceptă.
  return Math.round(valoare * 100) / 100;
}

/** UUID canonic 8-4-4-4-12, în litere mici. */
export function uuid(valoare: string): string {
  if (!TIPAR_UUID.test(valoare)) {
    throw new TypeError(`UUID invalid pentru REGES: „${valoare}".`);
  }
  return valoare.toLowerCase();
}

/**
 * Text fără spații la capete. Schema cere explicit asta, iar un nume cu spațiu
 * final e o nepotrivire care nu se vede în niciun ecran.
 * Întoarce `undefined` pentru gol, ca serializarea JSON să omită cheia în loc
 * să trimită `""` — REGES tratează șirul gol ca valoare, nu ca absență.
 */
export function text(valoare: string | null | undefined): string | undefined {
  if (valoare === null || valoare === undefined) return undefined;
  const curat = valoare.trim();
  return curat === "" ? undefined : curat;
}
