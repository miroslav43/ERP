import { fisaSsmDinParametri } from "@/app/(marketing)/unelte/fisa-instruire-ssm/model";

import { FORMATE, type DocumentTabelar, type Format } from "./document-tabelar";

export type Constructor = (q: URLSearchParams) => DocumentTabelar;

/**
 * Uneltele servite de `/api/unelte/[unealta]`. Cinci NU sunt aici, fiindcă au
 * rută statică, iar ruta statică are prioritate față de segmentul dinamic:
 * foaia de pontaj, condica și foaia de parcurs (Excel pe formule), cererea
 * de concediu (o scrisoare, nu un formular tabelar —
 * `src/app/api/unelte/cerere-concediu/route.ts`) și fișa de evaluare (Excel
 * pe formule, `src/app/api/unelte/fisa-evaluare/route.ts`).
 */
export const UNELTE: Readonly<Record<string, Constructor>> = {
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

/**
 * Formatele unei unelte, când nu sunt toate trei. Fișa SSM n-are Excel: are
 * secțiuni (casete de viză, șapte tabele), pe care `randeazaXlsx` nu le poate
 * așeza, iar pagina și lista uneltelor promit doar Word și PDF.
 */
const FORMATE_RESTRANSE: Readonly<Record<string, readonly Format[]>> = {
  "fisa-instruire-ssm": ["pdf", "docx"],
};

export function formatePentru(slug: string): readonly Format[] {
  return Object.hasOwn(FORMATE_RESTRANSE, slug) ? (FORMATE_RESTRANSE[slug] ?? FORMATE) : FORMATE;
}
