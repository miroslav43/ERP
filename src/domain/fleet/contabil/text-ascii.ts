// src/domain/fleet/contabil/text-ascii.ts
//
// Textul care ajunge în programul de contabilitate (Saga, WinMentor), adus la
// ASCII tipăribil (F12g, decizia L7).
//
// ── DE CE ASCII ─────────────────────────────────────────────────────────────
// Nicio sursă publică nu spune ce codificare așteaptă Saga sau WinMentor în
// fișierele de import (specificația F12g, E21). ASCII se citește la fel în
// Windows-1250, Windows-1252 și UTF-8. O diacritică codificată greșit strică o
// explicație; într-un DBF, unde câmpul are lungime fixă în OCTEȚI, o literă de
// doi octeți mută toate câmpurile următoare.
//
// Jurnalul CSV, citit de un om, rămâne UTF-8 cu diacritice: el nu trece pe aici.
import { faraDiacritice } from "@/lib/text/diacritice";

/**
 * `ș ț ş ţ ă â î` → `s t s t a a i`, ghilimelele „ ” → `"`, liniuțele lungi →
 * `-`, linii noi și taburi → un spațiu; orice alt caracter din afara
 * 0x20–0x7E dispare. Cu `lungimeMaxima`, tăierea se face DUPĂ transliterare.
 */
export function inAscii(text: string, lungimeMaxima?: number): string {
  const curat = faraDiacritice(
    text
      .replace(/[„”“«»]/gu, '"')
      .replace(/[‚‘’]/gu, "'")
      .replace(/[–—]/gu, "-")
      .replace(/[\r\n\t]+/gu, " "),
  )
    .replace(/[^\x20-\x7E]/gu, "")
    .replace(/ {2,}/gu, " ")
    .trim();
  return lungimeMaxima === undefined ? curat : curat.slice(0, lungimeMaxima).trimEnd();
}

/** `;` e separatorul de câmp în WinMentor și în articolele CSV: în text devine `,`. */
export function faraPunctSiVirgula(text: string): string {
  return text.replace(/;/gu, ",");
}
