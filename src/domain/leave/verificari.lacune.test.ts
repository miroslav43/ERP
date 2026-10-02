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

  // Un interval cu oră (06:00Z) nu poate apărea: intervalele vin din coloane
  // `date` (leave_requests.data_inceput/data_sfarsit), parsate la miezul nopții
  // UTC. Iar `conflictDeEchipa` nu are azi niciun apelant. Dacă primește unul
  // cu date cu oră, comparația pe zi normalizată trebuie revăzută.
});
