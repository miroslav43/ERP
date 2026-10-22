// src/domain/fleet/contabil/cote-tva.ts
//
// Cota STANDARD de TVA după data documentului (F12g, decizia L9).
//
// Cotele se schimbă prin lege, nu prin setări, deci stau aici, cu sursa. Luna
// august 2025 are ambele cote: fiecare document primește cota zilei lui.
//
// ── SURSELE (verificate pe 12 oct 2026, specificația F12g, E16) ─────────────
// Codul fiscal (Legea 227/2015), art. 291 alin. (1):
//   · 19% de la 01.01.2017 — consolidarea din 04.04.2025,
//     https://legislatie.just.ro/Public/DetaliiDocument/296079
//   · 21% de la 01.08.2025 (Legea 141/2025) — consolidarea din 08.08.2026,
//     https://legislatie.just.ro/Public/DetaliiDocument/312601
//
// O dată dinaintea primei intrări NU primește o cotă ghicită: apelantul o
// raportează ca problemă blocantă, iar ruta nu emite fișierul.
import type { DateString } from "@/lib/format/date";

export interface CotaTva {
  /** Prima zi în care se aplică, `AAAA-LL-ZZ`. */
  readonly deLa: DateString;
  /** Procentul, ca întreg: 21 = 21%. */
  readonly procent: number;
}

/** În ordine crescătoare a datei. */
export const COTE_TVA_STANDARD: readonly CotaTva[] = [
  { deLa: "2017-01-01", procent: 19 },
  { deLa: "2025-08-01", procent: 21 },
];

/** Procentul cotei standard în ziua `data`, sau `null` înaintea primei intrări din tabel. */
export function cotaTvaLa(data: DateString): number | null {
  let gasita: number | null = null;
  for (const cota of COTE_TVA_STANDARD) {
    if (cota.deLa <= data) gasita = cota.procent;
  }
  return gasita;
}
