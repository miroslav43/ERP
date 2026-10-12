// src/domain/maintenance/praguri.ts
/**
 * Pragurile de alertă ale rezumatului zilnic (0191): cu câte zile înainte de o
 * scadență de mentenanță (plan, autorizație ISCIR, garanție) pleacă alerta.
 * Se scriu în `/mentenanta/setari` ca text („30, 14, 7”) și se păstrează în
 * `maintenance_settings.praguri_alerta_zile`, de unde un trigger le oglindește
 * în `alert_rules`. Funcții pure, fără I/O.
 */

/** Implicitul motorului de alerte (`internal.praguri_implicite()`, 0008). */
export const PRAGURI_ALERTA_IMPLICITE: readonly number[] = [30, 14, 7];

/** Limitele din `maintenance_settings_praguri_ck` (0191). */
export const MAXIM_PRAGURI_ALERTA = 8;
export const PRAG_ALERTA_MAXIM_ZILE = 365;

/**
 * Textul din câmp, tăiat în bucăți: virgulă, punct și virgulă sau spațiu
 * despart pragurile. Bucățile rămân text — validarea (întreg, 1–365) o face
 * schema, ca mesajul de eroare să cadă pe câmp.
 */
export function bucatiPraguri(text: string): string[] {
  return text
    .split(/[\s,;]+/u)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

/** Pragurile fără dubluri, de la cel mai îndepărtat la cel mai apropiat. */
export function normalizeazaPraguri(praguri: readonly number[]): number[] {
  return [...new Set(praguri)].sort((a, b) => b - a);
}

/** Forma afișată în câmp: „30, 14, 7”. */
export function pragurileCaText(praguri: readonly number[]): string {
  return normalizeazaPraguri(praguri).join(", ");
}
