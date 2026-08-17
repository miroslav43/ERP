import { describe, expect, it } from "vitest";
import { formatLei, formatAmount, parseAmount } from "./money";

describe("formatLei", () => {
  it("folosește punctul ca separator de mii și virgula ca separator zecimal", () => {
    expect(formatLei(1234.56)).toBe("1.234,56 lei");
  });

  it("afișează întotdeauna două zecimale", () => {
    expect(formatLei(1000)).toBe("1.000,00 lei");
    expect(formatLei(0.5)).toBe("0,50 lei");
  });

  it("tratează zero fără semn", () => {
    expect(formatLei(0)).toBe("0,00 lei");
  });

  it("păstrează semnul pentru sume negative (rețineri, regularizări)", () => {
    expect(formatLei(-250.4)).toBe("-250,40 lei");
  });

  it("grupează corect sumele mari, de ordinul unui stat de plată", () => {
    expect(formatLei(1234567.89)).toBe("1.234.567,89 lei");
  });

  it("acceptă string-uri numerice, așa cum vin din `numeric` prin PostgREST", () => {
    expect(formatLei("4500.00")).toBe("4.500,00 lei");
    expect(formatLei("0.10")).toBe("0,10 lei");
  });

  it("rotunjește la doi zecimali fără să piardă banul din mijloc", () => {
    expect(formatLei(0.005)).toBe("0,01 lei");
    expect(formatLei(2.675)).toBe("2,68 lei");
  });

  it("respinge valorile care nu sunt numere finite, în loc să afișeze NaN", () => {
    expect(() => formatLei(Number.NaN)).toThrow();
    expect(() => formatLei(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => formatLei("abc")).toThrow();
  });
});

describe("formatAmount", () => {
  it("formatează fără simbol monetar, pentru coloane de tabel", () => {
    expect(formatAmount(1234.5)).toBe("1.234,50");
  });

  it("acceptă altă valută decât RON, pentru diurna externă", () => {
    expect(formatAmount(87.5, "EUR")).toBe("87,50 EUR");
  });
});

describe("parseAmount", () => {
  it("citește formatul românesc introdus de utilizator", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("4500")).toBe(4500);
    expect(parseAmount("0,10")).toBe(0.1);
  });

  it("tolerează spațiile și spațiul neîntrerupt produs de copy-paste", () => {
    expect(parseAmount(" 1.234,56 ")).toBe(1234.56);
    expect(parseAmount("1 234,56")).toBe(1234.56);
  });

  it("acceptă și punctul zecimal, pentru cei obișnuiți cu tastatura numerică", () => {
    expect(parseAmount("1234.56")).toBe(1234.56);
  });

  it("întoarce null pentru intrări invalide, în loc să ghicească", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1,2,3")).toBeNull();
  });
});
