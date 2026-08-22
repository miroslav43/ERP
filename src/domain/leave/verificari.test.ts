// src/domain/leave/verificari.test.ts

import { describe, expect, it } from "vitest";
import {
  conflictDeEchipa,
  verificaSold,
  verificaSuprapunere,
  type CerereEchipa,
  type IntervalConcediu,
} from "./verificari";

function zi(an: number, luna: number, ziua: number): Date {
  return new Date(Date.UTC(an, luna - 1, ziua));
}

function interval(
  inceput: [number, number, number],
  sfarsit: [number, number, number],
): IntervalConcediu {
  return { dataInceput: zi(...inceput), dataSfarsit: zi(...sfarsit) };
}

describe("verificaSuprapunere", () => {
  it("detectează suprapunerea completă a două intervale identice", () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    const existente = [interval([2026, 3, 10], [2026, 3, 14])];
    expect(verificaSuprapunere(nou, existente)).toBe(true);
  });

  it("detectează suprapunerea parțială la început", () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    const existente = [interval([2026, 3, 5], [2026, 3, 10])];
    expect(verificaSuprapunere(nou, existente)).toBe(true);
  });

  it("detectează suprapunerea parțială la sfârșit", () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    const existente = [interval([2026, 3, 14], [2026, 3, 20])];
    expect(verificaSuprapunere(nou, existente)).toBe(true);
  });

  it("nu semnalează conflict pentru intervale adiacente, dar neintersectate", () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    const existente = [interval([2026, 3, 15], [2026, 3, 20])];
    expect(verificaSuprapunere(nou, existente)).toBe(false);
  });

  it("nu semnalează conflict când nu există nicio cerere existentă", () => {
    const nou = interval([2026, 3, 10], [2026, 3, 14]);
    expect(verificaSuprapunere(nou, [])).toBe(false);
  });

  it("respinge un interval inversat", () => {
    const nouInvalid = interval([2026, 3, 14], [2026, 3, 10]);
    expect(() => verificaSuprapunere(nouInvalid, [])).toThrow(RangeError);
  });
});

describe("verificaSold", () => {
  it("semnalează sold suficient când zilele disponibile acoperă cererea", () => {
    expect(verificaSold(5, 10)).toEqual({ areSoldSuficient: true, zileLipsa: 0 });
  });

  it("semnalează sold suficient la egalitate exactă", () => {
    expect(verificaSold(10, 10)).toEqual({ areSoldSuficient: true, zileLipsa: 0 });
  });

  it("calculează zilele lipsă când soldul e insuficient", () => {
    expect(verificaSold(12.5, 10)).toEqual({ areSoldSuficient: false, zileLipsa: 2.5 });
  });

  it("respinge un număr de zile solicitate negativ", () => {
    expect(() => verificaSold(-1, 10)).toThrow(RangeError);
  });
});

describe("conflictDeEchipa", () => {
  const echipa: readonly CerereEchipa[] = [
    { angajatId: "a1", dataInceput: zi(2026, 7, 6), dataSfarsit: zi(2026, 7, 10) },
    { angajatId: "a2", dataInceput: zi(2026, 7, 8), dataSfarsit: zi(2026, 7, 12) },
  ];

  it("nu semnalează conflict sub prag", () => {
    // zilele 6-7: cel mult 1 coleg (a1) + cererea nouă = 2 <= prag 3
    const nou = interval([2026, 7, 6], [2026, 7, 7]);
    expect(conflictDeEchipa(nou, echipa, 3)).toBe(false);
  });

  it("nu semnalează conflict exact la prag", () => {
    // ziua 8: a1 + a2 + cererea nouă = 3, prag 3 -> fără conflict
    const nou = interval([2026, 7, 8], [2026, 7, 8]);
    expect(conflictDeEchipa(nou, echipa, 3)).toBe(false);
  });

  it("semnalează conflict când pragul e depășit", () => {
    // ziua 8: a1 + a2 + cererea nouă = 3, prag 2 -> conflict
    const nou = interval([2026, 7, 8], [2026, 7, 8]);
    expect(conflictDeEchipa(nou, echipa, 2)).toBe(true);
  });

  it("respinge un prag mai mic decât 1", () => {
    const nou = interval([2026, 7, 6], [2026, 7, 7]);
    expect(() => conflictDeEchipa(nou, echipa, 0)).toThrow(RangeError);
  });

  it("respinge un interval inversat", () => {
    const nouInvalid = interval([2026, 7, 10], [2026, 7, 6]);
    expect(() => conflictDeEchipa(nouInvalid, echipa, 2)).toThrow(RangeError);
  });
});
