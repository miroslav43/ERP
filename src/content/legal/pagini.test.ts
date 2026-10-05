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

  it("capturile din ghiduri există pe disc și au text alternativ descriptiv", async () => {
    const { arePrinGeam } = await import("@/app/(marketing)/_componente/vitrine");
    const cuCaptura = PAGINI_LEGE.filter((p) => p.captura !== undefined);
    expect(cuCaptura.length).toBeGreaterThanOrEqual(3);
    for (const p of cuCaptura) {
      expect(arePrinGeam(p.captura?.cheie ?? ""), p.cale).toBe(true);
      expect(p.captura?.alt.length ?? 0, p.cale).toBeGreaterThanOrEqual(60);
      expect(p.captura?.legenda, p.cale).toMatch(/date fictive/i);
    }
  });

  it("nicio captură nu contrazice pagina pe care stă", () => {
    // Revizuirea din 5 oct 2026. Captura de pontaj arată doar ora de începere —
    // pe pagina care spune că art. 119 cere și ora de sfârșit. Captura de diurnă
    // arată ~50 de lei pe zi pentru o deplasare în Austria și Germania — pe pagina
    // care dă 35 € pe zi pentru Germania. O imagine care slăbește afirmația paginii
    // e mai rea decât niciuna; se pun la loc când există capturi potrivite.
    const fara = ["/evidenta-orelor-de-munca", "/ghid/diurna-externa"];
    for (const cale of fara) {
      expect(PAGINI_LEGE.find((p) => p.cale === cale)?.captura, cale).toBeUndefined();
    }
  });

  it("titlurile-întrebare nu afirmă ce pagina nu susține", () => {
    // „cel mai des" era o frecvență pe care lista de amenzi n-o dovedește.
    for (const p of PAGINI_LEGE) {
      expect(`${p.titluReguli} ${p.titluAmenzi}`, p.cale).not.toMatch(/cel mai des|cele mai/i);
    }
  });
});
