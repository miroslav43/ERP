// src/domain/reges/validare.lacune.test.ts
//
// Lacuna confirmată de audit: CNP-ul e verificat doar cu tiparul de 13 cifre,
// fără cifra de control, deși `src/domain/employee/cnp.ts` o calculează.

import { describe, expect, it } from "vitest";

import { cifraControlCnp } from "@/domain/employee/cnp";

import type { SalariatIntern } from "./mapare";
import { verificaSalariat } from "./validare";

function salariat(cnp: string): SalariatIntern {
  return {
    cnp,
    nume: "Popescu",
    prenume: "Ion",
    adresa: "Strada Morii 12, Cluj-Napoca",
    taraDomiciliu: "România",
    tipActIdentitate: "CarteIdentitate",
    nationalitate: "Română",
    dataNasterii: "1990-01-01",
    localitate: "Cluj-Napoca",
    regesSalariatId: null,
  };
}

describe("verificaSalariat — cifra de control a CNP-ului", () => {
  it("fixtura e corectă: pentru 190010107001 cifra de control e 5", () => {
    // Ponderi 279146358279: 2+63+0+0+4+0+3+0+56+0+0+9 = 137, iar 137 mod 11 = 5.
    expect(cifraControlCnp("190010107001")).toBe(5);
  });

  it("un CNP cu cifra de control corectă nu ridică nicio problemă", () => {
    expect(verificaSalariat(salariat("1900101070015"))).toEqual([]);
  });

  it("un CNP care nu are 13 cifre e semnalat", () => {
    expect(verificaSalariat(salariat("190010107001")).map((p) => p.camp)).toEqual(["cnp"]);
  });

  // Antetul `validare.ts`: un mesaj cu conținut greșit „primește recipisă și e
  // refuzat abia ASINCRON”, cu termenul legal curgând — de aceea se verifică
  // local tot ce e verificabil fără regulile de fond ale ITM. Cifra de control
  // e un astfel de format; `verificaSalariat` se oprește la tipar.
  it.fails("DEFECT: un CNP cu cifra de control greșită e oprit înainte să plece", () => {
    expect(verificaSalariat(salariat("1900101070016")).map((p) => p.camp)).toEqual(["cnp"]);
  });
});
