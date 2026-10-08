// src/app/(app)/registru/indicativ.ts
//
// Ordinea indicativelor din nomenclator — Ordin 217/1996 art. 11: cifra romană
// a compartimentului, litera subdiviziunii, cifra arabă a dosarului.
//
// Baza ordonează `compartiment_cifra` ALFABETIC, ceea ce e corect până la
// „VIII" și greșit de la „IX" în sus (vaultul registrului o spune de la
// început). Aici se compară pe VALOARE, pentru gruparea pe dosar din registru
// și pentru tabelul nomenclatorului.

const ROMANE: Readonly<Record<string, number>> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

const INDICATIV = /^([IVXLCDM]+)(?:\.([A-Z]))?\.(\d+)$/u;

function dinRoman(text: string): number {
  let total = 0;
  for (let i = 0; i < text.length; i += 1) {
    const curent = ROMANE[text.charAt(i)] ?? 0;
    const urmator = ROMANE[text.charAt(i + 1)] ?? 0;
    total += curent < urmator ? -curent : curent;
  }
  return total;
}

/**
 * Tupla de ordonare: compartiment, literă (goală = fără subdiviziune), dosar.
 * Un indicativ cu altă formă cade la coadă, fără să arunce — un nomenclator
 * adaptat de mână poate avea orice.
 */
export function ordineIndicativ(indicativ: string): readonly [number, string, number] {
  const m = INDICATIV.exec(indicativ);
  if (m === null) return [Number.MAX_SAFE_INTEGER, "", 0];
  return [dinRoman(m[1] ?? ""), m[2] ?? "", Number(m[3])];
}

export function comparaIndicative(a: string, b: string): number {
  const [ca, la, da] = ordineIndicativ(a);
  const [cb, lb, db] = ordineIndicativ(b);
  if (ca !== cb) return ca - cb;
  if (la !== lb) return la < lb ? -1 : 1;
  return da - db;
}
