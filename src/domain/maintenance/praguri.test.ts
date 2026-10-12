// src/domain/maintenance/praguri.test.ts
import { describe, expect, it } from "vitest";

import {
  bucatiPraguri,
  normalizeazaPraguri,
  PRAGURI_ALERTA_IMPLICITE,
  pragurileCaText,
} from "./praguri";

describe("bucatiPraguri", () => {
  it("desparte după virgulă, punct și virgulă sau spațiu", () => {
    expect(bucatiPraguri("30, 14;7  3")).toEqual(["30", "14", "7", "3"]);
  });

  it("textul gol dă zero bucăți — schema cere apoi cel puțin un prag", () => {
    expect(bucatiPraguri("  , ; ")).toEqual([]);
  });

  it("bucățile nenumerice rămân, ca schema să le refuze pe câmp", () => {
    expect(bucatiPraguri("30, abc")).toEqual(["30", "abc"]);
  });
});

describe("normalizeazaPraguri", () => {
  it("scoate dublurile și ordonează descrescător, ca alert_rules", () => {
    expect(normalizeazaPraguri([7, 30, 14, 7])).toEqual([30, 14, 7]);
  });

  it("nu modifică vectorul primit", () => {
    const intrare = [1, 5];
    normalizeazaPraguri(intrare);
    expect(intrare).toEqual([1, 5]);
  });
});

describe("pragurileCaText", () => {
  it("implicitele se afișează ca în motor", () => {
    expect(pragurileCaText(PRAGURI_ALERTA_IMPLICITE)).toBe("30, 14, 7");
  });

  it("ordinea afișată e cea normalizată", () => {
    expect(pragurileCaText([5, 20])).toBe("20, 5");
  });
});
