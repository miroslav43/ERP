import { describe, expect, it } from "vitest";

import { lei } from "./lei";

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
