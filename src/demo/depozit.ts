/**
 * Starea demonstrațiilor, ținută EXCLUSIV în browserul vizitatorului.
 *
 * `sessionStorage`, nu `localStorage`: închiderea filei uită tot, ceea ce e
 * exact promisiunea făcută pe pagina publică. Nimic nu pleacă spre server —
 * nu e o măsură de disciplină, e o proprietate a construcției: modulul ăsta
 * n-are niciun `fetch` și nicio Server Action.
 *
 * Helper-ul de acces (`citesteDepozit`/`scrieDepozit`, cu garda de formă
 * obligatorie și fiecare acces în `try/catch`) a stat aici până pe 12 oct 2026;
 * s-a mutat în `src/lib/ui/depozit-sesiune.ts` când l-a cerut și asistentul
 * `/bun-venit` (QA ONB-012). Re-exportul păstrează vechii apelanți neschimbați;
 * regula `administrativo/demo-fara-server` permite `@/lib/ui/*`.
 */

export { citesteDepozit, scrieDepozit } from "@/lib/ui/depozit-sesiune";

/** Cheia sub care trăiește starea vitrinei de concedii. */
export const CHEIE_CONCEDII = "vitrina.concedii";
