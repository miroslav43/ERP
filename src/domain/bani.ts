// src/domain/bani.ts
//
// Banii ca ÎNTREGI, plus regula unică de rotunjire a aplicației.
//
// Nu stă sub `domain/payroll/` deliberat: `formatLei` din `lib/format/money.ts`
// e folosit și de inventar, și de flotă, și de mentenanță. A lega formatarea
// sumelor de modulul de salarizare ar fi o dependență în direcția greșită.
//
// DE CE ÎNTREGI. Salariul se calculează în ~40 de pași. Cu virgulă mobilă,
// fiecare pas adaugă o eroare minusculă, iar la final suma coloanelor per
// angajat nu mai închide cu totalul perioadei — exact lucrul pe care un
// contabil îl verifică primul. Un întreg în bani nu are eroare de
// reprezentare: 5000,00 lei sunt exact 500000 de bani.
//
// DE CE ROTUNJIRE ARITMETICĂ, NU „half to even". `Intl.NumberFormat` și
// `Math.round` tratează diferit cazurile la jumătate, iar 2,675 e în virgulă
// mobilă 2,67499999... Contabilul așteaptă 2,68. Nudge-ul relativ de mai jos
// recuperează eroarea de reprezentare înainte de rotunjire.
//
// ISTORIC: până la acest modul existau DOUĂ formule diferite —
// `lib/format/money.ts` (epsilon relativ) și `domain/payroll/calc.ts` (epsilon
// absolut). Pe 2,675 dădeau 2,68 și 2,67. Adică o sumă putea fi AFIȘATĂ altfel
// decât fusese CALCULATĂ. Ambele trec acum prin `rotunjesteLaBani`.

declare const marcajBani: unique symbol;

/** O sumă în bani (subunitatea leului), ca întreg. 1 leu = 100 de bani. */
export type Bani = number & { readonly [marcajBani]: true };

export const ZERO_BANI = 0 as Bani;

/**
 * Rotunjire aritmetică, cu recuperarea erorii de reprezentare.
 *
 * `Math.round` duce jumătățile spre plus infinit, deci `-0,5` ar deveni `-0`.
 * Pentru bani, simetria contează: o reținere de −2,675 trebuie să dea −2,68,
 * la fel ca +2,675 → +2,68.
 */
function rotundSimetric(valoare: number): number {
  if (!Number.isFinite(valoare)) {
    throw new RangeError("O sumă trebuie să fie un număr finit.");
  }
  const corectat = valoare + Math.sign(valoare) * Number.EPSILON * Math.abs(valoare);
  return corectat < 0 ? -Math.round(-corectat) : Math.round(corectat);
}

/** Lei (virgulă mobilă) → lei rotunjiți la ban. Regula unică de afișare. */
export function rotunjesteLaBani(lei: number): number {
  return rotundSimetric(lei * 100) / 100;
}

/** Lei → bani. Singurul loc unde virgula mobilă intră în sistem. */
export function dinLei(lei: number): Bani {
  return rotundSimetric(lei * 100) as Bani;
}

/** Bani → lei, pentru afișare și pentru scrierea în `numeric(14,2)`. */
export function inLei(suma: Bani): number {
  return suma / 100;
}

/** Un întreg deja exprimat în bani (ex. citit dintr-un întreg din bază). */
export function bani(intreg: number): Bani {
  if (!Number.isSafeInteger(intreg)) {
    throw new RangeError(`Suma în bani trebuie să fie un întreg: ${String(intreg)}.`);
  }
  return intreg as Bani;
}

export function aduna(...sume: readonly Bani[]): Bani {
  return sume.reduce<number>((total, s) => total + s, 0) as Bani;
}

export function scade(a: Bani, b: Bani): Bani {
  return (a - b) as Bani;
}

/** Înmulțire cu un factor fracționar (ore, zile, cantități). Rotunjește la ban. */
export function inmulteste(suma: Bani, factor: number): Bani {
  return rotundSimetric(suma * factor) as Bani;
}

/**
 * Aplică o cotă exprimată ca FRACȚIE (0,25 pentru 25%), nu ca procent.
 * Confuzia dintre cele două e capcana cea mai scumpă din tot modulul, de aceea
 * numele spune explicit ce așteaptă.
 */
export function fractieDin(suma: Bani, fractie: number): Bani {
  return rotundSimetric(suma * fractie) as Bani;
}

/** Împărțire la un divizor (zile lucrătoare, ore de normă). Rotunjește la ban. */
export function imparte(suma: Bani, divizor: number): Bani {
  if (divizor === 0) {
    throw new RangeError("Împărțire la zero într-un calcul de sume.");
  }
  return rotundSimetric(suma / divizor) as Bani;
}

export function maxim(a: Bani, b: Bani): Bani {
  return (a > b ? a : b) as Bani;
}

export function minim(a: Bani, b: Bani): Bani {
  return (a < b ? a : b) as Bani;
}

/** Taie valorile negative la zero — plafoane care nu pot coborî sub 0. */
export function celPutinZero(suma: Bani): Bani {
  return (suma < 0 ? 0 : suma) as Bani;
}

/**
 * Rotunjire la leu întreg. Unele organizații o cer pe fluturaș; contribuțiile
 * declarate în D112 se raportează oricum în lei întregi.
 */
export function laLeuIntreg(suma: Bani): Bani {
  return (rotundSimetric(suma / 100) * 100) as Bani;
}
