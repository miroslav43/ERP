// src/app/(marketing)/_componente/pagina-lege.test.ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const SURSA = readFileSync("src/app/(marketing)/_componente/pagina-lege.tsx", "utf8");

describe("pagina-lege", () => {
  it("butonul de cont vine după răspunsul scurt, nu între lead și răspuns", () => {
    // Auditul GEO din 5 oct 2026: pasajul extras de motoarele generative cuprindea
    // și „Creează cont · prima lună gratuită", fiindcă antetul îl punea înaintea
    // răspunsului. Antetul nu mai primește buton; pagina îl pune după răspuns.
    expect(SURSA).toContain("cta={null}");
    const raspuns = SURSA.indexOf("text.raspunsScurt.map");
    const buton = SURSA.indexOf('data-umami-event="cta-dupa-raspuns"');
    expect(raspuns).toBeGreaterThan(0);
    expect(buton).toBeGreaterThan(raspuns);
  });
});

describe("cuprinsul paginilor-lege", () => {
  it("fiecare pagină are ancore unice, ASCII, și titluri distincte în cuprins", async () => {
    // Auditul din 7 oct 2026 (M49): nicio secțiune n-avea `id`. Ancora vine acum
    // din titlu; două secțiuni cu același titlu ar da același `id`, iar saltul
    // din cuprins ar ateriza mereu pe prima.
    const { PAGINI_LEGE } = await import("@/content/legal/pagini");
    const { cuprinsulPaginii } = await import("@/content/legal/cuprins");
    expect(PAGINI_LEGE.length).toBeGreaterThanOrEqual(9);
    for (const pagina of PAGINI_LEGE) {
      const cuprins = cuprinsulPaginii(pagina);
      const iduri = cuprins.map((c) => c.id);
      expect(new Set(iduri).size, pagina.cale).toBe(iduri.length);
      expect(new Set(cuprins.map((c) => c.titlu)).size, pagina.cale).toBe(cuprins.length);
      for (const id of iduri) expect(id, pagina.cale).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      // Rândurile tabelului își iau și ele ancora din text (`#germania`): o
      // secțiune cu același nume ar dubla `id`-ul în pagină.
      const randuri = new Set((pagina.tabel?.randuri ?? []).map((r) => r[0] ?? ""));
      for (const id of iduri) expect(randuri.has(id), `${pagina.cale}: #${id}`).toBe(false);
    }
  });

  it("legăturile „Sari la țară” duc la rânduri care există în tabel", async () => {
    const { PAGINI_LEGE } = await import("@/content/legal/pagini");
    for (const pagina of PAGINI_LEGE) {
      const randuri = new Set((pagina.tabel?.randuri ?? []).map((r) => r[0] ?? ""));
      for (const tara of pagina.tabel?.saltLa ?? []) {
        expect(randuri.has(tara), `${pagina.cale}: „${tara}” nu e în tabel`).toBe(true);
      }
    }
  });

  it("fiecare bandă din cuprins își primește ancora în randare", () => {
    expect(SURSA).toContain("cuprinsulPaginii(text)");
    // Cinci benzi cu `id`: reguli, amenzi, secțiunile, tabelul, nesigur.
    expect(SURSA.match(/<Banda[^>]*\bid=\{ancora\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(SURSA.match(/\bid=\{ancora\(/g)?.length).toBe(5);
  });
});
