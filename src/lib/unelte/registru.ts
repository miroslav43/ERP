import { cerereDinParametri } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-document";
import { foaieParcursDinParametri } from "@/app/(marketing)/unelte/foaie-de-parcurs/model";
import { fisaSsmDinParametri } from "@/app/(marketing)/unelte/fisa-instruire-ssm/model";
import { fisaEvaluareDinParametri } from "@/app/(marketing)/unelte/fisa-evaluare/model";

import type { DocumentTabelar } from "./document-tabelar";

export type Constructor = (q: URLSearchParams) => DocumentTabelar;

/**
 * Uneltele servite de `/api/unelte/[unealta]`. Foaia de pontaj și condica NU
 * sunt aici: au rute statice, cu Excel pe formule, iar ruta statică are
 * prioritate față de segmentul dinamic.
 */
export const UNELTE: Readonly<Record<string, Constructor>> = {
  "fisa-evaluare": fisaEvaluareDinParametri,
  "fisa-instruire-ssm": fisaSsmDinParametri,
  "foaie-de-parcurs": foaieParcursDinParametri,
  "cerere-concediu": cerereDinParametri,
};

/**
 * `Object.hasOwn`, nu `UNELTE[slug]`: indexarea directă întoarce
 * `Object.prototype.constructor` pentru `/api/unelte/constructor`, adică o
 * funcție care, chemată cu parametrii, dă 500 în loc de 404.
 */
export function constructorPentru(slug: string): Constructor | undefined {
  return Object.hasOwn(UNELTE, slug) ? UNELTE[slug] : undefined;
}
