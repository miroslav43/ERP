// src/app/(app)/registru/erori.ts
// Traducerea codurilor Postgres specifice registrului — separat de traducerea
// generică din `src/lib/actions/errors.ts`, ca fiecare modul să-și scrie mesajele
// fără să atingă un fișier comun. Copie a tiparului din `ssm/erori.ts`.

import { businessRule, isPostgrestError } from "@/lib/actions/errors";

/**
 * P0001 e cazul care contează. Funcțiile din 0120 și 0135 ridică mesaje deja
 * scrise pentru utilizatorul final, CU DATE în ele: „Registrul pe anul 2025 este
 * închis.", „Manual se pot înregistra doar documente intrate sau de uz intern.",
 * „Tipul de document «x» nu are o poartă declarată." Fără propagare,
 * `mapPostgrestError` le-ar înlocui pe toate cu „Operațiunea a fost respinsă de o
 * regulă a sistemului" — iar cel care ține registrul n-ar afla CE să corecteze.
 *
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`, deci TypeScript
 * îngustează corect tipul lui `data` imediat după
 * `if (error !== null) traduEroare(error);`.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      if (error.message.includes("nomenclator_dosare_uq")) {
        throw businessRule("Există deja un dosar cu acest indicativ în nomenclator.");
      }
      if (error.message.includes("nomenclator_tipuri_uq")) {
        throw businessRule(
          "Tipul acesta de document e deja clasat într-un dosar. Un tip se clasează într-unul singur.",
        );
      }
      if (error.message.includes("registru_org_an_numar_uniq")) {
        throw businessRule(
          "Numărul acesta de înregistrare există deja pe anul curent. Reîncercați.",
        );
      }
      throw businessRule("Există deja o înregistrare cu aceste date.");
    }
    if (error.code === "42501") {
      throw businessRule(
        "Numerele de înregistrare nu se pot scrie direct în registru. Folosiți înregistrarea manuală.",
      );
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, 300));
    }
  }
  throw error;
}
