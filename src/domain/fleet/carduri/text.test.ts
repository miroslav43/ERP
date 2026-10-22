import { describe, expect, it } from "vitest";

import { normalizeazaNrAuto, normalizeazaText } from "./text";

describe("normalizeazaText", () => {
  it("sedila (din Windows-1250) devine virgula dedesubt", () => {
    expect(normalizeazaText("Staţia Bucureşti")).toBe("Stația București");
    expect(normalizeazaText("ŞOSEAUA ŢIGLINA")).toBe("ȘOSEAUA ȚIGLINA");
  });

  it("strânge spațiile, inclusiv NBSP și spațiul îngust", () => {
    expect(normalizeazaText("  OMV  Pipera  2 ")).toBe("OMV Pipera 2");
  });
});

describe("normalizeazaNrAuto", () => {
  it("ca `internal.vehicles_normalizeaza`: „b-100-xyz” → „B100XYZ”", () => {
    expect(normalizeazaNrAuto("b-100-xyz")).toBe("B100XYZ");
    expect(normalizeazaNrAuto("CJ 12 ABC")).toBe("CJ12ABC");
  });
});
