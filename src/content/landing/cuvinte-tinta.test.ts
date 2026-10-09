// src/content/landing/cuvinte-tinta.test.ts
import { existsSync, readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ADRESA_SITE } from "./contact";
import { intrariSitemap } from "./harta";
import { META_UNELTE } from "./seo-unelte";

/**
 * `docs/comercial/cuvinte-tinta.tsv` e lista pe care `scripts/seo/pozitii.py`
 * o caută EXACT în Search Console. Un termen cu diacritice sau cu majuscule nu
 * se potrivește niciodată („equals”), iar o pagină scoasă din sitemap ar fi
 * măsurată la nesfârșit fără să mai existe.
 */
const randuri = readFileSync("docs/comercial/cuvinte-tinta.tsv", "utf8")
  .split("\n")
  .filter((r) => r.trim() !== "");
const [antet, ...date] = randuri;
const tinte = date.map((r) => {
  const [termen = "", pagina = "", ...rest] = r.split("\t");
  return { termen, pagina, rest };
});

describe("termenii-țintă", () => {
  it("are antetul pe care îl citește pozitii.py", () => {
    expect(antet).toBe("termen\tpagina");
  });

  it("fiecare rând: termen ASCII cu litere mici, unic, și o pagină din sitemap", () => {
    const sitemap = new Set(intrariSitemap().map((i) => i.url.replace(ADRESA_SITE, "") || "/"));
    const vazute = new Set<string>();
    for (const t of tinte) {
      expect(t.rest, t.termen).toEqual([]);
      expect(t.termen, t.termen).toMatch(/^[a-z0-9]+(?: [a-z0-9]+)*$/u);
      expect(vazute.has(t.termen), `dublură: ${t.termen}`).toBe(false);
      vazute.add(t.termen);
      expect(sitemap.has(t.pagina), `${t.termen} → ${t.pagina}`).toBe(true);
    }
  });

  it("fiecare unealtă e măsurată pe cel puțin un termen, iar termenul ei principal e printre ei", () => {
    const dir = "src/app/(marketing)/unelte";
    const unelte = readdirSync(dir)
      .filter((d) => existsSync(`${dir}/${d}/page.tsx`))
      .map((d) => `/unelte/${d}`);
    for (const cale of unelte) {
      const ale = tinte.filter((t) => t.pagina === cale).map((t) => t.termen);
      expect(ale.length, cale).toBeGreaterThanOrEqual(1);
      expect(ale, cale).toContain(META_UNELTE[cale]?.termen);
    }
  });
});
