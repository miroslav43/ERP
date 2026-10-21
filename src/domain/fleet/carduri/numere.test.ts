import { describe, expect, it } from "vitest";

import { detecteazaSeparatorZecimal, parseazaNumar, rotunjeste } from "./numere";

describe("parseazaNumar", () => {
  it.each([
    ["1.234,56", ",", 1234.56],
    ["1,234.56", ".", 1234.56],
    ["1234,56", ",", 1234.56],
    ["1 234,56", ",", 1234.56],
    ["1 234,56", ",", 1234.56],
    ["1 234,56", ",", 1234.56],
    ["-12,50", ",", -12.5],
    ["(12,50)", ",", -12.5],
    ["12,50-", ",", -12.5],
    ["12,50 L", ",", 12.5],
    ["RON 12,50", ",", 12.5],
    ["52", ",", 52],
    ["7,234", ",", 7.234],
    ["1.234", ",", 1234],
    ["1,234,567.8", ",", 1234567.8],
  ] as const)("„%s” cu separatorul %s → %s", (text, sep, asteptat) => {
    expect(parseazaNumar(text, sep)).toBeCloseTo(asteptat, 6);
  });

  it("o valoare care se spune singură bate separatorul dat: „52.3” rămâne 52,3 litri", () => {
    // Celula numerică a unui XLSX iese prin `String(număr)`; un profil cu virgulă
    // salvat de pe un CSV ar fi citit-o 523.
    expect(parseazaNumar("52.3", ",")).toBeCloseTo(52.3, 6);
    expect(parseazaNumar("1.234,56", ".")).toBeCloseTo(1234.56, 6);
  });

  it("„1,234” la `auto` e ambiguu → null", () => {
    expect(parseazaNumar("1,234", "auto")).toBeNull();
    expect(parseazaNumar("1.234", "auto")).toBeNull();
  });

  it("la `auto`, valorile neambigue se citesc", () => {
    expect(parseazaNumar("1,5", "auto")).toBe(1.5);
    expect(parseazaNumar("12.50", "auto")).toBe(12.5);
    expect(parseazaNumar("1.234,56", "auto")).toBeCloseTo(1234.56, 6);
  });

  it.each(["", "   ", "abc", "1,2,3,4x5", "12-3", "--", "()"])("„%s” nu e număr", (text) => {
    expect(parseazaNumar(text, ",")).toBeNull();
  });
});

describe("detecteazaSeparatorZecimal", () => {
  it("virgula urmată de 1–2 cifre ⇒ virgulă", () => {
    expect(detecteazaSeparatorZecimal(["52,30", "40,1", "12"])).toBe(",");
  });

  it("ambele semne pe o valoare: ultimul e zecimal", () => {
    expect(detecteazaSeparatorZecimal(["1.234,56", "7,234"])).toBe(",");
    expect(detecteazaSeparatorZecimal(["1,234.56", "7.234"])).toBe(".");
  });

  it("toate „x,yyy” ⇒ ambiguu (null), se cere profilul", () => {
    expect(detecteazaSeparatorZecimal(["1,234", "7,250"])).toBeNull();
  });

  it("voturi contradictorii pe aceeași coloană ⇒ null", () => {
    expect(detecteazaSeparatorZecimal(["52,30", "12.5"])).toBeNull();
  });

  it("doar întregi: orice separator e corect", () => {
    expect(detecteazaSeparatorZecimal(["52", "40", ""])).toBe(".");
  });
});

describe("rotunjeste", () => {
  it("rotunjește stabil la 2 zecimale", () => {
    expect(rotunjeste(1.005, 2)).toBe(1.01);
    expect(rotunjeste(52.3, 2)).toBe(52.3);
  });
});
