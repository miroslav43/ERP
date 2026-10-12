import { curataText } from "./document-tabelar";

/**
 * Curățarea textului care ajunge într-un document generat.
 *
 * ── DE CE ──────────────────────────────────────────────────────────────────
 * Auditul transversal din 8 oct 2026: un U+000B (ruptura de rând manuală din
 * Word, lipită în formular) ajungea neschimbat în `word/document.xml`, iar
 * Word refuza fișierul ca „not well-formed”. Iar „ş”/„ţ” cu sedilă, încă
 * produse de tastaturi vechi și de unele telefoane, treceau în documentul de
 * semnat lângă „ș”/„ț” corecte.
 *
 * Ca buclă, nu ca expresie regulată, din motivul scris în
 * `src/lib/push/mesaj.ts`: `no-control-regex` semnalează pe bună dreptate un
 * interval de caractere de control într-un regex.
 */

/**
 * Fiecare caracter de control (U+0000–U+001F, U+007F) devine un spațiu, ca
 * „Popa⟨VT⟩Ion” să rămână două cuvinte. Restul (U+FFFE/U+FFFF, surogatele
 * orfane, C1, spațiile de lățime zero) îl scoate `curataText` din B2, singura
 * regulă a uneltelor.
 */
export function faraCaractereDeControl(text: string): string {
  let rezultat = "";
  for (const caracter of text) {
    const cod = caracter.codePointAt(0) ?? 0;
    rezultat += cod < 0x20 || cod === 0x7f ? " " : caracter;
  }
  return curataText(rezultat);
}

const CU_VIRGULA: Readonly<Record<string, string>> = {
  ş: "ș", // ş → ș
  Ş: "Ș", // Ş → Ș
  ţ: "ț", // ţ → ț
  Ţ: "Ț", // Ţ → Ț
};

/** „ş”, „ţ” (cu sedilă, U+015F/U+0163 și majusculele) → „ș”, „ț” (cu virgulă). */
export function cuVirgula(text: string): string {
  return text.replace(/[ŞşŢţ]/gu, (litera) => CU_VIRGULA[litera] ?? litera);
}
