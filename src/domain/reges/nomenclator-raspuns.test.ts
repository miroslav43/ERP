// src/domain/reges/nomenclator-raspuns.test.ts
import { describe, expect, it } from "vitest";

import { idNomenclatorDinRaspuns } from "./nomenclator-raspuns";

const UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("idNomenclatorDinRaspuns", () => {
  it("acceptă un șir simplu", () => {
    expect(idNomenclatorDinRaspuns(UUID)).toBe(UUID);
  });

  it("acceptă cheile uzuale, în ordinea din documentație", () => {
    for (const cheie of ["id", "referinta", "regesId", "reges_id", "uuid"]) {
      expect(idNomenclatorDinRaspuns({ [cheie]: UUID })).toBe(UUID);
    }
  });

  it("prima cheie potrivită câștigă", () => {
    expect(idNomenclatorDinRaspuns({ id: UUID, uuid: "altceva" })).toBe(UUID);
  });

  it("taie spațiile din jur", () => {
    expect(idNomenclatorDinRaspuns({ id: `  ${UUID}  ` })).toBe(UUID);
  });

  it("întoarce null pentru un răspuns fără identificator — apelantul îl tratează ca EȘEC", () => {
    expect(idNomenclatorDinRaspuns({ mesaj: "ok" })).toBeNull();
    expect(idNomenclatorDinRaspuns({ id: "" })).toBeNull();
    expect(idNomenclatorDinRaspuns({ id: "   " })).toBeNull();
    expect(idNomenclatorDinRaspuns(null)).toBeNull();
    expect(idNomenclatorDinRaspuns(undefined)).toBeNull();
    expect(idNomenclatorDinRaspuns("")).toBeNull();
    expect(idNomenclatorDinRaspuns(42)).toBeNull();
  });

  it("ignoră o valoare care nu e șir", () => {
    expect(idNomenclatorDinRaspuns({ id: 42, uuid: UUID })).toBe(UUID);
  });
});
