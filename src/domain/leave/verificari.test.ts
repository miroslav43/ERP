// src/domain/leave/verificari.test.ts

import { describe, expect, it } from "vitest";
import {
  autorulPoateRetrage,
  conflictDeEchipa,
  verificaPlafonAnual,
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

describe("plafonul anual legal", () => {
  it("lasă să treacă o cerere care încape exact în plafon", () => {
    // Concediu paternal: 10 zile pe an. 6 consumate, se mai cer 4.
    const r = verificaPlafonAnual(4, 6, 10);
    expect(r.seIncadreaza).toBe(true);
    expect(r.zileDepasire).toBe(0);
    expect(r.zileRamase).toBe(0);
  });

  it("respinge cererea de 300 de zile de concediu paternal", () => {
    // Defectul reparat de 0064: până atunci nimic nu o oprea.
    const r = verificaPlafonAnual(300, 0, 10);
    expect(r.seIncadreaza).toBe(false);
    expect(r.zileDepasire).toBe(290);
  });

  it("numără zilele deja consumate, nu doar cererea curentă", () => {
    // Fiecare cerere de 5 zile trece singură, dar a treia depășește.
    expect(verificaPlafonAnual(5, 0, 10).seIncadreaza).toBe(true);
    expect(verificaPlafonAnual(5, 5, 10).seIncadreaza).toBe(true);
    expect(verificaPlafonAnual(5, 10, 10).seIncadreaza).toBe(false);
    expect(verificaPlafonAnual(5, 10, 10).zileDepasire).toBe(5);
  });

  it("nu plafonează concediul medical — durata o decide certificatul", () => {
    const r = verificaPlafonAnual(180, 90, null);
    expect(r.seIncadreaza).toBe(true);
    expect(r.zileRamase).toBe(Number.POSITIVE_INFINITY);
  });

  it("raportează zilele rămase după cerere", () => {
    const r = verificaPlafonAnual(2, 3, 10);
    expect(r.zileRamase).toBe(5);
  });

  it("nu acumulează eroare de virgulă mobilă pe jumătăți de zi", () => {
    // 0.1 + 0.2 = 0.30000000000000004 fără rotunjire.
    const r = verificaPlafonAnual(0.1, 0.2, 0.3);
    expect(r.seIncadreaza).toBe(true);
    expect(r.zileDepasire).toBe(0);
  });

  it("respinge valori negative", () => {
    expect(() => verificaPlafonAnual(-1, 0, 10)).toThrow(RangeError);
    expect(() => verificaPlafonAnual(1, -2, 10)).toThrow(RangeError);
  });
});

describe("autorulPoateRetrage", () => {
  const AZI = "2026-08-25";

  it("lasă ciorna și cererea trimisă să plece oricând, inclusiv retroactiv", () => {
    expect(autorulPoateRetrage("ciorna", "2020-01-01", AZI)).toBe(true);
    expect(autorulPoateRetrage("trimisa", "2020-01-01", AZI)).toBe(true);
  });

  it("lasă un concediu aprobat care încă nu a început", () => {
    expect(autorulPoateRetrage("aprobata", "2026-08-26", AZI)).toBe(true);
  });

  it("refuză un concediu aprobat chiar în prima lui zi", () => {
    // `>`, nu `>=`: cine e în prima zi de concediu a consumat-o.
    expect(autorulPoateRetrage("aprobata", AZI, AZI)).toBe(false);
  });

  it("refuză un concediu aprobat deja consumat", () => {
    expect(autorulPoateRetrage("aprobata", "2026-08-01", AZI)).toBe(false);
  });

  it("refuză stările terminale, oricât de departe ar fi data", () => {
    for (const status of ["respinsa", "anulata", "intrerupta"]) {
      expect(autorulPoateRetrage(status, "2099-01-01", AZI)).toBe(false);
    }
  });

  it("compară pe an, nu doar pe zi și lună", () => {
    // Capcana comparației lexicografice greșite: „2026-01-05" < „2026-08-25",
    // dar „2027-01-05" > el. Ordinea pe `YYYY-MM-DD` le prinde pe amândouă.
    expect(autorulPoateRetrage("aprobata", "2027-01-05", AZI)).toBe(true);
    expect(autorulPoateRetrage("aprobata", "2026-01-05", AZI)).toBe(false);
  });
});
