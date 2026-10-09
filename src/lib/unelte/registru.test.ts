import { describe, expect, it } from "vitest";

import { FORMATE } from "./document-tabelar";
import { constructorPentru, formatePentru, UNELTE } from "./registru";

describe("registrul uneltelor", () => {
  it("găsește o unealtă înregistrată", () => {
    // Nu foaia de parcurs: din 9 oct 2026 are rută statică (Excel pe formule).
    expect(constructorPentru("fisa-evaluare")).toBeTypeOf("function");
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
    for (const slug of Object.keys(UNELTE).filter((s) => s !== "fisa-instruire-ssm")) {
      expect(formatePentru(slug), slug).toEqual(FORMATE);
    }
    expect(formatePentru("constructor")).toEqual(FORMATE);
  });
});
