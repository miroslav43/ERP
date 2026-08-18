// src/app/(app)/flota/erori.ts
// Traducerea codurilor Postgres specifice flotei — separat de traducerea
// generică din `src/lib/actions/errors.ts`, ca fiecare modul să-și scrie
// mesajele fără să atingă un fișier comun.

import { businessRule, isPostgrestError } from "@/lib/actions/errors";

/**
 * Traduce o eroare Postgres într-un mesaj de business afișabil ca atare.
 *
 * Cazul care contează cel mai mult e P0001. Triggerele din 0012 și 0018 ridică
 * mesaje deja scrise pentru utilizator final, cu CIFRELE în ele:
 *
 *   „Kilometrajul de plecare (9000 km) este mai mic decât ultimul kilometraj
 *    cunoscut al vehiculului (10000 km)…"
 *
 * Fără propagare, `mapPostgrestError` le-ar înlocui cu „Operațiunea a fost
 * respinsă de o regulă a sistemului" — iar șoferul n-ar afla CE km să corecteze.
 * De aceea mesajul se propagă, nu se rescrie: cifrele din el se pot afla doar
 * din bază.
 *
 * Tip `never`: apelul întrerupe fluxul exact ca un `throw`, deci TypeScript
 * îngustează corect tipul lui `data` imediat după.
 */
export function traduEroare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      // `vehicles_org_nr_uq` sau `vehicles_org_vin_uq`. Ambele se aplică peste
      // valoarea NORMALIZATĂ de trigger, deci mesajul nu poate cita ce a scris
      // utilizatorul — ar fi diferit de ce a ajuns în index.
      throw businessRule(
        "Există deja un vehicul cu acest număr de înmatriculare sau cu acest VIN în organizație.",
      );
    }
    if (error.code === "22012" || error.code === "22003") {
      throw businessRule(
        "O valoare numerică este în afara intervalului acceptat. Verificați kilometrajul, litrii și costul.",
      );
    }
    if (error.code === "P0001") {
      throw businessRule(error.message.slice(0, 300));
    }
  }
  throw error;
}
