import type { DataValidation, PaperSize, Worksheet } from "exceljs";

import { SEMNATURA_FISIER } from "./document-tabelar";

/**
 * Tiparul comun al fișierelor Excel ale uneltelor: hârtie, rânduri de titlu
 * repetate, subsol numerotat, validări și nume de filă.
 *
 * ── DE CE UN FIȘIER SEPARAT DE `xlsx.ts` ──────────────────────────────────
 * `randeazaXlsx` e randarea generică, fără formule. Foaia de pontaj și condica
 * au generatoare proprii, cu formule; tiparul trebuie să fie același la toate,
 * iar celelalte unelte îl pot adopta fără să atingă randarea generică.
 */

/** A4 în codificarea OOXML. `PaperSize` e un `const enum` ambiental: doar tipul se poate folosi. */
const A4 = 9 as PaperSize;

export type OptiuniTipar = Readonly<{
  orientare: "portret" | "peisaj";
  /** Rândurile repetate sus pe fiecare pagină tipărită (capul de tabel). */
  randuriTitlu: Readonly<{ de: number; pana: number }>;
}>;

export function pregatesteTiparXlsx(fila: Worksheet, o: OptiuniTipar): void {
  fila.pageSetup.paperSize = A4;
  fila.pageSetup.orientation = o.orientare === "peisaj" ? "landscape" : "portrait";
  fila.pageSetup.fitToPage = true;
  fila.pageSetup.fitToWidth = 1;
  fila.pageSetup.fitToHeight = 0;
  fila.pageSetup.printTitlesRow = `${String(o.randuriTitlu.de)}:${String(o.randuriTitlu.pana)}`;
  // &L / &R = stânga / dreapta, &8 = 8 pt, &P / &N = pagina / numărul de pagini.
  fila.headerFooter.oddFooter = `&L&8${SEMNATURA_FISIER}&R&8Pagina &P din &N`;
}

/**
 * Numele unei file: Excel refuză `* ? : \ / [ ]`, un apostrof la capete, peste
 * 31 de caractere, „History” și un nume repetat (fără să țină cont de
 * majuscule). Toate apar în practică într-o listă de angajați lipită din altă
 * parte — „O'Neil”, „Ana/Maria”, doi „Popa Ion”.
 */
export function numeFilaSigur(dorit: string, folosite: Set<string>): string {
  const curat = dorit
    .replace(/[*?:/\\[\]]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 31)
    // Apostrofii și spațiile de la capete se scot împreună: „' 'Ion” scos doar de
    // apostrofi rămânea „'Ion”, iar ExcelJS aruncă (ruta ar fi dat 500).
    .replace(/^[\s']+|[\s']+$/gu, "");
  const baza = curat === "" ? "Fișă" : curat.toLowerCase() === "history" ? "Fișă History" : curat;
  let nume = baza;
  for (let k = 2; folosite.has(nume.toLowerCase()); k += 1) {
    const sufix = ` (${String(k)})`;
    nume = `${baza.slice(0, 31 - sufix.length).trimEnd()}${sufix}`;
  }
  folosite.add(nume.toLowerCase());
  return nume;
}

/**
 * Lista de coduri ca validare. `strict: false` lasă săgeata cu coduri, dar
 * primește și cifre — celula de zi a foii colective ține ori ore, ori un cod.
 * `strict: true` e pentru coloana „Cod” a fișei individuale, unde cifrele n-au
 * ce căuta.
 */
export function validareCoduri(coduri: readonly string[], strict: boolean): DataValidation {
  const formulae = [`"${coduri.join(",")}"`];
  return strict
    ? {
        type: "list",
        allowBlank: true,
        formulae,
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Cod necunoscut",
        error: `Folosește un cod din legendă: ${coduri.join(", ")}.`,
      }
    : { type: "list", allowBlank: true, formulae, showErrorMessage: false };
}

/**
 * O oră din zi e, pentru Excel, o fracție de zi. „8:00” trece (0,333); „8”
 * scris fără două puncte înseamnă opt ZILE și ar da ore lucrate aberante.
 */
export const VALIDARE_ORA: DataValidation = {
  type: "decimal",
  operator: "between",
  allowBlank: true,
  formulae: [0, 0.99999],
  showErrorMessage: true,
  errorStyle: "stop",
  errorTitle: "Oră invalidă",
  error: "Scrie ora cu două puncte, de exemplu 8:00 sau 17:30.",
};

/** Orele suplimentare sau de noapte ale unei zile, ca durată: „2:00”, nu „2”. */
export const VALIDARE_DURATA: DataValidation = {
  ...VALIDARE_ORA,
  errorTitle: "Durată invalidă",
  error: "Scrie durata cu două puncte, de exemplu 2:00 sau 0:30.",
};

export const VALIDARE_PAUZA: DataValidation = {
  type: "whole",
  operator: "between",
  allowBlank: true,
  formulae: [0, 600],
  showErrorMessage: true,
  errorStyle: "stop",
  errorTitle: "Pauză invalidă",
  error: "Scrie pauza în minute, un număr între 0 și 600.",
};
