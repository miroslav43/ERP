// src/domain/fleet/contabil/text-ascii.test.ts
import { describe, expect, it } from "vitest";

import { faraPunctSiVirgula, inAscii } from "./text-ascii";

describe("inAscii", () => {
  it("scoate diacriticele cu virgulă dedesubt", () => {
    expect(inAscii("Ștefan Țepeș")).toBe("Stefan Tepes");
    expect(inAscii("ăâîșț ĂÂÎȘȚ")).toBe("aaist AAIST");
  });

  it("scoate și variantele cu sedilă (fișierele vechi din Windows)", () => {
    expect(inAscii("şi ţara ŞŢ")).toBe("si tara ST");
  });

  it("ghilimelele românești devin ghilimele drepte, liniuțele lungi devin cratimă", () => {
    expect(inAscii("„bon”")).toBe('"bon"');
    expect(inAscii("“citat”")).toBe('"citat"');
    expect(inAscii("‚a’ – b — c")).toBe("'a' - b - c");
  });

  it("liniile noi și taburile devin un singur spațiu; marginile se taie", () => {
    expect(inAscii("  OMV\r\nPipera\tNord  ")).toBe("OMV Pipera Nord");
  });

  it("caracterele din afara 0x20–0x7E dispar (emoji, simboluri)", () => {
    expect(inAscii("Stație ⛽ 24/7 €")).toBe("Statie 24/7");
    expect(inAscii("\u0000a\u007Fb")).toBe("ab");
  });

  it("taie la lungimea cerută, după transliterare", () => {
    const lung = "Ș".repeat(60);
    expect(inAscii(lung, 48)).toBe("S".repeat(48));
    expect(inAscii("abc def", 4)).toBe("abc");
  });

  it("orice octet al rezultatului e între 0x20 și 0x7E", () => {
    const rezultat = inAscii("Ăla bălălău „șmecher” ţânţar 🚗 ok\n");
    for (const ch of rezultat) {
      const cod = ch.charCodeAt(0);
      expect(cod).toBeGreaterThanOrEqual(0x20);
      expect(cod).toBeLessThanOrEqual(0x7e);
    }
  });
});

describe("faraPunctSiVirgula", () => {
  it("înlocuiește separatorul de câmp cu virgulă, ca o stație să nu rupă linia", () => {
    expect(faraPunctSiVirgula("Popa & Fiii; Pipera")).toBe("Popa & Fiii, Pipera");
  });
});
