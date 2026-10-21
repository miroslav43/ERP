// src/domain/fleet/carduri/card.ts
//
// Numărul cardului de combustibil NU se păstrează întreg (F12b, Decizia 2):
// doar ultimele 4–6 cifre (afișate „•••• 1234”) și, opțional, o amprentă HMAC
// a numărului întreg, calculată pe server (`amprentaSensibila`). Funcțiile de
// aici sunt pure: scot cifrele, mascheză, compară pe sufix.

/** De la câte cifre un șir e un număr întreg de card (PAN-urile au 16–19). */
export const CIFRE_NUMAR_INTREG = 12;
/** Câte cifre finale intră în cheia de dedup și se compară cu cardul. */
export const CIFRE_FINALE_MAXIM = 6;
export const CIFRE_FINALE_MINIM = 4;

export type CifreCard = Readonly<{
  /** Ultimele cifre, cel mult 6, așa cum le are extrasul. */
  finale: string;
  /** Numărul întreg, DOAR în memorie, pentru amprentă. `null` dacă extrasul e mascat. */
  intreg: string | null;
}>;

/**
 * Șirul final de cifre al unui număr de card, cu spațiile și cratimele scoase:
 *   „7002 5100 0000 1234” → 16 cifre, întreg;
 *   „**** **** **** 1234” → „1234”, mascat;
 *   sub 4 cifre finale → `null`.
 */
export function cifreFinaleCard(text: string): CifreCard | null {
  const compact = text.replace(/[\s  -]+/gu, "");
  const m = /(\d+)$/u.exec(compact);
  const cifre = m?.[1];
  if (cifre === undefined || cifre.length < CIFRE_FINALE_MINIM) return null;
  return {
    finale: cifre.slice(-CIFRE_FINALE_MAXIM),
    intreg: cifre.length >= CIFRE_NUMAR_INTREG && cifre.length <= 19 ? cifre : null,
  };
}

/** Cifrele care se salvează pe card: ultimele 4 dintr-un număr întreg, toate dacă sunt 4–6. */
export function cifreDeSalvat(cifre: CifreCard): string {
  return cifre.intreg !== null ? cifre.intreg.slice(-CIFRE_FINALE_MINIM) : cifre.finale;
}

/** „•••• 1234”. */
export function mascheaza(cifre: string): string {
  return `•••• ${cifre}`;
}

/**
 * Orice secvență de cel puțin 12 cifre (cu spații sau cratime între ele) devine
 * „•••• 1234”. Se aplică pe TOT ce pleacă spre client din analiza extrasului
 * (eșantionul brut al pasului de mapare): sursa are numere întregi de card.
 */
export function mascheazaSecvente(text: string): string {
  return text.replace(/\d(?:[\s  -]?\d){11,}/gu, (secventa) => {
    const cifre = secventa.replace(/\D/gu, "");
    return mascheaza(cifre.slice(-CIFRE_FINALE_MINIM));
  });
}

/**
 * Cardul cu 4 cifre salvate și extrasul cu 6 (sau invers) se potrivesc când
 * șirul mai scurt, de cel puțin 4 cifre, e SUFIXUL celui mai lung.
 */
export function cifreSePotrivesc(a: string, b: string): boolean {
  const [scurt, lung] = a.length <= b.length ? [a, b] : [b, a];
  return scurt.length >= CIFRE_FINALE_MINIM && lung.endsWith(scurt);
}

/** Ultima zi a lunii, `AAAA-LL-ZZ`: valabilitatea de pe card e „LL/AA”. */
export function ultimaZiALunii(an: number, luna: number): string {
  const zi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  return `${String(an)}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
}

/** „09/2027” pentru o valabilitate `2027-09-30`; `null` rămâne „—” la afișare. */
export function valabilitateScurta(valabilPana: string | null): string | null {
  if (valabilPana === null) return null;
  const m = /^(\d{4})-(\d{2})-\d{2}$/u.exec(valabilPana);
  return m === null ? null : `${m[2] ?? ""}/${m[1] ?? ""}`;
}
