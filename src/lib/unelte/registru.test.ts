import { describe, expect, it } from "vitest";

import { FORMATE } from "./document-tabelar";
import { constructorPentru, formatePentru, UNELTE } from "./registru";

describe("registrul uneltelor", () => {
  it("găsește o unealtă înregistrată", () => {
    // Nu foaia de parcurs și nici fișa de evaluare: din 9 oct 2026 au rute
    // statice (Excel pe formule). Fișa SSM e singura rămasă pe ruta comună.
    expect(constructorPentru("fisa-instruire-ssm")).toBeTypeOf("function");
  });

  it("registrul nu răspunde la cheile prototipului", () => {
    for (const cheie of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(constructorPentru(cheie)).toBeUndefined();
    }
  });
});

describe("formatele fiecărei unelte", () => {
  it("fișa SSM n-are Excel; restul au toate trei formatele", () => {
    expect(formatePentru("fisa-instruire-ssm")).toEqual(["pdf", "docx"]);
    expect(formatePentru("cerere-demisie")).toEqual(["pdf", "docx"]);
    const restranse: readonly string[] = ["fisa-instruire-ssm", "cerere-demisie"];
    for (const slug of Object.keys(UNELTE).filter((s) => !restranse.includes(s))) {
      expect(formatePentru(slug), slug).toEqual(FORMATE);
    }
    expect(formatePentru("constructor")).toEqual(FORMATE);
  });
});
