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

/**
 * `esteValid`, opțional: garda de FORMĂ, nu doar de sintaxă JSON.
 *
 * `JSON.parse` reușește pe orice JSON valid — un obiect în locul tabloului
 * așteptat trece la fel de bine ca tabloul însuși. Primul consumator real
 * (`vitrina-leave.tsx`) iterează rezultatul cu `for...of`; fără gardă de
 * formă, o valoare stocată sub aceeași cheie dar cu altă schemă — o sesiune
 * veche rămasă dintr-o versiune anterioară a demonstrației, sau o manipulare
 * din devtools — ar arunca `TypeError` direct în randare și ar CĂDEA TOT
 * ECRANUL PUBLIC, fără recuperare. Cu garda, forma greșită se tratează la fel
 * ca JSON-ul stricat: se întoarce implicitul.
 */
export function citesteDepozit<T>(
  cheie: string,
  implicit: T,
  esteValid?: (x: unknown) => x is T,
): T {
  try {
    const brut = sessionStorage.getItem(cheie);
    if (brut === null) return implicit;
    const parsat: unknown = JSON.parse(brut);
    if (esteValid !== undefined && !esteValid(parsat)) return implicit;
    return parsat as T;
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
