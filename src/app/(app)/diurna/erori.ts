// src/app/(app)/diurna/erori.ts
// Traducerea erorilor de bază specifice modulului de diurnă.
//
// `mapPostgrestError` (src/lib/actions/errors.ts) mapează P0001 generic pe
// „Operațiunea a fost respinsă de o regulă a sistemului.” — deliberat: textul
// brut din bază poate conține detalii tehnice. Triggerele din 0015_per_diem.sql
// (`internal.valideaza_deplasare`, `internal.valideaza_etapa_deplasare`,
// `internal.valideaza_cheltuiala_deplasare`) ridică însă mesaje scrise DIRECT
// pentru utilizatorul final, în română, cu cifre din bază (ex. data la care
// lipsește politica) — merită să ajungă pe ecran ca atare.

import "server-only";
import { businessRule, isPostgrestError } from "@/lib/actions/errors";

const LUNGIME_MAXIMA_MESAJ = 300;

/**
 * Traduce o eroare Postgres specifică modulului de diurnă într-o excepție
 * `ActionDenied` cu mesaj afișabil. Pentru orice cod necunoscut aici, o
 * re-aruncă neschimbată, ca `createAction` să o mapeze pe calea generică
 * (`mapPostgrestError`).
 *
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      // `business_trips_numar_uk` sau `business_trip_legs_ordine_uk`.
      throw businessRule(
        "Există deja o înregistrare cu aceste date — reîncercați, ar putea fi un conflict de numerotare.",
      );
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, LUNGIME_MAXIMA_MESAJ));
    }
  }
  throw error;
}
