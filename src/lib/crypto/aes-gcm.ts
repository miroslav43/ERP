// src/lib/crypto/aes-gcm.ts
import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

import { serverEnv } from "@/config/env";

/**
 * AES-256-GCM peste `node:crypto`, cu versionarea cheilor.
 *
 * DE CE UN IV NOU LA FIECARE CRIPTARE
 * -----------------------------------
 * GCM este, în interior, modul CTR: cheia și IV-ul generează un flux de chei
 * (keystream) care se aplică prin XOR peste text. Dacă aceeași pereche
 * (cheie, IV) este folosită de două ori, fluxul de chei este identic, deci
 *     C1 XOR C2 = P1 XOR P2
 * iar atacatorul obține diferența celor două texte clare fără să știe cheia.
 * Pe date cu format cunoscut — un CNP are 13 cifre, un IBAN începe cu „RO” —
 * asta echivalează practic cu decriptarea amândurora.
 *
 * Mai grav: reutilizarea IV-ului în GCM permite recuperarea subcheii de
 * autentificare H din GHASH („forbidden attack”, Joux). Cu H în mână,
 * atacatorul poate falsifica eticheta de autentificare pentru mesaje pe care
 * le compune singur — adică poate scrie în baza de date un CNP ales de el,
 * care trece verificarea de integritate. Confidențialitatea și autenticitatea
 * cad simultan.
 *
 * De aceea IV-ul se generează aici, la fiecare apel, cu `randomBytes(12)`, și
 * nu este niciodată primit din exterior. 12 octeți este lungimea nativă a GCM
 * (orice altă lungime trece printr-o rundă GHASH suplimentară și pierde
 * garanția de unicitate a construcției).
 *
 * ROTAȚIA CHEILOR
 * ---------------
 * Se scrie întotdeauna cu cheia activă (`HR_ENCRYPTION_ACTIVE_KEY`), se citește
 * cu versiunea salvată pe rând (`*_key_version`). O cheie veche NU se șterge
 * din configurație cât timp mai există rânduri criptate cu ea; rotația reală
 * înseamnă: adaugi cheia nouă, o faci activă, apoi re-criptezi rândurile vechi
 * în lot și abia la final retragi cheia veche.
 */

const ALGORITM = "aes-256-gcm" as const;
const LUNGIME_CHEIE = 32;
const LUNGIME_IV = 12;
const LUNGIME_TAG = 16;
const LUNGIME_MINIMA_CHEIE_HMAC = 32;
const FORMAT_VERSIUNE = /^[0-9]{1,9}$/;
const FORMAT_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type CodEroareCripto =
  | "cheie_lipsa"
  | "cheie_invalida"
  | "versiune_invalida"
  | "valoare_goala"
  | "format_invalid"
  | "autentificare_esuata";

export class EroareCriptografica extends Error {
  readonly cod: CodEroareCripto;

  constructor(cod: CodEroareCripto, mesaj: string) {
    super(mesaj);
    this.name = "EroareCriptografica";
    this.cod = cod;
  }
}

export interface ValoareCriptata {
  readonly ciphertext: Buffer;
  readonly iv: Buffer;
  readonly tag: Buffer;
  readonly keyVersion: string;
}

let cheiDecodate: ReadonlyMap<string, Buffer> | null = null;

function decodeazaCheie(versiune: string, base64: string): Buffer {
  if (!FORMAT_VERSIUNE.test(versiune)) {
    throw new EroareCriptografica(
      "versiune_invalida",
      `Versiunea de cheie „${versiune}” nu este validă: se acceptă doar numere întregi (coloana key_version din baza de date este numerică).`,
    );
  }
  const curat = base64.trim();
  if (curat.length === 0 || !FORMAT_BASE64.test(curat)) {
    throw new EroareCriptografica(
      "cheie_invalida",
      `Cheia de criptare cu versiunea „${versiune}” nu este codificată corect în base64.`,
    );
  }
  const octeti = Buffer.from(curat, "base64");
  if (octeti.length !== LUNGIME_CHEIE) {
    throw new EroareCriptografica(
      "cheie_invalida",
      `Cheia de criptare cu versiunea „${versiune}” are ${String(octeti.length)} octeți; AES-256 cere exact 32 de octeți.`,
    );
  }
  return octeti;
}

function incarcaChei(): ReadonlyMap<string, Buffer> {
  if (cheiDecodate !== null) {
    return cheiDecodate;
  }
  const intrari = Object.entries(serverEnv.HR_ENCRYPTION_KEYS).map(
    ([versiune, base64]): readonly [string, Buffer] => [versiune, decodeazaCheie(versiune, base64)],
  );
  if (intrari.length === 0) {
    throw new EroareCriptografica(
      "cheie_lipsa",
      "Nu este configurată nicio cheie de criptare pentru datele de personal. Contactați administratorul platformei.",
    );
  }
  const harta: ReadonlyMap<string, Buffer> = new Map(intrari);
  cheiDecodate = harta;
  return harta;
}

function obtineCheie(versiune: string): Buffer {
  const cheie = incarcaChei().get(versiune);
  if (cheie === undefined) {
    throw new EroareCriptografica(
      "cheie_lipsa",
      `Cheia de criptare cu versiunea „${versiune}” nu mai este configurată. Datele criptate cu ea nu pot fi citite până când cheia nu este pusă la loc.`,
    );
  }
  return cheie;
}

export function versiuneaActiva(): string {
  return serverEnv.HR_ENCRYPTION_ACTIVE_KEY;
}

export function versiuniDisponibile(): readonly string[] {
  return [...incarcaChei().keys()];
}

export function encrypt(plaintext: string, keyVersion?: string): ValoareCriptata {
  if (plaintext.length === 0) {
    throw new EroareCriptografica("valoare_goala", "Nu se poate cripta o valoare goală.");
  }
  const versiune = keyVersion ?? versiuneaActiva();
  const cheie = obtineCheie(versiune);
  const iv = randomBytes(LUNGIME_IV);
  const cifru = createCipheriv(ALGORITM, cheie, iv, { authTagLength: LUNGIME_TAG });
  const ciphertext = Buffer.concat([cifru.update(plaintext, "utf8"), cifru.final()]);
  return { ciphertext, iv, tag: cifru.getAuthTag(), keyVersion: versiune };
}

export function decrypt(valoare: ValoareCriptata): string {
  if (valoare.iv.length !== LUNGIME_IV) {
    throw new EroareCriptografica(
      "format_invalid",
      `Vectorul de inițializare are ${String(valoare.iv.length)} octeți în loc de 12; rândul este corupt.`,
    );
  }
  if (valoare.tag.length !== LUNGIME_TAG) {
    throw new EroareCriptografica(
      "format_invalid",
      `Eticheta de autentificare are ${String(valoare.tag.length)} octeți în loc de 16; rândul este corupt.`,
    );
  }
  if (valoare.ciphertext.length === 0) {
    throw new EroareCriptografica("format_invalid", "Textul criptat este gol; rândul este corupt.");
  }
  const cheie = obtineCheie(valoare.keyVersion);
  const decifru = createDecipheriv(ALGORITM, cheie, valoare.iv, { authTagLength: LUNGIME_TAG });
  decifru.setAuthTag(valoare.tag);
  try {
    return Buffer.concat([decifru.update(valoare.ciphertext), decifru.final()]).toString("utf8");
  } catch {
    throw new EroareCriptografica(
      "autentificare_esuata",
      "Datele criptate nu au putut fi verificate: au fost modificate după salvare sau cheia folosită nu este cea corectă.",
    );
  }
}

/**
 * Amprentă HMAC-SHA256 pentru deduplicare (cnp_hash / iban_hash).
 * Cheia este DISTINCTĂ de cheile AES: un hash simplu peste spațiul CNP-urilor
 * (~10^13 combinații plauzibile) se sparge prin forță brută în câteva ore.
 */
export function amprentaSensibila(valoare: string): string {
  const cheie = Buffer.from(serverEnv.HR_HASH_KEY, "base64");
  if (cheie.length < LUNGIME_MINIMA_CHEIE_HMAC) {
    throw new EroareCriptografica(
      "cheie_invalida",
      "Cheia pentru amprentele de deduplicare are sub 32 de octeți. Contactați administratorul platformei.",
    );
  }
  return createHmac("sha256", cheie).update(valoare, "utf8").digest("hex");
}

/**
 * Transportul `bytea` prin PostgREST.
 *
 * PostgREST serializează `bytea` ca text hexazecimal prefixat cu `\x`. Fără
 * conversie explicită, un `Buffer` ajunge în JSON ca `{"type":"Buffer","data":[…]}`,
 * pe care Postgres îl respinge — sau, mai rău, îl acceptă ca text și stochează
 * reprezentarea în loc de octeți.
 *
 * Aceste două funcții au trăit într-un al doilea modul de criptare, paralel cu
 * acesta. Locul lor este lângă cifrare, nu într-un modul separat pe care cineva
 * îl poate folosi fără ea.
 */
export function catreBytea(valoare: Buffer): string {
  return `\\x${valoare.toString("hex")}`;
}

export function dinBytea(valoare: string | Buffer): Buffer {
  if (Buffer.isBuffer(valoare)) return valoare;
  return Buffer.from(valoare.startsWith("\\x") ? valoare.slice(2) : valoare, "hex");
}

/**
 * Versiunea cheii, ca număr — forma cerută de coloanele `*_key_version int`.
 *
 * În TypeScript versiunea este un șir (cheie într-un dicționar); în schemă este
 * `int`. Conversia se face aici, o singură dată, în loc să fie presărată la
 * fiecare scriere.
 */
export function versiuneCaNumar(versiune: string): number {
  const n = Number(versiune);
  if (!Number.isInteger(n) || n < 1) {
    throw new EroareCriptografica(
      "versiune_invalida",
      `Versiunea de cheie „${versiune}” nu este un număr întreg pozitiv.`,
    );
  }
  return n;
}
