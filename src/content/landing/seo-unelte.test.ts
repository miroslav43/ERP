// src/content/landing/seo-unelte.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { META_UNELTE, metaUnealta } from "./seo-unelte";

const DIR = "src/app/(marketing)/unelte";
const PAGINI = readdirSync(DIR)
  .filter((d) => existsSync(`${DIR}/${d}/page.tsx`))
  .map((d) => `/unelte/${d}`)
  .sort();

/** „Fișa de instruire SSM” → {fisa, de, instruire, ssm}: fără diacritice, fără punctuație. */
function cuvinte(text: string): ReadonlySet<string> {
  return new Set(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((c) => c !== ""),
  );
}

const ZILE = ["2026-01-15", "2026-10-08", "2026-12-31", "2035-12-31"] as const;

describe("metadatele uneltelor", () => {
  it("fiecare unealtă de pe disc are o intrare, și nicio intrare nu e în plus", () => {
    expect(Object.keys(META_UNELTE).sort()).toEqual(PAGINI);
  });

  it("titlul are cel mult 48 de caractere în orice an, fără marcă", () => {
    for (const cale of PAGINI) {
      for (const azi of ZILE) {
        const { titlu } = metaUnealta(cale, azi);
        expect(titlu.length, `${cale} ${azi}: ${titlu}`).toBeLessThanOrEqual(48);
        expect(titlu, cale).not.toMatch(/Administrativo|\{/u);
      }
    }
  });

  it("descrierea are 70–160 de caractere și e unică", () => {
    const descrieri = PAGINI.map((c) => metaUnealta(c, "2026-10-08").descriere);
    for (const [i, d] of descrieri.entries()) {
      expect(d.length, PAGINI[i]).toBeGreaterThanOrEqual(70);
      expect(d.length, PAGINI[i]).toBeLessThanOrEqual(160);
    }
    expect(new Set(descrieri).size).toBe(descrieri.length);
  });

  it("titlul conține fiecare cuvânt al termenului principal", () => {
    for (const cale of PAGINI) {
      const meta = META_UNELTE[cale];
      expect(meta, cale).toBeDefined();
      if (meta === undefined) continue;
      const dinTitlu = [...cuvinte(metaUnealta(cale, "2026-10-08").titlu)];
      for (const c of cuvinte(meta.termen)) {
        // „de” lipsește din forma căutată sau din titlu fără să schimbe intenția.
        if (c === "de") continue;
        // Prefix, nu egalitate: „angajati” din căutare e „angajaților” în titlu,
        // „concedii” e „concediilor” — aceeași intenție, altă flexiune.
        expect(
          dinTitlu.some((t) => t.startsWith(c)),
          `${cale}: „${c}” din „${meta.termen}”`,
        ).toBe(true);
      }
      expect(meta.termen, cale).toMatch(/^[a-z0-9 ]+$/u);
    }
  });

  it("anul din titlu e anul cererii, nu al build-ului", () => {
    expect(metaUnealta("/unelte/cerere-concediu-de-odihna", "2027-03-01").titlu).toContain("2027");
    expect(metaUnealta("/unelte/cerere-concediu-de-odihna", "2026-12-31").titlu).toContain("2026");
    expect(metaUnealta("/unelte/programare-concedii", "2026-10-08").titlu).toContain("2027");
    expect(metaUnealta("/unelte/programare-concedii", "2026-03-01").titlu).toContain("2026");
  });

  it("fiecare pagină de unealtă își ia metadatele de aici", () => {
    for (const cale of PAGINI) {
      const sursa = readFileSync(`src/app/(marketing)${cale}/page.tsx`, "utf8");
      expect(sursa, cale).toMatch(/metaUnealta\((?:"[^"]+"|CALE)/u);
      expect(sursa, cale).not.toMatch(/metadatePagina\(\{/u);
    }
  });

  it("o cale necunoscută e o eroare, nu un titlu gol", () => {
    expect(() => metaUnealta("/unelte/inexistenta")).toThrow(/n-are metadate/u);
    expect(() => metaUnealta("constructor")).toThrow(/n-are metadate/u);
  });
});
