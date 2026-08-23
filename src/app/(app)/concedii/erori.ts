// src/app/(app)/concedii/erori.ts
// Traducerea erorilor de bază specifice modulului de concedii.
//
// `mapPostgrestError` (src/lib/actions/errors.ts) mapează P0001 generic pe
// „Operațiunea a fost respinsă de o regulă a sistemului.” — deliberat: textul
// brut din bază poate conține nume de constrângeri. Mesajele triggerelor de
// concedii (0009_leave.sql, 0017_fix_concedii.sql) sunt însă scrise DIRECT
// pentru utilizator, în română (sold insuficient, tip dezactivat, document
// lipsă, perioadă mai veche de doi ani) — merită să ajungă pe ecran ca atare.
// `error.details`/`error.hint` NU se propagă niciodată: pot conține date din
// alte rânduri (ex. 23P01 include uuid-ul angajatului și perioada celeilalte
// cereri suprapuse).

import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { businessRule } from "@/lib/actions/errors";

const LUNGIME_MAXIMA_MESAJ = 300;

/**
 * Traduce o eroare Postgres specifică modulului de concedii într-o excepție
 * `ActionDenied` cu mesaj afișabil. Pentru orice cod necunoscut aici,
 * re-aruncă eroarea neschimbată, ca `createAction` să o mapeze pe calea
 * generică (`mapPostgrestError`).
 */
export function traduEroare(error: PostgrestError): Error {
  switch (error.code) {
    case "23P01":
      // exclusion_violation — `leave_requests_fara_suprapunere`. Cursă rămasă
      // după pre-verificarea din handler (altă filă a browserului, altă sesiune).
      return businessRule(
        "Aveți deja o cerere de concediu care acoperă o parte din perioada aleasă. Anulați-o sau alegeți alte date.",
      );
    case "23514":
      // check_violation. Singurul CHECK pe care utilizatorul îl poate atinge de
      // pe formular e `leave_requests_certificat_ck` (0009:383-386): cod de
      // indemnizație fără număr de certificat, sau invers. Numele constrângerii
      // NU se propagă — doar explicația.
      if (error.message.includes("leave_requests_certificat_ck")) {
        return businessRule(
          "Certificatul medical e incomplet: codul de indemnizație și numărul certificatului se completează împreună.",
        );
      }
      return error;
    case "P0001":
      // RAISE EXCEPTION din triggerele de regulă (0009/0017): mesajul e deja
      // scris pentru utilizatorul final, în română. Se propagă DOAR `message`.
      return businessRule(error.message.slice(0, LUNGIME_MAXIMA_MESAJ));
    default:
      return error;
  }
}
