// src/app/(app)/flota/[id]/pv/erori.ts
//
// Traducerea erorilor procesului-verbal de predare-primire (0215, F12c).
//
// Fișier propriu, nu adăugiri în `flota/erori.ts`: celelalte extensii ale
// flotei îl editează în paralel. Forma e a lui `traduEroareAlocare`: P0001
// propagă mesajul bazei (cu cifrele kilometrajului în el) și îl pune pe câmpul
// la care se referă; ce nu se recunoaște cade pe traducerea generică a flotei.
import { businessRule, invalidInput, isPostgrestError } from "@/lib/actions/errors";

import { traduEroare } from "@/app/(app)/flota/erori";

/**
 * Mesajul bazei → câmpul formularului. Ordinea contează: primul tipar care se
 * potrivește câștigă. Mesajele vin din `internal.pv_vehicul_inainte`.
 */
const CAMPURI_DUPA_MESAJ: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Kilometrajul din procesul-verbal/u, ["km_bord"]],
  [
    /^Completați kilometrajul, nivelul/u,
    ["km_bord", "nivel_rezervor", "stare_generala", "daune_constatate"],
  ],
  [/^Fiecare daună/u, ["daune"]],
];

/** CHECK-urile tabelei → câmpul și mesajul pentru om. */
const CAMPURI_DUPA_CHECK: readonly (readonly [string, string, string])[] = [
  [
    "pvv_daune_coerente_ck",
    "daune",
    "Lista de daune nu se potrivește cu răspunsul „S-au constatat daune?”.",
  ],
  ["pvv_daune_ck", "daune", "Cel mult 30 de daune pe un proces-verbal."],
  ["pvv_km_ck", "km_bord", "Kilometrajul se scrie în km întregi, între 0 și 5.000.000."],
  ["pvv_chei_ck", "numar_chei", "Numărul de chei e între 0 și 10."],
  ["pvv_dotari_ck", "dotari", "Una dintre dotări nu e în listă. Reîncărcați pagina."],
  [
    "pvv_documente_ck",
    "documente_bord",
    "Unul dintre documente nu e în listă. Reîncărcați pagina.",
  ],
  ["pvv_observatii_len", "observatii", "Observațiile au cel mult 2000 de caractere."],
  ["pvv_motiv_len", "motiv_anulare", "Motivul anulării are între 10 și 500 de caractere."],
];

export const MESAJ_PV_DUBLAT =
  "Există deja un proces-verbal pentru această predare. Anulați-l pe cel vechi dacă trebuie refăcut.";

/**
 * Traduce o eroare Postgres a PV-ului într-un mesaj afișabil ca atare.
 *
 * Tip `never`: apelul întrerupe fluxul ca un `throw`, deci TypeScript îngustează
 * corect tipul lui `data` imediat după.
 */
export function traduEroarePv(error: unknown): never {
  if (isPostgrestError(error)) {
    if (
      error.code === "23505" &&
      (error.message.includes("pvv_primita_uq") || error.message.includes("pvv_predata_uq"))
    ) {
      throw invalidInput(MESAJ_PV_DUBLAT, { alocare_primita_id: [MESAJ_PV_DUBLAT] });
    }
    if (error.code === "23514") {
      const check = CAMPURI_DUPA_CHECK.find(([nume]) => error.message.includes(nume));
      if (check !== undefined) {
        const [, camp, mesaj] = check;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      const mesaj = error.message.slice(0, 400);
      const campuri = CAMPURI_DUPA_MESAJ.find(([re]) => re.test(mesaj))?.[1] ?? [];
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  traduEroare(error);
}
