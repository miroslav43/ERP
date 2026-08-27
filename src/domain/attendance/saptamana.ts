// src/domain/attendance/saptamana.ts
/**
 * Aritmetica săptămânii de pontaj — funcții pure, fără I/O.
 *
 * Au trăit ca funcții private în `(app)/pontaj/saptamana/page.tsx`. Portalul are
 * nevoie de exact aceeași socoteală, iar a doua copie a unui calcul de date e
 * felul în care două ecrane ajung să afișeze săptămâni diferite pentru aceeași
 * zi — fără ca vreunul să pară greșit.
 *
 * Toate lucrează pe ȘIRURI `YYYY-MM-DD`, în UTC, niciodată pe `Date` locale:
 * coloana e `date` în Postgres, iar un `Date` construit în fusul serverului ar
 * aluneca peste granița zilei.
 */

const ZI_ISO = /^\d{4}-\d{2}-\d{2}$/u;

/** Adaugă (sau scade, cu `n` negativ) zile calendaristice. */
export function adaugaZile(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** `true` doar pentru o zi de luni validă. Formatul se verifică odată cu ziua. */
export function esteLuni(data: string): boolean {
  return ZI_ISO.test(data) && new Date(`${data}T00:00:00Z`).getUTCDay() === 1;
}

/**
 * Lunea săptămânii CARE URMEAZĂ, nu lunea săptămânii în curs.
 *
 * Planul se declară în avans, deci ținta implicită e săptămâna viitoare. Duminica
 * (`getUTCDay() === 0`) e capătul săptămânii curente în numerotarea ISO, deci
 * lunea următoare e chiar a doua zi — de aici ramura separată.
 */
export function lunieaUrmatoare(azi: string): string {
  const ziuaSaptamanii = new Date(`${azi}T00:00:00Z`).getUTCDay();
  const zilePanaLuniViitoare = ziuaSaptamanii === 0 ? 1 : 8 - ziuaSaptamanii;
  return adaugaZile(azi, zilePanaLuniViitoare);
}

/** Cele șapte zile ale săptămânii care începe luni la `saptamanaStart`. */
export function zileleSaptamanii(saptamanaStart: string): readonly string[] {
  return Array.from({ length: 7 }, (_, i) => adaugaZile(saptamanaStart, i));
}

// ── Ce se trimite spre aprobare ─────────────────────────────────────────────

/** Sâmbăta și duminica: ultimele două poziții ale săptămânii ISO. */
export const INDICI_WEEKEND: ReadonlySet<number> = new Set([5, 6]);

export interface ZiPlanDeclarata {
  /** `"08:30"`, sau `""` când ziua n-are interval. */
  readonly ora_inceput: string;
  readonly ora_sfarsit: string;
}

export interface IntervalTrimis {
  readonly ora_inceput: string | null;
  readonly ora_sfarsit: string | null;
}

/**
 * Intervalul cu care pleacă spre server ziua de pe poziția `index`.
 *
 * ── DE CE E O FUNCȚIE, NU O CONDIȚIE ÎN FORMULAR ─────────────────────────
 * Regula asta a produs deja un defect livrat: implicitul de 8 ore pe toate
 * cele șapte zile din portal însemna 56 de ore declarate pe săptămână, din
 * care 16 într-un weekend pe care nu-l alesese nimeni. Cine apăsa direct
 * „Trimite spre aprobare" nu vedea nimic ciudat pe ecran.
 *
 * Aici e explicită și verificabilă: ziua de weekend nebifat pleacă FĂRĂ
 * interval — deci serverul îi scrie zero ore — iar rândul rămâne în listă, ca
 * aprobatorul să vadă săptămâna întreagă, nu una din cinci zile.
 *
 * Intervalul incomplet (o singură oră completată) se tratează ca absent:
 * `attendance_week_submission_days_interval_ck` (0081) cere ori amândouă, ori
 * niciuna, iar un refuz al bazei pe un câmp pe jumătate completat e o eroare
 * pe care omul n-o poate lega de ce a făcut.
 */
export function intervalDeTrimis(
  zi: ZiPlanDeclarata,
  index: number,
  lucreazaWeekend: boolean,
): IntervalTrimis {
  const ascunsa = !lucreazaWeekend && INDICI_WEEKEND.has(index);
  const complet = zi.ora_inceput.length > 0 && zi.ora_sfarsit.length > 0;
  if (ascunsa || !complet) return { ora_inceput: null, ora_sfarsit: null };
  return { ora_inceput: zi.ora_inceput, ora_sfarsit: zi.ora_sfarsit };
}
