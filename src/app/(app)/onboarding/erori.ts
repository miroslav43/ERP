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
      /*
       * Modulul are TREI indexuri unice, nu unul. Mesajul se alege după
       * `constraint`, nu se presupune: până acum, orice coliziune — inclusiv
       * una pe poziția unui pas sau pe ciclul unei instanțe — îi spunea omului
       * că denumirea șablonului e luată, ceea ce e fals și trimite în direcția
       * greșită.
       *
       * `constraint` poate lipsi din răspunsul PostgREST; atunci rămâne un
       * mesaj onest, care nu inventează o cauză.
       */
      const constrangere = error.details ?? error.message;
      if (constrangere.includes("checklist_templates_denumire_uk")) {
        throw businessRule("Există deja un șablon cu această denumire pentru tipul ales.");
      }
      if (constrangere.includes("checklist_instances_ciclu_uk")) {
        throw businessRule(
          "Angajatul are deja un parcurs pornit pe acest șablon, în același ciclu.",
        );
      }
      if (constrangere.includes("ordine_uk")) {
        throw businessRule(
          "Două elemente au ajuns pe aceeași poziție. Reîncărcați pagina și salvați din nou.",
        );
      }
      throw businessRule("Există deja un rând cu aceleași date.");
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, 600));
    }
  }
  throw error;
}
