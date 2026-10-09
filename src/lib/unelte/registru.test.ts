import { describe, expect, it } from "vitest";

import { constructorPentru } from "./registru";

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
