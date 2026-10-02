// src/domain/leave/verificari.lacune.test.ts
//
// Lacuna confirmată de audit: `conflictDeEchipa` normalizează la zi doar
// intervalul cererii noi, nu și pe ale colegilor. Funcția nu are azi apelanți
// în producție; testul o păzește pentru primul.

import { describe, expect, it } from "vitest";

import { conflictDeEchipa } from "./verificari";

const ZIUA = new Date("2026-07-08T00:00:00Z");
const CERERE_NOUA = { dataInceput: ZIUA, dataSfarsit: ZIUA };

describe("conflictDeEchipa — un coleg absent în aceeași zi", () => {
  it("un coleg cu intervalul la miezul nopții UTC e numărat: 2 absenți > pragul 1", () => {
    const coleg = { angajatId: "c1", dataInceput: ZIUA, dataSfarsit: ZIUA };
    expect(conflictDeEchipa(CERERE_NOUA, [coleg], 1)).toBe(true);
    expect(conflictDeEchipa(CERERE_NOUA, [coleg], 2)).toBe(false);
  });

  // Documentația funcției: numără absenții simultani „în oricare zi a
  // intervalului”. verificari.ts:155-159 compară ziua normalizată (00:00Z) cu
  // intervalul colegului ne-normalizat; un interval care începe la 06:00Z în
  // aceeași zi nu o „acoperă”, deci colegul nu e numărat.
  it.fails("DEFECT: colegul absent în aceeași zi e numărat, oricare ar fi ora intervalului", () => {
    const ora6 = new Date("2026-07-08T06:00:00Z");
    const coleg = { angajatId: "c1", dataInceput: ora6, dataSfarsit: ora6 };
    expect(conflictDeEchipa(CERERE_NOUA, [coleg], 1)).toBe(true);
  });
});
