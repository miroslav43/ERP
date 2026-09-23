// src/app/(app)/flota/erori.ts
// Traducerea codurilor Postgres specifice flotei — separat de traducerea
// generică din `src/lib/actions/errors.ts`, ca fiecare modul să-și scrie
// mesajele fără să atingă un fișier comun.

import { businessRule, invalidInput, isPostgrestError } from "@/lib/actions/errors";

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
      const mesaj = error.message.slice(0, 300);
      const campuri = campurileMesajului(mesaj);
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  throw error;
}

/**
 * Câmpul (sau câmpurile) de care ține un refuz al triggerelor de flotă, după
 * începutul mesajului. Cu el, eroarea ajunge ÎN caseta vinovată, înroșită, nu
 * într-un banner deasupra formularului. Mesajele din bază (0012/0018) sunt
 * scrise cu ş/ţ cu sedilă; potrivirea ocolește literele acelea.
 */
const CAMPURI_DUPA_MESAJ: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Kilometrajul de sosire/u, ["km_sosire"]],
  [/^Kilometrajul de plecare/u, ["km_plecare"]],
  [/^Ora de sosire/u, ["sosire_la"]],
  [/^Completa.i ora .i kilometrajul de sosire/u, ["sosire_la", "km_sosire"]],
  [/^Data aliment/u, ["alimentat_la"]],
  [/^Cantitatea de combustibil/u, ["litri"]],
  [/^Vehiculul/u, ["vehicle_id"]],
  [/^.oferul selectat/u, ["employee_id"]],
];

function campurileMesajului(mesaj: string): readonly string[] {
  return CAMPURI_DUPA_MESAJ.find(([re]) => re.test(mesaj))?.[1] ?? [];
}
