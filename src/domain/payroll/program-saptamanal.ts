// src/domain/payroll/program-saptamanal.ts
//
// Câte zile pe săptămână are programul unui contract. Funcție PURĂ, folosită de
// motorul de salarizare (`calc.ts`) și de formularul de contract, ca HR-ul să
// vadă la scriere exact ce va citi calculul.
//
// Contractul NU are un câmp pentru zile: ele se deduc din cele două norme,
// săptămâna împărțită la zi. „8 h/zi, 20 h/săpt.” poate fi un timp parțial de
// 4 h în cinci zile cu norma zilnică uitată la 8, dar arată identic cu un
// program real de 2,5 zile. Schema îl primește și azi: din 573b2d31 (12 oct
// 2026) regula e doar „zi ≤ săptămână” — „zi × 5 ≤ săptămână” (8baf375e, cu
// câteva ore înainte) refuza și programele legale de 2–3 zile —, iar asistentul
// de angajare pornește de la 40/8, deci e de ajuns să se schimbe doar
// săptămâna. Importul scria doar norma săptămânală (baza punea 8 h/zi) până la
// `normaZilnicaPeCinciZile`. De aceea zilele deduse se arată sub cele două
// norme, la scriere, și se spun pe fiecare fluturaș (`SAL_PROGRAM_SUB_CINCI_ZILE`).

import { formatNumar, textZile } from "@/lib/format/numar";

/** Programul obișnuit (Codul muncii art. 112): cinci zile pe săptămână. */
export const ZILE_SAPTAMANA_STANDARD = 5;

/** Toleranța de virgulă mobilă: 21,7 / 4,34 nu are voie să iasă „sub cinci”. */
const TOLERANTA = 1e-9;

/**
 * Norma săptămânală / norma zilnică. `null` când nu se poate deduce: normă
 * săptămânală lipsă (apelanții vechi) sau valori nefinite ori nepozitive.
 */
export function zilePeSaptamana(
  normaOreZi: number | null | undefined,
  normaOreSaptamana: number | null | undefined,
): number | null {
  if (normaOreZi === null || normaOreZi === undefined) return null;
  if (normaOreSaptamana === null || normaOreSaptamana === undefined) return null;
  if (!Number.isFinite(normaOreZi) || !Number.isFinite(normaOreSaptamana)) return null;
  if (normaOreZi <= 0 || normaOreSaptamana <= 0) return null;
  return normaOreSaptamana / normaOreZi;
}

/** Programul are mai puțin de cinci zile pe săptămână. `null` (nedeductibil) nu e. */
export function programSubCinciZile(zile: number | null): boolean {
  return zile !== null && zile < ZILE_SAPTAMANA_STANDARD - TOLERANTA;
}

/** „5 zile pe săptămână”, „2,5 zile pe săptămână”, „1 zi pe săptămână”. */
export function textZilePeSaptamana(zile: number): string {
  return `${textZile(zile)} pe săptămână`;
}

/**
 * Norma contractului cum o arată fișa angajatului — ecranul la care duce
 * atenționarea de pe fluturaș: „20 ore/săptămână, 8 ore/zi — 2,5 zile pe
 * săptămână”. Zilele lipsesc când nu se pot deduce.
 */
export function textNormaContract(normaOreZi: number, normaOreSaptamana: number): string {
  const norme = `${formatNumar(normaOreSaptamana)} ore/săptămână, ${formatNumar(normaOreZi)} ore/zi`;
  const zile = zilePeSaptamana(normaOreZi, normaOreSaptamana);
  return zile === null ? norme : `${norme} — ${textZilePeSaptamana(zile)}`;
}

/** Codul muncii art. 112: cel mult 8 ore pe zi (plafonul din `corpContractSchema`). */
const NORMA_ZILNICA_MAXIMA = 8;

/**
 * Norma zilnică a unui program de cinci zile, pentru o normă săptămânală dată
 * singură (importul are doar coloana „Normă (ore/săptămână)”). Fără ea, baza
 * punea implicitul de 8 h/zi, iar 8/20 devenea pentru salarizare un program de
 * 2,5 zile. Rotunjită la sutime în JOS, ca programul să nu iasă „sub cinci” din
 * rotunjire (21,73 → 4,34, nu 4,35), și plafonată la 8 h (48 h ⇒ șase zile).
 */
export function normaZilnicaPeCinciZile(normaOreSaptamana: number): number {
  const sutimi = Math.floor((normaOreSaptamana * 100) / ZILE_SAPTAMANA_STANDARD + 1e-9);
  return Math.min(NORMA_ZILNICA_MAXIMA, Math.max(1, sutimi) / 100);
}
