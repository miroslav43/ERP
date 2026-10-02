import { describe, expect, it } from "vitest";

import { constructorPentru } from "./registru";

describe("registrul uneltelor", () => {
  it("găsește o unealtă înregistrată", () => {
    expect(constructorPentru("condica-de-prezenta")).toBeTypeOf("function");
  });

  it("registrul nu răspunde la cheile prototipului", () => {
    for (const cheie of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(constructorPentru(cheie)).toBeUndefined();
    }
  });
});
