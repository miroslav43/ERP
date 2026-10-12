import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { marimeCitibila } from "./marime";

describe("marimeCitibila — cifra pe care o citește omul", () => {
  it("folosește aceeași bază ca limitele scrise în ecrane (1024)", () => {
    expect(marimeCitibila(1024)).toBe("1 kB");
    expect(marimeCitibila(2 * 1024 * 1024)).toBe("2 MB");
  });

  it("dă o zecimală doar sub 10, cu virgulă românească", () => {
    expect(marimeCitibila(Math.round(2.4 * 1024 * 1024))).toBe("2,4 MB");
    expect(marimeCitibila(Math.round(12.4 * 1024 * 1024))).toBe("12 MB");
  });

  it("octeții rămân întregi, fără zecimale", () => {
    expect(marimeCitibila(0)).toBe("0 B");
    expect(marimeCitibila(999)).toBe("999 B");
  });

  it("o mărime negativă (coloană coruptă) se scrie 0, nu „-5 B”", () => {
    expect(marimeCitibila(-5)).toBe("0 B");
  });

  it("se oprește la GB, fără o treaptă inventată peste", () => {
    expect(marimeCitibila(2048 * 1024 ** 3)).toBe("2.048 GB");
  });

  // Motivul mutării: Server Components (galeria de poze a sesizării, documentele
  // echipamentului) o cheamă la randare. Exportată dintr-un modul „use client”,
  // pe server ar fi o referință client, iar apelul aruncă.
  it("trăiește într-un modul fără directivă, deci se poate chema și pe server", () => {
    const sursa = readFileSync(new URL("./marime.ts", import.meta.url), "utf8");
    expect(sursa).not.toMatch(/^\s*["']use (client|server)["']/mu);
  });
});
