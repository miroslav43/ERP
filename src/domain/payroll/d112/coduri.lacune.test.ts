// src/domain/payroll/d112/coduri.lacune.test.ts
//
// Lacuna confirmată de audit: `tipContractD112` (câmpul A_3 din D112) nu avea
// niciun test.

import { describe, expect, it } from "vitest";

import { normaZilnicaD112, tipContractD112 } from "./coduri";

describe("tipContractD112 — normă întreagă sau timp parțial", () => {
  it.each([
    { ore: 8, norma: 8, asteptat: "N" },
    { ore: 9, norma: 8, asteptat: "N" },
    { ore: 6, norma: 6, asteptat: "N" },
    { ore: 4, norma: normaZilnicaD112(4), asteptat: "P4" },
    { ore: 2, norma: 8, asteptat: "P2" },
    { ore: 0.2, norma: 8, asteptat: "P1" },
  ])("$ore h/zi la norma de $norma h → $asteptat", ({ ore, norma, asteptat }) => {
    expect(tipContractD112(ore, norma)).toBe(asteptat);
  });

  it("norma de 4 ore se declară în A_4 ca 6, iar timpul parțial rămâne în A_3", () => {
    expect(normaZilnicaD112(4)).toBe(6);
    expect(tipContractD112(4, normaZilnicaD112(4))).toBe("P4");
  });

  // Documentația funcției: „pentru timp parțial, P + numărul de ore, unde orele
  // sunt MAI PUȚINE decât norma zilnică”. Math.round(7,5) = 8 (coduri.ts:75)
  // urcă un contract de 7,5 h la nivelul normei și îl declară normă întreagă.
  //
  // Separat, apelantul (src/app/api/export/salarizare/d112/route.ts:182) îi dă
  // ore LUCRATE / (zile calendaristice × 5/7): un angajat cu normă întreagă care
  // are CO sau CM în lună iese declarat part-time. Tipul ar trebui luat din
  // norma contractului, nu din orele lunii.
  it("un contract de 7,5 h pe zi, la norma de 8, e timp parțial", () => {
    expect(tipContractD112(7.5, 8)).toBe("P7");
  });
});
