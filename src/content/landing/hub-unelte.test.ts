// src/content/landing/hub-unelte.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { GRUPURI_HUB } from "./hub-unelte";

const DIR = "src/app/(marketing)/unelte";
const PAGINI = readdirSync(DIR)
  .filter((d) => existsSync(`${DIR}/${d}/page.tsx`))
  .map((d) => `/unelte/${d}`)
  .sort();

describe("hub-ul uneltelor", () => {
  it("fiecare unealtă de pe disc apare exact o dată, într-o singură categorie", () => {
    const hrefuri = GRUPURI_HUB.flatMap((g) => g.pagini.map((p) => p.href));
    expect([...hrefuri].sort()).toEqual(PAGINI);
    expect(new Set(hrefuri).size).toBe(hrefuri.length);
  });

  it("categoriile au ancore unice, text și cel puțin o unealtă", () => {
    const iduri = GRUPURI_HUB.map((g) => g.id);
    expect(new Set(iduri).size).toBe(iduri.length);
    for (const g of GRUPURI_HUB) {
      expect(g.id, g.titlu).toMatch(/^[a-z][a-z-]*$/u);
      // `documentul` și `rezultat` sunt ancorele uneltelor; hub-ul nu le refolosește.
      expect(["documentul", "rezultat"], g.id).not.toContain(g.id);
      expect(g.pagini.length, g.id).toBeGreaterThanOrEqual(1);
      for (const p of g.pagini) {
        expect(p.titlu.trim(), p.href).not.toBe("");
        expect(p.lead.trim(), p.href).not.toBe("");
        expect(p.nota.trim(), p.href).not.toBe("");
      }
    }
  });

  it("pagina hub-ului randează categoriile, nu o listă scrisă în pagină", () => {
    const sursa = readFileSync(`${DIR}/page.tsx`, "utf8");
    expect(sursa).toContain("GRUPURI_HUB.map(");
    expect(sursa).not.toMatch(/const PAGINI\s*=/u);
  });
});
