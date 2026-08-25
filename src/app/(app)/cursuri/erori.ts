// src/app/(app)/cursuri/erori.ts
// Traducerea codurilor Postgres specifice modulului de cursuri — separat de
// traducerea generică din `src/lib/actions/errors.ts`.

import { businessRule, isPostgrestError } from "@/lib/actions/errors";

/**
 * Triggerele din 0075 ridică P0001 cu texte deja scrise pentru utilizatorul
 * final, cu nume şi cifre în ele:
 *
 *   „Cursul «Instructaj SSM» nu are nicio lecție și nu poate fi atribuit.”
 *   „Materialul «Regulament intern» este în curs de parcurgere de 3 persoane.”
 *   „Mai aveți de parcurs din «Prezentarea firmei»: 240 din 480 secunde.”
 *
 * Fără propagare, `mapPostgrestError` le-ar înlocui cu „Operațiunea a fost
 * respinsă de o regulă a sistemului”, iar omul n-ar afla CE îl blochează.
 *
 * `42501` (privilegiu insuficient pe coloană) e tradus explicit: nu e o eroare
 * de business, e semnul că cineva a atins o coloană pe care grantul nu i-o dă —
 * adică bariera de privilegiu din 0075 a funcţionat. Mesajul nu spune care
 * coloană: cine încearcă asta nu are nevoie de indicii.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      throw businessRule(
        "Există deja un curs sau un material cu acest cod. Alegeți altul.",
      );
    }
    if (error.code === "23514") {
      throw businessRule(
        "Combinația de setări nu este permisă. Verificați treapta de dovadă și câmpurile ei.",
      );
    }
    if (error.code === "23503") {
      throw businessRule("Materialul sau cursul la care faceți referire nu mai există.");
    }
    if (error.code === "42501") {
      throw businessRule("Nu aveți dreptul de a modifica acest câmp.");
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, 600));
    }
  }
  throw error;
}
