import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Paginile n-au teste unitare (CLAUDE.md, „Datorie cunoscută”); proiectul le
 * apără citind sursa, ca `descarcari.test.tsx`. Aici: formularul trimite toți
 * parametrii pe care îi citește ruta, iar pagina are benzile noi.
 */
const SURSA = readFileSync("src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx", "utf8");

describe("pagina foii de pontaj", () => {
  it("formularul trimite fiecare parametru pe care îl citește ruta", () => {
    for (const camp of [
      "an",
      "luna",
      "ore",
      "program",
      "varianta",
      "firma",
      "cui",
      "compartiment",
      "angajati",
    ]) {
      expect(SURSA, camp).toContain(`name="${camp}"`);
    }
  });

  it("are tabelul fix, banda ITM și întrebările, fără promisiunea falsă despre adunare", () => {
    expect(SURSA).toContain("<TabelColectiv");
    expect(SURSA).toContain("<CeCereItm");
    expect(SURSA).toContain("<IntrebariUnealta");
    // Auditul: pagina spunea că foaia „nu adună singură orele”, iar Excelul adună.
    expect(SURSA).not.toMatch(/nu adună singură orele/u);
  });

  /*
   * `globals.css` ascunde sub 1280 px orice `[data-zi]` dintr-un `.mk-foaie`
   * (ferestrele foii din aplicație). `TabelColectiv` pune `data-zi` pe capul
   * fiecărei zile, deci într-o figură `.mk-foaie` capul dispărea, iar celulele
   * rămâneau: coloanele se decalau (găsit la verificarea headless din E13).
   */
  it("figura foii colective nu poartă clasa `mk-foaie`", () => {
    const figura = /<figure\b[^>]*data-tipar-pagina="peisaj"[^>]*>/u.exec(SURSA)?.[0] ?? "";
    expect(figura).not.toBe("");
    expect(figura).not.toContain("mk-foaie");
  });
});
