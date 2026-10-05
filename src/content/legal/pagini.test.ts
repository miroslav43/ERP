// src/content/legal/pagini.test.ts
import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PAGINI_LEGE } from "./pagini";

describe("paginile-lege", () => {
  it("lista centrală le cuprinde pe toate rutele de ghid", () => {
    // Fiecare `page.tsx` care randează o pagină-lege trebuie să-și aibă textul aici.
    const cai = new Set(PAGINI_LEGE.map((p) => p.cale));
    const ghiduri = readdirSync("src/app/(marketing)/ghid", { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `/ghid/${d.name}`);
    for (const cale of [...ghiduri, "/reges-online", "/evidenta-orelor-de-munca"]) {
      expect(cai.has(cale), cale).toBe(true);
    }
  });

  it("titlurile secțiunilor de reguli și de amenzi sunt întrebări, diferite de la o pagină la alta", () => {
    // Auditul din 5 oct 2026: cinci ghiduri aveau același H2, iar „Amenzile" era fix.
    const titluri = PAGINI_LEGE.flatMap((p) => [p.titluReguli, p.titluAmenzi]);
    for (const t of titluri) expect(t, t).toMatch(/\?$/);
    expect(new Set(titluri).size).toBe(titluri.length);
  });
});
