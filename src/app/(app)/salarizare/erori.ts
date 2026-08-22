// src/app/(app)/salarizare/erori.ts
// Traducerea erorilor de bază specifice modulului de salarizare.
//
// `mapPostgrestError` (src/lib/actions/errors.ts) înlocuiește ORICE P0001 cu
// „Operațiunea a fost respinsă de o regulă a sistemului." — deliberat, fiindcă
// textul brut din bază poate conține nume de constrângeri sau fragmente de SQL.
// Triggerul `internal.payroll_periods_tranzitie` (0026_payroll.sql:287) ridică
// însă șase mesaje scrise DIRECT pentru utilizatorul final, în română, cu
// CIFRELE în ele — iar cifrele se pot afla doar din bază:
//
//   „Pontajul lunii 8/2026 nu este blocat. Salariile se calculează doar peste
//    un pontaj blocat."
//   „Există 3 cereri de concediu în așteptare care se suprapun peste 8/2026."
//
// Fără propagare, omul nu află NICI ce lună, NICI câte cereri. De aceea P0001
// se propagă, trunchiat; `error.details` și `error.hint` niciodată.
//
// Restul codurilor primesc mesaje scrise aici. Pentru 23505 se identifică
// indexul din textul erorii, dar textul NU se propagă: din el se alege doar
// care dintre mesajele noastre se afișează.

import "server-only";
import { businessRule, isPostgrestError } from "@/lib/actions/errors";

const LUNGIME_MAXIMA_MESAJ = 300;

/**
 * Traduce o eroare Postgres specifică salarizării într-un `ActionDenied` cu
 * mesaj afișabil. Orice cod netratat aici se re-aruncă neschimbat, ca
 * `createAction` să-l mapeze pe calea generică.
 *
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`, deci TypeScript
 * îngustează corect tipul lui `data` imediat după.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      // Indexurile unice ale modulului, toate PARȚIALE (`where deleted_at is
      // null`) — vezi 0026_payroll.sql:203, 141, 74.
      if (error.message.includes("payroll_periods_luna_uq")) {
        throw businessRule(
          "Există deja o perioadă de salarizare pentru luna aleasă. Deschideți-o din listă în loc să creați una nouă.",
        );
      }
      if (error.message.includes("payroll_entries_uq")) {
        throw businessRule(
          "Angajatul are deja un rând de salariu în această perioadă. Recalculați perioada în loc să adăugați un rând nou.",
        );
      }
      if (error.message.includes("payroll_settings_valabil_uq")) {
        throw businessRule(
          "Există deja o versiune de setări de salarizare valabilă de la aceeași dată. Alegeți altă dată de intrare în vigoare.",
        );
      }
      throw businessRule("Există deja o înregistrare de salarizare cu aceste date.");
    }

    if (error.code === "42P10") {
      // Capcana 7: unicitatea e pe un index PARȚIAL, iar PostgREST nu emite
      // predicatul în ON CONFLICT. Dacă apare, e un `.upsert()` strecurat
      // undeva unde trebuia citire-apoi-inserare-sau-actualizare.
      throw businessRule(
        "Salvarea a intrat în conflict cu o înregistrare existentă și nu a putut fi rezolvată automat. Reîncercați; dacă se repetă, semnalați problema.",
      );
    }

    if (error.code === "23514") {
      // `payroll_entries_valori_ck` (brut/net/rest nenegative, cost >= brut),
      // `payroll_settings_cote_ck`, `ppdb_*_ck`. Un calcul care produce valori
      // imposibile e un defect de configurare, nu o greșeală de operare.
      throw businessRule(
        "Calculul a produs valori imposibile (sume negative sau cote în afara intervalului permis). Verificați setările de salarizare ale lunii.",
      );
    }

    if (error.code === "22003") {
      // numeric(14,2) / numeric(6,4) depășit — de regulă o cotă introdusă ca
      // procent (25) în loc de fracție (0,25), sau o sumă absurdă.
      throw businessRule(
        "O valoare depășește limitele permise. Cotele se introduc ca fracție (0,25 pentru 25%), nu ca procent.",
      );
    }

    if (error.code === "22012") {
      throw businessRule(
        "Calculul a încercat o împărțire la zero. Verificați norma zilnică și numărul de zile lucrătoare ale lunii.",
      );
    }

    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, LUNGIME_MAXIMA_MESAJ));
    }
  }
  throw error;
}
