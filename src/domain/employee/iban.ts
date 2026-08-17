// src/domain/employee/iban.ts
/**
 * IBAN românesc: RO + 2 cifre de control + 4 litere (codul băncii) + 16
 * caractere alfanumerice (contul) = 24 de caractere. Verificarea este
 * standardul ISO 13616 (mod-97): se mută primele 4 caractere la sfârșit,
 * literele devin numere (A=10 … Z=35), iar restul împărțirii la 97 trebuie
 * să fie 1. Funcție pură, fără dependențe.
 */

const LUNGIME_IBAN_RO = 24;
const FORMAT_IBAN_RO = /^RO[0-9]{2}[A-Z]{4}[0-9A-Z]{16}$/;

export type MotivIbanInvalid =
  "lipsa" | "caractere" | "tara" | "lungime" | "format" | "cifra_control";

export interface IbanValid {
  readonly valid: true;
  readonly iban: string;
  readonly codBanca: string;
  readonly cont: string;
}

export interface IbanInvalid {
  readonly valid: false;
  readonly motiv: MotivIbanInvalid;
  readonly mesaj: string;
}

export type RezultatIban = IbanValid | IbanInvalid;

export function normalizeazaIban(valoare: string): string {
  return valoare.replace(/[\s.\-_]/g, "").toUpperCase();
}

function inNumeric(valoare: string): string {
  return [...valoare]
    .map((caracter) => {
      const cod = caracter.charCodeAt(0);
      return cod >= 48 && cod <= 57 ? caracter : String(cod - 55);
    })
    .join("");
}

function mod97(numeric: string): number {
  return [...numeric].reduce(
    (rest, caracter) => (rest * 10 + (caracter.charCodeAt(0) - 48)) % 97,
    0,
  );
}

/** Cifrele de control pentru un BBAN românesc — folosit la validare și la generarea datelor de test. */
export function cifreControlIban(bban: string): string {
  const normalizat = normalizeazaIban(bban);
  const rest = mod97(inNumeric(`${normalizat}RO00`));
  return String(98 - rest).padStart(2, "0");
}

function invalid(motiv: MotivIbanInvalid, mesaj: string): IbanInvalid {
  return { valid: false, motiv, mesaj };
}

export function valideazaIban(valoare: string): RezultatIban {
  const iban = normalizeazaIban(valoare);
  if (iban.length === 0) {
    return invalid("lipsa", "Codul IBAN lipsește.");
  }
  if (/[^0-9A-Z]/.test(iban)) {
    return invalid("caractere", "Codul IBAN poate conține doar litere și cifre.");
  }
  if (!iban.startsWith("RO")) {
    return invalid(
      "tara",
      `Se acceptă doar conturi românești (IBAN care începe cu „RO”); ați introdus „${iban.slice(0, 2)}”.`,
    );
  }
  if (iban.length !== LUNGIME_IBAN_RO) {
    return invalid(
      "lungime",
      `Un IBAN românesc are 24 de caractere; ați introdus ${String(iban.length)}.`,
    );
  }
  if (!FORMAT_IBAN_RO.test(iban)) {
    return invalid(
      "format",
      "Structura IBAN-ului nu este cea românească: RO, două cifre de control, patru litere pentru bancă și 16 caractere pentru cont.",
    );
  }
  if (mod97(inNumeric(`${iban.slice(4)}${iban.slice(0, 4)}`)) !== 1) {
    return invalid(
      "cifra_control",
      "Cifrele de control ale IBAN-ului nu corespund. Verificați cifrele introduse.",
    );
  }
  return { valid: true, iban, codBanca: iban.slice(4, 8), cont: iban.slice(8) };
}

/** Afișare pe grupuri de 4: „RO49 AAAA 1B31 0075 9384 0000”. */
export function formateazaIban(valoare: string): string {
  const normalizat = normalizeazaIban(valoare);
  const grupuri = normalizat.match(/.{1,4}/g);
  return grupuri === null ? normalizat : grupuri.join(" ");
}
