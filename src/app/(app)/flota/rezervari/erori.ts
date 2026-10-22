// src/app/(app)/flota/rezervari/erori.ts
//
// Traducerea erorilor rezervărilor mașinilor de pool (0216, F12d).
//
// Fișier propriu, nu adăugiri în `flota/erori.ts`: celelalte extensii ale
// flotei îl editează în paralel. Fără `"use server"`: îl importă acțiunile.
// Forma e a lui `traduEroareAlocare`: P0001 propagă mesajul bazei (cu datele în
// el) și îl pune pe câmpul la care se referă.
import { businessRule, invalidInput, isPostgrestError } from "@/lib/actions/errors";

export const MESAJ_SUPRAPUNERE =
  "Vehiculul e deja rezervat în cel puțin una dintre zilele alese. Verificați grila de ocupare.";

/**
 * Mesajul bazei → câmpul formularului. Primul tipar care se potrivește câștigă.
 * Mesajele vin din `internal.rezervari_inainte` și `internal.foi_parcurs_rezervare`.
 */
const CAMPURI_DUPA_MESAJ: readonly (readonly [RegExp, readonly string[]])[] = [
  [/^Rezervarea începe/u, ["de_la"]],
  [
    /^Rezervarea depășește|^Rezervarea nu se poate prelungi|^Rezervarea se poate scurta|^Rezervarea are foaie/u,
    ["pana_la"],
  ],
  [/^Scrieți motivul/u, ["motiv"]],
  [/^Vehiculul/u, ["vehicle_id"]],
  [/^Angajatul ales/u, ["employee_id"]],
];

/** CHECK-urile tabelei → câmpul și mesajul pentru om. */
const CAMPURI_DUPA_CHECK: readonly (readonly [string, string, string])[] = [
  ["vr_interval_ck", "pana_la", "Ultima zi nu poate fi înaintea primei zile."],
  ["vr_scop_len", "scop", "Scopul are între 3 și 300 de caractere."],
  ["vr_destinatie_len", "destinatie", "Destinația are cel mult 300 de caractere."],
  ["vr_observatii_len", "observatii", "Observațiile au cel mult 1000 de caractere."],
  ["vr_motiv_respingere_len", "motiv", "Motivul are cel mult 500 de caractere."],
  ["vr_motiv_anulare_len", "motiv", "Motivul are cel mult 500 de caractere."],
  ["vr_respinsa_cu_motiv", "motiv", "Scrieți motivul respingerii."],
];

/**
 * Traduce o eroare Postgres a rezervării într-un mesaj afișabil ca atare.
 *
 * 23P01 (EXCLUDE) NU e în harta generică din `src/lib/actions/errors.ts`, deci
 * se tratează aici; `details` nu se propagă, fiindcă are uuid-uri. Ce nu se
 * recunoaște se aruncă mai departe, la `mapPostgrestError`.
 *
 * Tip `never`: apelul întrerupe fluxul ca un `throw`.
 */
export function traduEroareRezervare(error: unknown): never {
  if (isPostgrestError(error)) {
    if (error.code === "23P01") {
      throw invalidInput(MESAJ_SUPRAPUNERE, {
        de_la: [MESAJ_SUPRAPUNERE],
        pana_la: [MESAJ_SUPRAPUNERE],
      });
    }
    if (error.code === "23514") {
      const check = CAMPURI_DUPA_CHECK.find(([nume]) => error.message.includes(nume));
      if (check !== undefined) {
        const [, camp, mesaj] = check;
        throw invalidInput(mesaj, { [camp]: [mesaj] });
      }
    }
    if (error.code === "P0001") {
      const mesaj = error.message.slice(0, 300);
      const campuri = CAMPURI_DUPA_MESAJ.find(([re]) => re.test(mesaj))?.[1] ?? [];
      if (campuri.length > 0) {
        throw invalidInput(mesaj, Object.fromEntries(campuri.map((c) => [c, [mesaj]])));
      }
      throw businessRule(mesaj);
    }
  }
  throw error;
}
