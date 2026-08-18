// src/app/(app)/ssm/erori.ts
// Traducerea codurilor Postgres specifice modulului SSM — separat de traducerea
// generică din `src/lib/actions/errors.ts`, ca fiecare modul să-și scrie
// mesajele fără să atingă un fișier comun. Copie a tiparului din
// `flota/erori.ts` și `concedii/erori.ts`.

import { businessRule, isPostgrestError } from "@/lib/actions/errors";

/**
 * Traduce o eroare Postgres într-un mesaj de business afișabil ca atare.
 *
 * P0001 e cazul care contează: triggerele din 0011 ridică mesaje deja scrise
 * pentru utilizator final, CU CIFRE în ele („Data instruirii nu poate fi în
 * viitor.", „Comunicarea către ITM nu poate fi anterioară producerii
 * accidentului.", mesajul de derogare ISCIR cu pragul de 20 de caractere).
 * Fără propagare, `mapPostgrestError` le-ar înlocui cu „Operațiunea a fost
 * respinsă de o regulă a sistemului" — iar responsabilul SSM n-ar afla CE
 * anume să corecteze. De aceea mesajul se propagă, nu se rescrie.
 *
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`, deci TypeScript
 * îngustează corect tipul lui `data` imediat după `if (error !== null) traduEroare(error);`.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      if (error.message.includes("fire_extinguishers_uq")) {
        throw businessRule("Există deja un stingător cu acest cod în organizație.");
      }
      if (error.message.includes("personnel_authorizations_uq")) {
        throw businessRule(
          "Există deja o autorizație de acest tip și cu acest număr pentru angajatul ales.",
        );
      }
      if (error.message.includes("work_accidents_uq")) {
        throw businessRule("Există deja un accident înregistrat cu acest număr intern.");
      }
      throw businessRule("Există deja o înregistrare cu aceste date.");
    }
    if (error.code === "22012" || error.code === "22003") {
      throw businessRule(
        "O valoare numerică este în afara intervalului acceptat. Verificați orele, costurile și cantitățile introduse.",
      );
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, 300));
    }
  }
  throw error;
}
