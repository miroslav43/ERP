// src/app/(app)/onboarding/erori.ts
// Traducerea codurilor Postgres specifice onboarding-ului — separat de
// traducerea generică din `src/lib/actions/errors.ts`.

import { businessRule, isPostgrestError } from "@/lib/actions/errors";

/**
 * Traduce o eroare Postgres într-un mesaj de business afișabil ca atare.
 *
 * Triggerele din 0014 ridică P0001 cu texte deja scrise pentru utilizatorul
 * final, CU CIFRE și nume proprii în ele:
 *
 *   „Nu se poate finaliza: Popescu Ion are încă un bun nereturnat —
 *    Laptop Dell (INV-0007).”
 *   „Nu se poate finaliza: Popescu Ion are pași obligatorii nebifați —
 *    Lichidare, Predare acces.”
 *
 * Fără propagare, `mapPostgrestError` le-ar înlocui cu „Operațiunea a fost
 * respinsă de o regulă a sistemului” — omul n-ar afla CE bun sau CE pas
 * lipsește. 600 de caractere, nu 300: mesajul poate enumera mai multe
 * obiecte sau pași, iar o trunchiere mai scurtă taie exact informația pentru
 * care există mesajul.
 *
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      // `checklist_templates_denumire_uk` (organization_id, tip, lower(denumire)).
      throw businessRule("Există deja un șablon cu această denumire pentru tipul ales.");
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, 600));
    }
  }
  throw error;
}
