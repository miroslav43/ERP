// src/lib/ui/depozit-sesiune.ts
/**
 * Acces apărat la `sessionStorage`, pentru orice stare care trebuie să
 * supraviețuiască unei reîncărcări, dar nu și închiderii filei.
 *
 * Mutat aici din `src/demo/depozit.ts` (12 oct 2026, QA ONB-012): primul
 * consumator a fost vitrina publică de concedii, al doilea e ciorna asistentului
 * `/bun-venit`. Stratul demo îl re-exportă, deci vechii apelanți nu se schimbă.
 *
 * Fără `"use client"`: sunt funcții pure peste un global. Cine le cheamă
 * trebuie să fie oricum în browser — pe server `sessionStorage` nu există, iar
 * `try/catch` întoarce implicitul și acolo, în loc să arunce.
 *
 * Fiecare acces e înfășurat, fiindcă simplul CITIT al lui `sessionStorage`
 * aruncă în ferestrele private și acolo unde utilizatorul a blocat datele de
 * sit. O ciornă care rupe ecranul e mai rea decât una care uită.
 */

/**
 * `esteValid`, OBLIGATORIU: garda de FORMĂ, nu doar de sintaxă JSON.
 *
 * `JSON.parse` reușește pe orice JSON valid — un obiect în locul tabloului
 * așteptat trece la fel de bine ca tabloul însuși. Primul consumator real
 * (`vitrina-leave.tsx`) iterează rezultatul cu `for...of`; fără gardă de
 * formă, o valoare stocată sub aceeași cheie dar cu altă schemă — o sesiune
 * veche rămasă dintr-o versiune anterioară, sau o manipulare din devtools — ar
 * arunca `TypeError` direct în randare și ar CĂDEA TOT ECRANUL, fără
 * recuperare. Cu garda, forma greșită se tratează la fel ca JSON-ul stricat:
 * se întoarce implicitul.
 *
 * ── DE CE NU E OPȚIONAL ───────────────────────────────────────────────────
 * A fost, la început. Un parametru opțional lasă defectul reparat să se
 * întoarcă la primul apelant care îl uită — și îl uită tăcut, fiindcă `tsc` n-are
 * ce să-i reproșeze. Obligatoriu, întrebarea „ce formă aștept?" se pune la
 * fiecare apel. Cine chiar nu vrea nicio verificare o spune explicit, cu un
 * predicat care întoarce `true`, și se vede la review.
 */
export function citesteDepozit<T>(
  cheie: string,
  implicit: T,
  esteValid: (x: unknown) => x is T,
): T {
  try {
    const brut = sessionStorage.getItem(cheie);
    if (brut === null) return implicit;
    const parsat: unknown = JSON.parse(brut);
    if (!esteValid(parsat)) return implicit;
    return parsat as T;
  } catch {
    return implicit;
  }
}

export function scrieDepozit<T>(cheie: string, valoare: T): void {
  try {
    sessionStorage.setItem(cheie, JSON.stringify(valoare));
  } catch {
    // Fereastră privată, cotă depășită, date de sit blocate. Ecranul merge mai
    // departe din memorie; pierde doar supraviețuirea peste o reîncărcare.
  }
}

export function stergeDepozit(cheie: string): void {
  try {
    sessionStorage.removeItem(cheie);
  } catch {
    // Același motiv ca la scriere: dacă depozitul nu e accesibil, n-are nici
    // ce să conțină.
  }
}
