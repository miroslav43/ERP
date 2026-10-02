// src/domain/reges/absente.lacune.test.ts
//
// Lacuna confirmată de audit: zilele lucrătoare FĂRĂ niciun rând de pontaj.
// Antetul `absente.ts` cere apelantului TOATE zilele lunii: „fără zilele dintre
// ele n-ar exista niciun criteriu de rupere, iar două absențe la distanță de
// trei săptămâni ar apărea ca o serie de două”. Funcția nu are calendar, deci
// rupe doar pe rânduri existente — e contractul ei, fixat mai jos.
//
// Apelantul din producție (src/lib/queries/attendance.ts:1002) trimite însă
// doar rândurile existente ale perioadei, fără să umple zilele nepontate, deci
// exact scenariul de mai jos ajunge la alerta de suspendare transmisă la ITM.
// Acela e locul de reparat și de testat.

import { describe, expect, it } from "vitest";

import { seriiDeAbsente, type ZiPontaj } from "./absente";

function zi(data: string, tipZi: string, oreLucrate = 0): ZiPontaj {
  return { employeeId: "a", data, tipZi, oreLucrate };
}

describe("seriiDeAbsente — zile lucrătoare fără rând de pontaj", () => {
  it("două absențe la trei săptămâni distanță, fără rânduri între ele, fac azi o serie de două", () => {
    expect(
      seriiDeAbsente([
        zi("2026-03-02", "absenta_nemotivata"),
        zi("2026-03-23", "absenta_nemotivata"),
      ]),
    ).toEqual([{ employeeId: "a", dataInceput: "2026-03-02", dataSfarsit: "2026-03-23", zile: 2 }]);
  });

  it("aceleași două absențe, cu o zi lucrată între ele, nu fac nicio serie", () => {
    expect(
      seriiDeAbsente([
        zi("2026-03-02", "absenta_nemotivata"),
        zi("2026-03-10", "lucrat", 8),
        zi("2026-03-23", "absenta_nemotivata"),
      ]),
    ).toEqual([]);
  });

  it("un weekend nelucrat între vineri și luni nu rupe seria", () => {
    expect(
      seriiDeAbsente([
        zi("2026-03-06", "absenta_nemotivata"),
        zi("2026-03-07", "weekend"),
        zi("2026-03-08", "weekend"),
        zi("2026-03-09", "absenta_nemotivata"),
      ]),
    ).toEqual([{ employeeId: "a", dataInceput: "2026-03-06", dataSfarsit: "2026-03-09", zile: 2 }]);
  });
});
