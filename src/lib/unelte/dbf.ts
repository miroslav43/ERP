// src/lib/unelte/dbf.ts
//
// Scrierea unui fișier dBase III (`.dbf`), pentru importul în programele de
// contabilitate care îl cer (Saga: articolele contabile, F12g). Pur, fără
// `server-only`: octeții se construiesc în memorie.
//
// ── FORMATUL ────────────────────────────────────────────────────────────────
// „Xbase File Format Description”, https://www.clicketyclick.dk/databases/xbase/format/dbf.html
// (documentație secundară, nu specificația dBase Inc.):
//   antet de 32 de octeți — [0] versiunea 0x03; [1..3] data actualizării (an−1900,
//   lună, zi); [4..7] numărul de înregistrări (uint32 LE); [8..9] lungimea
//   antetului (uint16 LE) = 32 + 32·n + 1; [10..11] lungimea înregistrării
//   (uint16 LE) = 1 + Σ lungimi; restul zero;
//   câte un descriptor de 32 de octeți per câmp — numele ASCII (cel mult 10,
//   completat cu zero), [11] tipul, [16] lungimea, [17] zecimalele;
//   terminatorul 0x0D; înregistrările, fiecare cu octetul de ștergere 0x20 (vie);
//   sfârșitul de fișier 0x1A.
//
// ── DE CE ARUNCĂ ÎN LOC SĂ TAIE ─────────────────────────────────────────────
// Câmpurile au lungime fixă în OCTEȚI. Un text tăiat tăcut sau o literă de doi
// octeți ar muta toate câmpurile următoare ale înregistrării. Apelantul își
// pregătește textul (`inAscii(…, lungime)`); aici doar se verifică.

export type CampDbf =
  | { readonly nume: string; readonly tip: "C"; readonly lungime: number }
  | {
      readonly nume: string;
      readonly tip: "N";
      readonly lungime: number;
      readonly zecimale: number;
    }
  | { readonly nume: string; readonly tip: "D" };

/** O valoare de câmp: text (C), număr (N), zi `AAAA-LL-ZZ` (D) sau `null` (spații). */
export type ValoareDbf = string | number | null;

const LUNGIME_DATA = 8;

function lungimeCamp(c: CampDbf): number {
  return c.tip === "D" ? LUNGIME_DATA : c.lungime;
}

function verificaAscii(text: string, unde: string): void {
  for (const ch of text) {
    const cod = ch.charCodeAt(0);
    if (ch.length !== 1 || cod < 0x20 || cod > 0x7e) {
      throw new RangeError(`${unde}: caracterul „${ch}” nu e ASCII tipăribil.`);
    }
  }
}

function valoareCamp(c: CampDbf, v: ValoareDbf, rand: number): string {
  const lungime = lungimeCamp(c);
  const unde = `Rândul ${String(rand + 1)}, câmpul ${c.nume}`;
  if (v === null) return " ".repeat(lungime);
  if (c.tip === "C") {
    if (typeof v !== "string") throw new TypeError(`${unde}: se aștepta text.`);
    verificaAscii(v, unde);
    if (v.length > lungime) {
      throw new RangeError(`${unde}: ${String(v.length)} caractere, peste ${String(lungime)}.`);
    }
    return v.padEnd(lungime, " ");
  }
  if (c.tip === "N") {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new TypeError(`${unde}: se aștepta un număr.`);
    }
    const text = v.toFixed(c.zecimale);
    if (text.length > lungime) {
      throw new RangeError(`${unde}: ${text} nu încape în ${String(lungime)} caractere.`);
    }
    return text.padStart(lungime, " ");
  }
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(v)) {
    throw new TypeError(`${unde}: se aștepta o zi AAAA-LL-ZZ.`);
  }
  return v.replace(/-/gu, "");
}

/** Octeții fișierului `.dbf`, cu înregistrările în ordinea primită. */
export function scrieDbf(
  campuri: readonly CampDbf[],
  randuriDbf: readonly (readonly ValoareDbf[])[],
  dataActualizare: string,
): Uint8Array {
  const [an = 0, luna = 0, zi = 0] = dataActualizare.split("-").map(Number);
  const lungimeAntet = 32 + 32 * campuri.length + 1;
  const lungimeInregistrare = 1 + campuri.reduce((s, c) => s + lungimeCamp(c), 0);
  const total = lungimeAntet + lungimeInregistrare * randuriDbf.length + 1;
  const octeti = new Uint8Array(total);
  const vedere = new DataView(octeti.buffer);

  octeti[0] = 0x03;
  octeti[1] = an - 1900;
  octeti[2] = luna;
  octeti[3] = zi;
  vedere.setUint32(4, randuriDbf.length, true);
  vedere.setUint16(8, lungimeAntet, true);
  vedere.setUint16(10, lungimeInregistrare, true);

  campuri.forEach((c, i) => {
    verificaAscii(c.nume, `Câmpul ${c.nume}`);
    if (c.nume.length === 0 || c.nume.length > 10) {
      throw new RangeError(`Numele câmpului „${c.nume}” are între 1 și 10 caractere.`);
    }
    const start = 32 + 32 * i;
    for (let k = 0; k < c.nume.length; k += 1) octeti[start + k] = c.nume.charCodeAt(k);
    octeti[start + 11] = c.tip.charCodeAt(0);
    octeti[start + 16] = lungimeCamp(c);
    octeti[start + 17] = c.tip === "N" ? c.zecimale : 0;
  });
  octeti[lungimeAntet - 1] = 0x0d;

  randuriDbf.forEach((rand, r) => {
    if (rand.length !== campuri.length) {
      throw new RangeError(
        `Rândul ${String(r + 1)} are ${String(rand.length)} valori, nu ${String(campuri.length)}.`,
      );
    }
    let pozitie = lungimeAntet + lungimeInregistrare * r;
    octeti[pozitie] = 0x20;
    pozitie += 1;
    campuri.forEach((c, i) => {
      const text = valoareCamp(c, rand[i] ?? null, r);
      for (let k = 0; k < text.length; k += 1) octeti[pozitie + k] = text.charCodeAt(k);
      pozitie += text.length;
    });
  });
  octeti[total - 1] = 0x1a;
  return octeti;
}
