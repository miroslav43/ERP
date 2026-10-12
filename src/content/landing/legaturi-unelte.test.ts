// src/content/landing/legaturi-unelte.test.ts
import { existsSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PAGINI_LEGE } from "@/content/legal/pagini";

import { FISE } from "./fise-module";
import { LEGATURI_CONEXE } from "./legaturi";

/**
 * Câte pagini trimit spre o unealtă, în afară de hub și de pagina de start.
 *
 * Auditul din 5 oct 2026: „URL is unknown to Google” pe exact paginile noi cu
 * cele mai puține legături interne. Hub-ul și pagina de start trimit spre toate
 * uneltele, deci nu spun nimic despre una anume. Contează paginile pe subiect:
 * ghidul, fișa modulului, unealta vecină.
 */
const DIR = "src/app/(marketing)/unelte";
const UNELTE = readdirSync(DIR)
  .filter((d) => existsSync(`${DIR}/${d}/page.tsx`))
  .map((d) => `/unelte/${d}`);

const faraAncora = (href: string): string => href.split("#")[0] ?? "";

function surseSpre(cale: string): ReadonlySet<string> {
  const surse = new Set<string>();
  for (const p of PAGINI_LEGE) {
    const legaturi = [p.legaturaSecundara, ...(p.legaturiConexe ?? [])];
    if (legaturi.some((l) => faraAncora(l.href) === cale)) surse.add(p.cale);
  }
  for (const [de, lista] of Object.entries(LEGATURI_CONEXE)) {
    if (de !== cale && lista.some((l) => faraAncora(l.href) === cale)) surse.add(de);
  }
  for (const f of FISE) {
    if ((f.ghiduri ?? []).some((l) => faraAncora(l.href) === cale)) surse.add(`modul:${f.cheie}`);
  }
  return surse;
}

describe("legăturile interne spre unelte", () => {
  it("fiecare unealtă primește legături din cel puțin trei pagini pe subiect", () => {
    expect(UNELTE.length).toBeGreaterThanOrEqual(8);
    for (const cale of UNELTE) {
      const surse = surseSpre(cale);
      expect(surse.size, `${cale} ← ${[...surse].join(", ")}`).toBeGreaterThanOrEqual(3);
    }
  });
});
