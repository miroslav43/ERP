// src/domain/attendance/calcul-ore.test.ts

import { describe, expect, it } from "vitest";
import { oreLucrateDinInterval, oreSuplimentareDinLucrate } from "./calcul-ore";

describe("oreLucrateDinInterval", () => {
  it("calculează orele dintr-un interval simplu", () => {
    expect(oreLucrateDinInterval("08:00", "16:00")).toBe(8);
  });

  it("rotunjește la sutimi pentru minute care nu se împart exact", () => {
    expect(oreLucrateDinInterval("08:00", "16:45")).toBe(8.75);
  });

  it("întoarce null dacă sfârșitul nu e strict după început", () => {
    expect(oreLucrateDinInterval("16:00", "16:00")).toBeNull();
    expect(oreLucrateDinInterval("16:00", "08:00")).toBeNull();
  });

  it("întoarce null pentru ore invalide", () => {
    expect(oreLucrateDinInterval("25:00", "16:00")).toBeNull();
    expect(oreLucrateDinInterval("08:00", "")).toBeNull();
  });
});

describe("oreSuplimentareDinLucrate", () => {
  it("întoarce zero când orele lucrate nu depășesc pragul", () => {
    expect(oreSuplimentareDinLucrate(8, 8)).toBe(0);
    expect(oreSuplimentareDinLucrate(6, 8)).toBe(0);
  });

  it("calculează diferența peste prag", () => {
    expect(oreSuplimentareDinLucrate(10, 8)).toBe(2);
  });

  it("respectă pragul organizației, nu unul hardcodat", () => {
    expect(oreSuplimentareDinLucrate(7, 6)).toBe(1);
  });
});
