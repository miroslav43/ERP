// src/domain/fleet/contabil/formate.ts
//
// Formatele exportului contabil al flotei (F12g). Separat de `fisiere.ts` ca
// schema și formularul din browser să nu tragă după ele scrierea fișierelor.

export const FORMATE_EXPORT = ["jurnal_csv", "articole_csv", "winmentor", "saga"] as const;
export type FormatExport = (typeof FORMATE_EXPORT)[number];
