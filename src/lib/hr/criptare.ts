// src/lib/hr/criptare.ts
// AES-256-GCM pentru CNP/IBAN + HMAC-SHA256 pentru amprenta de deduplicare.
// Nu se importă niciodată din componente client: folosește node:crypto.

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const ALGORITM = "aes-256-gcm";
const LUNGIME_IV = 12;
const LUNGIME_CHEIE = 32;

export interface ValoareCriptata {
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
  readonly keyVersion: number;
}

export interface ValoareDeDecriptat {
  readonly ciphertext: string | null;
  readonly iv: string | null;
  readonly tag: string | null;
  readonly keyVersion: number | null;
}

function citesteCheia(numeVariabila: string): Buffer {
  const brut = process.env[numeVariabila];
  if (brut === undefined || brut.length === 0) {
    throw new Error(
      "Criptarea datelor de personal nu este configurată pe server. Contactați administratorul platformei.",
    );
  }
  const cheie = Buffer.from(brut, "base64");
  if (cheie.length !== LUNGIME_CHEIE) {
    throw new Error(
      "Cheia de criptare a datelor de personal nu are lungimea corectă (32 de octeți).",
    );
  }
  return cheie;
}

function versiuneaCurenta(): number {
  const versiune = Number(process.env.HR_ENCRYPTION_KEY_VERSION ?? "1");
  if (!Number.isInteger(versiune) || versiune < 1) {
    throw new Error("Versiunea cheii de criptare este configurată greșit pe server.");
  }
  return versiune;
}

/** PostgREST transmite `bytea` ca text hexazecimal prefixat cu \x. */
export function catreBytea(valoare: Buffer): string {
  return `\\x${valoare.toString("hex")}`;
}

export function dinBytea(valoare: string): Buffer {
  return Buffer.from(valoare.startsWith("\\x") ? valoare.slice(2) : valoare, "hex");
}

export function cripteaza(text: string): ValoareCriptata {
  const cheie = citesteCheia("HR_ENCRYPTION_KEY");
  const iv = randomBytes(LUNGIME_IV);
  const cifru = createCipheriv(ALGORITM, cheie, iv);
  const ciphertext = Buffer.concat([cifru.update(text, "utf8"), cifru.final()]);
  return {
    ciphertext: catreBytea(ciphertext),
    iv: catreBytea(iv),
    tag: catreBytea(cifru.getAuthTag()),
    keyVersion: versiuneaCurenta(),
  };
}

export function decripteaza(intrare: ValoareDeDecriptat): string | null {
  if (
    intrare.ciphertext === null ||
    intrare.iv === null ||
    intrare.tag === null ||
    intrare.keyVersion === null
  ) {
    return null;
  }
  if (intrare.keyVersion !== versiuneaCurenta()) {
    throw new Error(
      "Datele au fost criptate cu o versiune mai veche a cheii. Este necesară recriptarea.",
    );
  }
  const cheie = citesteCheia("HR_ENCRYPTION_KEY");
  const decifru = createDecipheriv(ALGORITM, cheie, dinBytea(intrare.iv));
  decifru.setAuthTag(dinBytea(intrare.tag));
  const clar = Buffer.concat([decifru.update(dinBytea(intrare.ciphertext)), decifru.final()]);
  return clar.toString("utf8");
}

/** Amprentă cu cheie separată — fără ea, spațiul CNP-urilor se sparge prin forță brută. */
export function amprenta(text: string): string {
  return createHmac("sha256", citesteCheia("HR_HASH_KEY")).update(text, "utf8").digest("hex");
}
