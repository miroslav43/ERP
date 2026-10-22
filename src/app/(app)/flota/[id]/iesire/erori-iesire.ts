// src/app/(app)/flota/[id]/iesire/erori-iesire.ts
//
// Traducerea erorilor ieșirii din parc (0218, F12h).
//
// Fișier propriu, nu adăugiri în `flota/erori.ts`: celelalte extensii ale
// flotei îl editează în paralel. Forma e a lui `traduEroareAlocare`: P0001
// propagă mesajul bazei (cu cifrele kilometrajului în el) și îl pune pe câmpul
// la care se referă. „Vehiculul ales…” și „Vehiculul este deja ieșit…” NU merg
// pe `vehicle_id`: în casetă vehiculul e un câmp ascuns, iar mesajul s-ar
// pierde sub „Corectați câmpurile marcate”. Mesajele din 0218 au ș/ț corecte,
// deci tiparele le folosesc direct.
import { businessRule, invalidInput, isPostgrestError } from "@/lib/actions/errors";
import { cuVirgula } from "@/lib/text/diacritice";

import { traduEroare } from "@/app/(app)/flota/erori";

/** Mesajul bazei → câmpul casetei. Primul tipar care se potrivește câștigă. */
const CAMPURI_DUPA_MESAJ: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Data ieșirii/u, ["data_iesire"]],
  // Ambele mesaje de km din `internal.iesire_inainte`: sub ultimul kilometraj
  // al vehiculului și sub predarea către șoferul actual.
  [/^Kilometrajul la ieșire/u, ["km_iesire"]],
  [/^Data la care s-a făcut pasul/u, ["finalizat_la"]],
];

/** CHECK-urile tabelelor → câmpul și mesajul pentru om. */
const CAMPURI_DUPA_CHECK: readonly (readonly [string, string, string])[] = [
  // Garda din trigger îl precede; ajunge aici doar printr-o cursă.
  [
    "va_km_ck",
    "km_iesire",
    "Kilometrajul la ieșire este mai mic decât cel de la predarea mașinii către șoferul actual.",
  ],
  [
    "vexit_epava_ck",
    "destinatie_epava",
    "Alegeți ce s-a întâmplat cu epava (doar la daună totală).",
  ],
  ["vexit_radiere_ck", "motiv_radiere", "Alegeți motivul radierii (doar la radiere)."],
  ["vexit_km_ck", "km_iesire", "Kilometrajul se scrie în km întregi, cel puțin 0."],
  ["vexit_motiv_ck", "motiv", "Motivul ieșirii are între 5 și 500 de caractere."],
  [
    "vexit_cumparator_ck",
    "cumparator",
    "Cumpărătorul se completează doar când vehiculul se vinde, în cel mult 200 de caractere.",
  ],
  ["vexit_pret_ck", "pret", "Prețul se completează doar când vehiculul se vinde."],
  ["vexit_nr_document_ck", "nr_document", "Numărul documentului are cel mult 60 de caractere."],
  ["vexit_observatii_ck", "observatii", "Observațiile au cel mult 1000 de caractere."],
  [
    "vexit_pastreaza_ck",
    "pastreaza_numarul",
    "Păstrarea numărului nu se cere la acest fel de ieșire.",
  ],
  ["vexit_anulare_ck", "motiv_anulare", "Motivul anulării are între 5 și 500 de caractere."],
  [
    "vexob_inchis_ck",
    "stare",
    "Un termen e fie făcut, fie „nu se aplică”, nu amândouă. Reîncărcați fișa.",
  ],
  ["vexob_nota_ck", "nota", "Nota are cel mult 1000 de caractere."],
];

export const MESAJ_IESIRE_DUBLATA = "Vehiculul are deja o ieșire înregistrată. Reîncărcați fișa.";
export const MESAJ_NUMAR_OCUPAT =
  "Există deja un vehicul activ cu acest număr sau VIN; vehiculul nu poate reveni în parc.";

/**
 * Traduce o eroare Postgres a ieșirii într-un mesaj afișabil ca atare.
 *
 * Tip `never`: apelul întrerupe fluxul ca un `throw`, deci TypeScript îngustează
 * corect tipul lui `data` imediat după.
 */
export function traduEroareIesire(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23505") {
      if (error.message.includes("vexit_vie_uq")) throw businessRule(MESAJ_IESIRE_DUBLATA);
      // La anulare: numărul (sau VIN-ul) s-a pus între timp pe alt vehicul (I-h2).
      if (
        error.message.includes("vehicles_org_nr_uq") ||
        error.message.includes("vehicles_org_vin_uq")
      ) {
        throw businessRule(MESAJ_NUMAR_OCUPAT);
      }
    }
    if (error.code === "23514") {
      const check = CAMPURI_DUPA_CHECK.find(([nume]) => error.message.includes(nume));
      if (check !== undefined) {
        const [, camp, mesaj] = check;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      // INSERT-ul scrie și în `vehicles` și `vehicle_assignments`: triggerele lor
      // vechi (0012–0173) au ş/ţ cu sedilă. Se corectează la afișare, ca în
      // traducerea flotei; mesajele din 0218 trec neschimbate.
      const mesaj = cuVirgula(error.message.slice(0, 400));
      const campuri = CAMPURI_DUPA_MESAJ.find(([re]) => re.test(mesaj))?.[1] ?? [];
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  traduEroare(error);
}
