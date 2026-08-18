// src/app/(app)/pontaj/erori.ts
// Traducerea codurilor Postgres specifice pontajului — separat de traducerea
// generică din `src/lib/actions/errors.ts`, ca fiecare modul să-și scrie
// mesajele fără să atingă un fișier comun.

import { businessRule, isPostgrestError } from "@/lib/actions/errors";

const LUNGIME_MAXIMA_MESAJ = 300;

/**
 * Traduce o eroare Postgres într-un mesaj de business afișabil ca atare.
 *
 * Cazul care contează cel mai mult e P0001. Triggerele din 0013_attendance.sql
 * ridică mesaje deja scrise pentru utilizatorul final, cu CIFRELE în ele:
 *
 *   „Perioada de pontaj 08.2026 este blocată și nu mai poate fi modificată.
 *    Deblocheaz-o dacă ai nevoie de corecții."
 *
 * Fără propagare, `mapPostgrestError` le-ar înlocui cu „Operațiunea a fost
 * respinsă de o regulă a sistemului" — iar omul n-ar afla CE lună e blocată.
 * De aceea mesajul se propagă, nu se rescrie: cifrele din el se pot afla doar
 * din bază. `error.details`/`error.hint` NU se propagă niciodată.
 *
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`, deci TypeScript
 * îngustează corect tipul lui `data` imediat după.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      // `attendance_entries_zi_uq` — o zi rămasă după pre-verificarea din
      // handler (altă filă a browserului, altă sesiune).
      throw businessRule(
        "Există deja o zi de pontaj înregistrată pentru acest angajat la data aleasă.",
      );
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, LUNGIME_MAXIMA_MESAJ));
    }
  }
  throw error;
}
