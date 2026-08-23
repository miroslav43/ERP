// src/domain/ssm/scadente.ts

/**
 * Semaforul de scadență pentru tot ce ține de SSM/PSI: instruiri, stingătoare,
 * fișe de aptitudine, autorizații nominale.
 *
 * `niciodata` este o stare distinctă de `expirat`: un tip de instruire
 * obligatoriu pe care angajatul nu l-a făcut NICIODATĂ e mai grav decât unul
 * expirat de curând — nu există măcar un istoric, deci nu se poate calcula o
 * scadență. Apelantul o cere explicit prin `areInregistrare`, fiindcă funcția
 * nu are cum să deducă asta doar din `expiraLa` (care poate fi `null` și
 * pentru un tip fără periodicitate legală, adică unul care nu expiră NICIODATĂ
 * odată efectuat — cazul instruirilor introductive).
 *
 * Pragul de preaviz (30 de zile) e constanta din
 * `ssm_legal_parameters.zile_avertizare_scadenta` (seed 0011) — NU se citește
 * din tabelă, fiindcă acolo tabela e sub resursa `compliance`, la care `hr`
 * (care administrează SSM) nu are acces. Pragul „critic” (7 zile) e o
 * convenție de interfață, nu una legală.
 *
 * Constantele poartă domeniul în nume de la decizia B1 încoace
 * (`docs/design/redesign/0-decizii-de-pornire.md`): `PRAG_AVERTIZARE_ZILE`
 * exista de trei ori, cu ACELAȘI nume și două valori — 30 aici, 30 la flotă,
 * 15 la mentenanță — iar două dintre ele erau fixate de teste. Un import
 * greșit nu producea nicio eroare, doar alt preaviz.
 */

export const PRAG_SSM_AVERTIZARE_ZILE = 30;
export const PRAG_SSM_CRITIC_ZILE = 7;

export type StareScadentaSsm = "niciodata" | "expirat" | "critic" | "atentie" | "ok";

/**
 * Diferența în zile calendaristice între două zile ISO (`"AAAA-LL-ZZ"`).
 *
 * Se calculează prin `Date.UTC`, niciodată prin `new Date(text)`: acesta din
 * urmă interpretează șirul ca miezul nopții UTC, iar în România asta poate
 * pica deja în ziua precedentă. Folosind UTC simetric pentru ambele capete,
 * fusul orar nu mai contează — doar diferența dintre ele.
 */
function zileIntre(azi: string, data: string): number {
  const [aY, aM, aD] = azi.split("-").map(Number);
  const [dY, dM, dD] = data.split("-").map(Number);
  const msAzi = Date.UTC(aY ?? 0, (aM ?? 1) - 1, aD ?? 1);
  const msData = Date.UTC(dY ?? 0, (dM ?? 1) - 1, dD ?? 1);
  return Math.round((msData - msAzi) / 86_400_000);
}

/**
 * Starea unei scadențe SSM/PSI.
 *
 * @param areInregistrare Există măcar o înregistrare (instruire efectuată,
 *   verificare făcută etc.)? Dacă nu, starea e mereu `niciodata`, indiferent
 *   de `expiraLa`.
 * @param expiraLa Data de expirare curentă, sau `null` dacă tipul nu are
 *   periodicitate legală (odată efectuată, rămâne valabilă la nesfârșit).
 * @param azi Ziua curentă (Europe/Bucharest), din `todayInBucharest()`.
 */
export function stareScadentaSsm(
  areInregistrare: boolean,
  expiraLa: string | null,
  azi: string,
): StareScadentaSsm {
  if (!areInregistrare) return "niciodata";
  if (expiraLa === null) return "ok";
  if (expiraLa < azi) return "expirat";

  const zileRamase = zileIntre(azi, expiraLa);
  if (zileRamase <= PRAG_SSM_CRITIC_ZILE) return "critic";
  if (zileRamase <= PRAG_SSM_AVERTIZARE_ZILE) return "atentie";
  return "ok";
}

/** `true` pentru orice stare care merită atenție pe un panou / un contor de badge. */
export function esteDeAtentionat(stare: StareScadentaSsm): boolean {
  return stare === "niciodata" || stare === "expirat" || stare === "critic" || stare === "atentie";
}
