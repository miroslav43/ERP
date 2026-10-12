import { describe, expect, it } from "vitest";

import { acordSubstantiv, formatNumar, textNumarat, textZile } from "./numar";

describe("formatNumar", () => {
  it.each([
    [1, "1"],
    [13, "13"],
    [1.5, "1,5"],
    [1234.5, "1.234,5"],
    [0.25, "0,25"],
  ])("%s ⇒ „%s” (fără zecimale forțate, ca la bani)", (n, text) => {
    expect(formatNumar(n)).toBe(text);
  });

  it("nu scrie niciodată „,00”", () => {
    expect(formatNumar(20)).not.toContain(",00");
  });
});

describe("acordSubstantiv", () => {
  it.each([
    [1, "rând"],
    [6, "rânduri"],
    [19, "rânduri"],
    [20, "de rânduri"],
    [25, "de rânduri"],
    [0, "rânduri"],
    [101, "rânduri"],
    [120, "de rânduri"],
  ])("%s ⇒ „%s” (doar substantivul)", (n, text) => {
    expect(acordSubstantiv(n, "rând", "rânduri")).toBe(text);
  });
});

describe("textNumarat", () => {
  it.each([
    [0, "0 persoane"],
    [1, "1 persoană"],
    [2, "2 persoane"],
    [20, "20 de persoane"],
    [1000, "1.000 de persoane"],
    [1001, "1.001 persoane"],
    [-1, "-1 persoană"],
  ])("%s ⇒ „%s”", (n, text) => {
    expect(textNumarat(n, "persoană", "persoane")).toBe(text);
  });
});

describe("textZile", () => {
  it.each([
    [1, "1 zi"],
    [2, "2 zile"],
    [13, "13 zile"],
    [19, "19 zile"],
    [20, "20 de zile"],
    [21, "21 de zile"],
    [100, "100 de zile"],
    [101, "101 zile"],
    [119, "119 zile"],
    [120, "120 de zile"],
    [0, "0 zile"],
    [1.5, "1,5 zile"],
    [20.5, "20,5 de zile"],
  ])("%s ⇒ „%s”", (zile, text) => {
    expect(textZile(zile)).toBe(text);
  });

  it("primește și alt substantiv, cu același acord", () => {
    expect(textZile(1, "zi lucrătoare", "zile lucrătoare")).toBe("1 zi lucrătoare");
    expect(textZile(25, "zi lucrătoare", "zile lucrătoare")).toBe("25 de zile lucrătoare");
  });
});
