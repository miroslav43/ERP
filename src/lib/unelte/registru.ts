import { fisaSsmDinParametri } from "@/app/(marketing)/unelte/fisa-instruire-ssm/model";
import { fisaEvaluareDinParametri } from "@/app/(marketing)/unelte/fisa-evaluare/model";

import type { DocumentTabelar } from "./document-tabelar";

export type Constructor = (q: URLSearchParams) => DocumentTabelar;

/**
 * Uneltele servite de `/api/unelte/[unealta]`. Patru NU sunt aici, fiindcă au
 * rută statică, iar ruta statică are prioritate față de segmentul dinamic:
 * foaia de pontaj, condica și foaia de parcurs (Excel pe formule) și cererea
 * de concediu (o scrisoare, nu un formular tabelar —
 * `src/app/api/unelte/cerere-concediu/route.ts`).
 */
export const UNELTE: Readonly<Record<string, Constructor>> = {
  "fisa-evaluare": fisaEvaluareDinParametri,
  "fisa-instruire-ssm": fisaSsmDinParametri,
};

/**
 * `Object.hasOwn`, nu `UNELTE[slug]`: indexarea directă întoarce
 * `Object.prototype.constructor` pentru `/api/unelte/constructor`, adică o
 * funcție care, chemată cu parametrii, dă 500 în loc de 404.
 */
export function constructorPentru(slug: string): Constructor | undefined {
  return Object.hasOwn(UNELTE, slug) ? UNELTE[slug] : undefined;
}
