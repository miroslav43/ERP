import { describe, expect, it } from "vitest";

import { deLei, lei } from "./lei";

describe("sumele în lei", () => {
  it("întregi fără zecimale, cu punct de mii", () => {
    expect(lei(4325)).toBe("4.325 lei");
    expect(lei(500000)).toBe("500.000 lei");
    expect(lei(0)).toBe("0 lei");
  });

  it("cu bani, întotdeauna două zecimale — nu „7.500,5 lei”", () => {
    expect(lei(7500.5)).toBe("7.500,50 lei");
    expect(lei(803.6)).toBe("803,60 lei");
  });
});

describe("numeralul cu „lei”", () => {
  it("„de” de la 20 în sus și la sute fixe, ca în română", () => {
    expect(deLei(1)).toBe("1 leu");
    expect(deLei(0)).toBe("0 lei");
    expect(deLei(19)).toBe("19 lei");
    expect(deLei(20)).toBe("20 de lei");
    expect(deLei(58)).toBe("58 de lei");
    expect(deLei(100)).toBe("100 de lei");
    expect(deLei(101)).toBe("101 lei");
    expect(deLei(119)).toBe("119 lei");
    expect(deLei(120)).toBe("120 de lei");
  });
});
