// src/domain/fleet/consum.ts

/**
 * Consumul unei foi de parcurs. Funcții pure, fără I/O: apelantul aduce litrii
 * deja adunați și kilometrii deja calculați de bază.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Calculul `(litri / km) * 100` trăia într-un singur loc — pagina de detaliu a
 * foii — iar coada de aprobare, unde se SEMNEAZĂ documentul fiscal, nu-l avea
 * deloc. A doua copie a formulei, scrisă în JSX pe alt ecran, e felul în care
 * două ecrane ajung să arate două cifre pentru aceeași cursă. Aici e una
 * singură, testată.
 */

/**
 * Litri la 100 km, sau `null` când cifra n-ar avea înțeles.
 *
 * `null` NU e „zero”: o cursă deschisă (`kmParcursi === null`) și o cursă fără
 * nicio alimentare sunt stări reale, nu consumuri de 0 l/100 km. Împărțirea la
 * zero ar fi dat `Infinity` pe ecran — o cifră pe care nimeni n-o poate semna.
 */
export function consumLa100Km(litri: number, kmParcursi: number | null): number | null {
  if (kmParcursi === null || kmParcursi <= 0) return null;
  if (litri <= 0) return null;
  return (litri / kmParcursi) * 100;
}

/**
 * Peste ce abatere față de consumul declarat cifra se evidențiază pe ecran.
 *
 * 15% și nu 5%: consumul real al aceleiași mașini variază sezonier și cu
 * traseul (oraș vs. drum deschis) cu până la ~10% fără nicio anomalie. Un prag
 * prea strâns ar fi aprins fiecare foaie de iarnă, iar un ecran în care totul e
 * marcat nu marchează nimic.
 */
export const PRAG_ABATERE_CONSUM_PROCENTE = 15;

/**
 * Abaterea procentuală a consumului real față de cel declarat pe vehicul.
 * Pozitivă = s-a consumat mai mult decât se declară. `null` când lipsește un
 * termen de comparație — fără el, cifra nu are verdict.
 */
export function abatereConsum(
  consumReal: number | null,
  consumDeclarat: number | null,
): number | null {
  if (consumReal === null) return null;
  if (consumDeclarat === null || consumDeclarat <= 0) return null;
  return ((consumReal - consumDeclarat) / consumDeclarat) * 100;
}

/** Abaterea depășește pragul de la care merită evidențiată? */
export function abatereNotabila(abatere: number | null): boolean {
  return abatere !== null && Math.abs(abatere) >= PRAG_ABATERE_CONSUM_PROCENTE;
}
