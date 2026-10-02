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

  // Cifra de control NU se verifică aici, deliberat: toate căile care scriu un
  // CNP o verifică deja (schemas/employee.ts prin `validateazaCnp`, importul
  // Excel prin `areCnpCifraControlValida`), deci un CNP invalid nu ajunge în
  // `employee_sensitive_data`. `verificaSalariat` verifică doar tiparul din XSD.
  it("un CNP cu tipar valid trece, oricare i-ar fi cifra de control (verificată la scriere)", () => {
    expect(verificaSalariat(salariat("1900101070016"))).toEqual([]);
  });
});
