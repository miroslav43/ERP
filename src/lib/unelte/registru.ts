import { cerereDinParametri } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-document";
import { condicaDinParametri } from "@/app/(marketing)/unelte/condica-de-prezenta/model";

import type { DocumentTabelar } from "./document-tabelar";

export type Constructor = (q: URLSearchParams) => DocumentTabelar;

/**
 * Uneltele servite de `/api/unelte/[unealta]`. Foaia de pontaj NU e aici: are
 * ruta ei statică, cu Excel pe formule, iar ruta statică are prioritate.
 */
export const UNELTE: Readonly<Record<string, Constructor>> = {
  "cerere-concediu": cerereDinParametri,
  "condica-de-prezenta": condicaDinParametri,
};

/**
 * `Object.hasOwn`, nu `UNELTE[slug]`: indexarea directă întoarce
 * `Object.prototype.constructor` pentru `/api/unelte/constructor`, adică o
 * funcție care, chemată cu parametrii, dă 500 în loc de 404.
 */
export function constructorPentru(slug: string): Constructor | undefined {
  return Object.hasOwn(UNELTE, slug) ? UNELTE[slug] : undefined;
}
