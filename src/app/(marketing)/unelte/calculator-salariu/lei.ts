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
