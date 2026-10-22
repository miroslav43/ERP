// src/domain/fleet/carduri/limite.ts
//
// Limitele importului de extras de card, citite ȘI de componenta client
// (înainte de urcare) ȘI de acțiune (înainte de parsare). Fișier FĂRĂ
// `exceljs`: `src/lib/import/excel.ts` îl trage după el, iar componenta
// client nu are ce căuta cu el în pachet.

export const LIMITA_EXTRAS_BYTES = 5 * 1024 * 1024; // 5 MB, ca importul de angajați
/** = `LIMITA_RANDURI` din `src/lib/import/excel.ts` (fixat de `limite.test.ts`). */
export const LIMITA_RANDURI_EXTRAS = 1000;
/** Cel mult atâtea zile între prima și ultima tranzacție (CHECK `fci_perioada_ck`). */
export const PERIOADA_MAXIMA_ZILE = 93;
/** Rânduri scrise într-o singură invocare a acțiunii de aplicare. */
export const FELIE_APLICARE = 100;
/** Rândurile arătate în previzualizare. */
export const RANDURI_PREVIZUALIZARE = 50;

/**
 * `.txt` și `.xlsm` NU: n-au MIME în `allowed_mime_types` al bucket-ului
 * `org-documents` (0002), deci urcarea ar cădea. `.xls` (Excel 97) nu-l citește
 * `exceljs`.
 */
export const EXTENSII_EXTRAS = [".csv", ".xlsx"] as const;
export type ExtensieExtras = (typeof EXTENSII_EXTRAS)[number];

/**
 * Tipul cu care clientul REAMBALEAZĂ fișierul înainte de urcare. Pe Windows cu
 * Excel instalat, browserul declară un `.csv` ca `application/vnd.ms-excel`,
 * care nu e în lista bucket-ului; urcarea ar cădea fără să spună de ce.
 */
export const MIME_PENTRU_EXTENSIE: Readonly<Record<ExtensieExtras, string>> = {
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function extensieExtras(numeFisier: string): ExtensieExtras | null {
  const nume = numeFisier.toLowerCase();
  return EXTENSII_EXTRAS.find((ext) => nume.endsWith(ext)) ?? null;
}

/** Verificare identică pe client și pe server. `null` = fișierul poate pleca. */
export function verificaFisierExtras(numeFisier: string, dimensiune: number): string | null {
  const nume = numeFisier.toLowerCase();
  if (nume.endsWith(".xls")) {
    return "Fișierele Excel 97 (.xls) nu se pot citi. Salvați extrasul ca .xlsx sau .csv și încercați din nou.";
  }
  if (extensieExtras(nume) === null) {
    return "Acceptăm extrase .csv sau .xlsx. Salvați fișierul într-unul dintre aceste formate.";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  if (dimensiune > LIMITA_EXTRAS_BYTES) {
    return `Fișierul depășește ${String(LIMITA_EXTRAS_BYTES / 1024 / 1024)} MB. Împărțiți extrasul pe perioade mai scurte.`;
  }
  return null;
}
