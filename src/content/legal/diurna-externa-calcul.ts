// src/content/legal/diurna-externa-calcul.ts

/**
 * Calculul diurnei externe pentru o deplasare, după regulile din ghid.
 *
 * - Timpul se numără de la trecerea frontierei la plecare până la trecerea ei la
 *   întoarcere (pentru avion: decolarea și aterizarea) — art. 7^1 alin. (1)
 *   HG 518/1995.
 * - Fiecare 24 de ore întregi primesc diurna întreagă; restul de până la 12 ore
 *   inclusiv primește 50%, peste 12 ore 100% — art. 7^1 alin. (2).
 * - Plafonul neimpozabil e de 2,5 ori diurna legală a deplasării — art. 76 alin.
 *   (2) lit. k) pct. (ii) Codul fiscal. Al doilea plafon, de 3 salarii de bază pe
 *   lună, depinde de salariul omului și nu se calculează aici.
 *
 * Sumele se țin în cenți întregi, ca în `plafonNeimpozabil`: în virgulă mobilă,
 * 33,33 × 2,5 dă 83,32 în loc de 83,33.
 */

export type RezultatDiurnaExterna = Readonly<{
  ore: number;
  zileIntregi: number;
  /** 0, 0,5 sau 1 — fracțiunea de după ultima zi întreagă. */
  fractiune: 0 | 0.5 | 1;
  zile: number;
  diurnaLegala: number;
  plafonNeimpozabil: number;
  /** Doar dacă s-a dat suma plătită de firmă pe zi. */
  platit: number | null;
  /** Partea plătită peste plafon: venit din salarii, cu impozit și contribuții. */
  impozabil: number | null;
}>;

const centi = (suma: number) => Math.round(suma * 100);

export function calculeazaDiurnaExterna({
  cuantum,
  plecare,
  intoarcere,
  platitPeZi = null,
}: {
  cuantum: number;
  plecare: Date;
  intoarcere: Date;
  platitPeZi?: number | null;
}): RezultatDiurnaExterna | null {
  const ore = (intoarcere.getTime() - plecare.getTime()) / 3_600_000;
  if (!Number.isFinite(ore) || ore <= 0) return null;

  const zileIntregi = Math.floor(ore / 24);
  const rest = ore - zileIntregi * 24;
  const fractiune: 0 | 0.5 | 1 = rest === 0 ? 0 : rest <= 12 ? 0.5 : 1;
  const zile = zileIntregi + fractiune;

  const legalaCenti = Math.round(centi(cuantum) * zile);
  const plafonCenti = Math.round((legalaCenti * 5) / 2);
  const platitCenti = platitPeZi === null ? null : Math.round(centi(platitPeZi) * zile);

  return {
    ore,
    zileIntregi,
    fractiune,
    zile,
    diurnaLegala: legalaCenti / 100,
    plafonNeimpozabil: plafonCenti / 100,
    platit: platitCenti === null ? null : platitCenti / 100,
    impozabil: platitCenti === null ? null : Math.max(0, platitCenti - plafonCenti) / 100,
  };
}
