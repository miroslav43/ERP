/**
 * O sumă în lei, în convenția românească: „4.325 lei”, „803,60 lei”.
 *
 * Fără zecimale când suma e întreagă (impozitul și contribuțiile sunt
 * rotunjite la leu, OUG 59/2005), cu exact două când nu e (un tichet de
 * 40,18 lei). Varianta veche, cu `maximumFractionDigits: 2`, scria „7.500,5 lei”.
 */
export function lei(n: number): string {
  const zecimale = Number.isInteger(n) ? 0 : 2;
  const text = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: zecimale,
    maximumFractionDigits: zecimale,
  }).format(n);
  return `${text} lei`;
}

/**
 * Un număr întreg urmat de „lei”, cu „de” acolo unde româna îl cere: de la 20
 * în sus în fiecare sută și la sutele fixe („20 de lei”, „100 de lei”), nu și
 * la 1–19 sau 101–119 („19 lei”, „101 lei”). Un singur leu e „1 leu”.
 */
export function deLei(n: number): string {
  if (n === 1) return "1 leu";
  const rest = n % 100;
  const cuDe = rest >= 20 || (rest === 0 && n !== 0);
  return `${String(n)} ${cuDe ? "de lei" : "lei"}`;
}
