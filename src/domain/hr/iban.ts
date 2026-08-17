// src/domain/hr/iban.ts
// Validare IBAN prin restul modulo 97 (ISO 13616), cu lungimea impusă pentru România.

const LUNGIMI_TARA: Readonly<Record<string, number>> = { RO: 24 };

export type RezultatIban =
  | { readonly valid: true; readonly iban: string }
  | { readonly valid: false; readonly motiv: string };

export function normalizeazaIban(valoare: string): string {
  return valoare.replace(/[\s-]/gu, "").toUpperCase();
}

export function ultimeleCifreIban(valoare: string): string {
  return normalizeazaIban(valoare).slice(-4);
}

export function mascheazaIban(valoare: string): string {
  const iban = normalizeazaIban(valoare);
  if (iban.length < 8) return "••••";
  return `${iban.slice(0, 4)}${"•".repeat(iban.length - 8)}${iban.slice(-4)}`;
}

function restModulo97(iban: string): number {
  const rearanjat = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let rest = 0;
  for (const caracter of rearanjat) {
    const cod = caracter.charCodeAt(0);
    const bucata = cod >= 65 && cod <= 90 ? String(cod - 55) : caracter;
    for (const cifra of bucata) {
      rest = (rest * 10 + Number(cifra)) % 97;
    }
  }
  return rest;
}

export function validateazaIban(valoare: string): RezultatIban {
  const iban = normalizeazaIban(valoare);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/u.test(iban)) {
    return {
      valid: false,
      motiv:
        "IBAN-ul nu are formatul așteptat (două litere de țară, două cifre de control, apoi codul contului).",
    };
  }
  const tara = iban.slice(0, 2);
  const lungimeAsteptata = LUNGIMI_TARA[tara];
  if (lungimeAsteptata !== undefined && iban.length !== lungimeAsteptata) {
    return {
      valid: false,
      motiv: `Un IBAN ${tara} are ${String(lungimeAsteptata)} de caractere, nu ${String(iban.length)}.`,
    };
  }
  if (restModulo97(iban) !== 1) {
    return {
      valid: false,
      motiv: "IBAN-ul nu trece verificarea cifrelor de control. Verificați cifrele introduse.",
    };
  }
  return { valid: true, iban };
}
