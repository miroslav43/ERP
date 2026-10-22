// src/domain/payroll/program-saptamanal.ts
//
// Câte zile pe săptămână are programul unui contract. Funcție PURĂ, folosită de
// motorul de salarizare (`calc.ts`) și de formularul de contract, ca HR-ul să
// vadă la scriere exact ce va citi calculul.
//
// Contractul NU are un câmp pentru zile: ele se deduc din cele două norme,
// săptămâna împărțită la zi. Până la regula de coerență din 573b2d31 (12 oct
// 2026) și pe importul care scria doar norma săptămânală, „8 h/zi, 20 h/săpt.”
// putea fi un timp parțial de 4 h în cinci zile cu norma zilnică uitată la 8,
// dar arată identic cu un program real de 2,5 zile. De aceea programul sub
// cinci zile se spune pe față, pe fiecare fluturaș (`SAL_PROGRAM_SUB_CINCI_ZILE`).

import { textZile } from "@/lib/format/numar";

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
