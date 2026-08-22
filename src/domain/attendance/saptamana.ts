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
