// src/domain/fleet/carduri/text.ts
//
// Normalizarea textelor din extrasul de card, ÎNAINTEA cheii de dedup.
//
// Un CSV salvat de Excel în „ANSI” românesc e Windows-1250, iar pagina aceea de
// cod n-are ș/ț cu virgulă: octeții 0xBA/0xFE ies „ş”/„ţ” cu SEDILĂ (verificat
// empiric, F12b §4). Același rând citit o dată din UTF-8 și o dată din ANSI ar
// da altfel două chei de dedup diferite, deci reimportul ar dubla tranzacția.

import { cuVirgula } from "@/lib/text/diacritice";

/** Trim, spațiile multiple (inclusiv NBSP și spațiul îngust) strânse, sedila → virgula. */
export function normalizeazaText(text: string): string {
  return cuVirgula(text)
    .replace(/[\s  ]+/gu, " ")
    .trim();
}

/**
 * Numărul de înmatriculare, EXACT ca `internal.vehicles_normalizeaza` (0012):
 * `upper` + tot ce nu e `[A-Za-z0-9]` scos. „b-100-xyz” → „B100XYZ”. Altfel
 * numărul din extras n-ar mai găsi vehiculul din parc.
 */
export function normalizeazaNrAuto(text: string): string {
  return text.replace(/[^A-Za-z0-9]/gu, "").toUpperCase();
}
