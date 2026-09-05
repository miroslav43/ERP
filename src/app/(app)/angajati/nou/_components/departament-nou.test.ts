// src/app/(app)/angajati/nou/_components/departament-nou.test.ts
import { describe, expect, it } from "vitest";

import { codDinDenumire } from "./departament-nou";

describe("codDinDenumire", () => {
  it("majuscule și cratime în loc de spații", () => {
    expect(codDinDenumire("Producție și logistică")).toBe("PRODUCTIE-SI-LOGISTICA");
  });

  it("pierde diacriticele — codul e un identificator tastat, nu un text afișat", () => {
    expect(codDinDenumire("Resurse Umane")).toBe("RESURSE-UMANE");
    expect(codDinDenumire("Întreținere")).toBe("INTRETINERE");
  });

  it("nu lasă cratime la capete", () => {
    expect(codDinDenumire("  Vânzări  ")).toBe("VANZARI");
    expect(codDinDenumire("— Depozit —")).toBe("DEPOZIT");
  });

  it("comprimă separatoarele consecutive într-una singură", () => {
    expect(codDinDenumire("IT   &   Suport")).toBe("IT-SUPORT");
  });

  it("taie la 32 de caractere, limita coloanei", () => {
    const lung = codDinDenumire("Departamentul de cercetare dezvoltare si inovare tehnologica");
    expect(lung.length).toBeLessThanOrEqual(32);
    expect(lung.startsWith("DEPARTAMENTUL-DE-CERCETARE")).toBe(true);
  });

  it("întoarce șir gol pentru o denumire fără litere sau cifre", () => {
    // Apelantul tratează cazul explicit: cere omului să scrie codul de mână.
    expect(codDinDenumire("———")).toBe("");
    expect(codDinDenumire("")).toBe("");
  });

  it("păstrează cifrele", () => {
    expect(codDinDenumire("Punct de lucru 2")).toBe("PUNCT-DE-LUCRU-2");
  });
});
