/**
 * Starea demonstrațiilor, ținută EXCLUSIV în browserul vizitatorului.
 *
 * `sessionStorage`, nu `localStorage`: închiderea filei uită tot, ceea ce e
 * exact promisiunea făcută pe pagina publică. Nimic nu pleacă spre server —
 * nu e o măsură de disciplină, e o proprietate a construcției: modulul ăsta
 * n-are niciun `fetch` și nicio Server Action.
 *
 * Fiecare acces e înfășurat, fiindcă simplul CITIT al lui `sessionStorage`
 * aruncă în ferestrele private și acolo unde utilizatorul a blocat datele de
 * sit. Un demo care rupe pagina de prezentare e mai rău decât unul care uită.
 */

/** Cheia sub care trăiește starea vitrinei de concedii. */
export const CHEIE_CONCEDII = "vitrina.concedii";

export function citesteDepozit<T>(cheie: string, implicit: T): T {
  try {
    const brut = sessionStorage.getItem(cheie);
    if (brut === null) return implicit;
    return JSON.parse(brut) as T;
  } catch {
    return implicit;
  }
}

export function scrieDepozit<T>(cheie: string, valoare: T): void {
  try {
    sessionStorage.setItem(cheie, JSON.stringify(valoare));
  } catch {
    // Fereastră privată, cotă depășită, date de sit blocate. Demo-ul merge mai
    // departe din memorie; pierde doar supraviețuirea peste o reîncărcare.
  }
}
