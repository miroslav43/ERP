// src/domain/reges/absente.test.ts
import { describe, expect, it } from "vitest";

import { PRAG_ZILE_ALERTA, seriiDeAbsente, type ZiPontaj } from "./absente";

const A = "angajat-a";
const B = "angajat-b";

function zi(data: string, tipZi: string, employeeId = A, oreLucrate = 0): ZiPontaj {
  return { employeeId, data, tipZi, oreLucrate };
}

describe("seriiDeAbsente", () => {
  it("nu semnalează o singură zi de absență", () => {
    const serii = seriiDeAbsente([
      zi("2026-03-02", "absenta_nemotivata"),
      zi("2026-03-03", "lucratoare"),
    ]);

    expect(serii).toStrictEqual([]);
  });

  it("semnalează de la a doua zi consecutivă", () => {
    const serii = seriiDeAbsente([
      zi("2026-03-02", "absenta_nemotivata"),
      zi("2026-03-03", "absenta_nemotivata"),
    ]);

    expect(serii).toStrictEqual([
      { employeeId: A, dataInceput: "2026-03-02", dataSfarsit: "2026-03-03", zile: 2 },
    ]);
  });

  it("weekendul nelucrat nu rupe seria: vineri + luni sunt două zile la rând", () => {
    const serii = seriiDeAbsente([
      zi("2026-03-06", "absenta_nemotivata"),
      zi("2026-03-07", "weekend"),
      zi("2026-03-08", "weekend"),
      zi("2026-03-09", "absenta_nemotivata"),
    ]);

    expect(serii).toHaveLength(1);
    expect(serii[0]).toMatchObject({
      dataInceput: "2026-03-06",
      dataSfarsit: "2026-03-09",
      zile: 2,
    });
  });

  it("un weekend LUCRAT rupe seria — omul a venit", () => {
    const serii = seriiDeAbsente([
      zi("2026-03-06", "absenta_nemotivata"),
      zi("2026-03-07", "weekend", A, 8),
      zi("2026-03-09", "absenta_nemotivata"),
    ]);

    expect(serii).toStrictEqual([]);
  });

  it("o zi de concediu între absențe rupe seria", () => {
    const serii = seriiDeAbsente([
      zi("2026-03-02", "absenta_nemotivata"),
      zi("2026-03-03", "concediu"),
      zi("2026-03-04", "absenta_nemotivata"),
    ]);

    expect(serii).toStrictEqual([]);
  });

  it("o zi de concediu medical rupe seria la fel", () => {
    const serii = seriiDeAbsente([
      zi("2026-03-02", "absenta_nemotivata"),
      zi("2026-03-03", "absenta_nemotivata"),
      zi("2026-03-04", "medical"),
      zi("2026-03-05", "absenta_nemotivata"),
      zi("2026-03-06", "absenta_nemotivata"),
    ]);

    expect(serii.map((s) => [s.dataInceput, s.dataSfarsit])).toStrictEqual([
      ["2026-03-02", "2026-03-03"],
      ["2026-03-05", "2026-03-06"],
    ]);
  });

  it("nu amestecă angajați: seria unuia nu o continuă pe a altuia", () => {
    const serii = seriiDeAbsente([
      zi("2026-03-02", "absenta_nemotivata", A),
      zi("2026-03-03", "absenta_nemotivata", B),
      zi("2026-03-04", "absenta_nemotivata", B),
    ]);

    expect(serii).toStrictEqual([
      { employeeId: B, dataInceput: "2026-03-03", dataSfarsit: "2026-03-04", zile: 2 },
    ]);
  });

  it("nu depinde de ordinea în care vin zilele", () => {
    const amestecate = [
      zi("2026-03-04", "absenta_nemotivata"),
      zi("2026-03-02", "absenta_nemotivata"),
      zi("2026-03-03", "absenta_nemotivata"),
    ];

    expect(seriiDeAbsente(amestecate)).toStrictEqual([
      { employeeId: A, dataInceput: "2026-03-02", dataSfarsit: "2026-03-04", zile: 3 },
    ]);
  });

  it("închide seria și la sfârșitul lunii, nu doar la o zi care o rupe", () => {
    const serii = seriiDeAbsente([
      zi("2026-03-30", "absenta_nemotivata"),
      zi("2026-03-31", "absenta_nemotivata"),
    ]);

    expect(serii).toHaveLength(1);
  });

  it("pragul e configurabil, iar implicitul e doi", () => {
    const oZi = [zi("2026-03-02", "absenta_nemotivata")];

    expect(PRAG_ZILE_ALERTA).toBe(2);
    expect(seriiDeAbsente(oZi)).toStrictEqual([]);
    expect(seriiDeAbsente(oZi, 1)).toHaveLength(1);
  });
});
