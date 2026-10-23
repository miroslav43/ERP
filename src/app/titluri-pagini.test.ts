import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Poarta titlurilor de pagină (PRM-009, HR-004, UX-021).
 *
 * O pagină fără `metadata` sau `generateMetadata` moștenește titlul implicit
 * „Administrativo” din `src/app/layout.tsx`: fila browserului, istoricul și
 * cititorul de ecran nu mai spun unde e utilizatorul. Nici `tsc`, nici
 * `eslint`, nici build-ul nu observă lipsa — de aceea se numără aici, pe
 * sursă, fiecare `page.tsx` din cele trei zone autentificate.
 *
 * Excepțiile sunt explicite și justificate: paginile care doar fac
 * `redirect()` nu randează nimic, deci n-au ce titlu să poarte.
 */

const RADACINA = fileURLToPath(new URL(".", import.meta.url));
const ZONE = ["(app)", "(platform)", "(portal)"] as const;

/** Pagini care doar redirecționează — nu randează nimic, deci n-au titlu. */
const EXCEPTII = new Set(["(portal)/portal/sesizari/noua/page.tsx"]);

const EXPORT_TITLU =
  /export\s+(const\s+metadata\b|(async\s+)?function\s+generateMetadata\b|const\s+generateMetadata\b)/;

function pagini(director: string): string[] {
  const rezultat: string[] = [];
  for (const intrare of readdirSync(director, { withFileTypes: true })) {
    const cale = join(director, intrare.name);
    if (intrare.isDirectory()) rezultat.push(...pagini(cale));
    else if (intrare.name === "page.tsx") rezultat.push(cale);
  }
  return rezultat;
}

describe("titlurile paginilor autentificate", () => {
  const toate = ZONE.flatMap((zona) => pagini(join(RADACINA, zona))).map((cale) =>
    relative(RADACINA, cale).split("\\").join("/"),
  );

  it("găsește paginile (poarta nu trece pe o listă goală)", () => {
    expect(toate.length).toBeGreaterThan(150);
  });

  it("fiecare pagină exportă `metadata` sau `generateMetadata`", () => {
    const faraTitlu = toate.filter(
      (cale) =>
        !EXCEPTII.has(cale) && !EXPORT_TITLU.test(readFileSync(join(RADACINA, cale), "utf8")),
    );
    expect(faraTitlu).toEqual([]);
  });

  it("excepțiile există încă și chiar n-au titlu", () => {
    for (const cale of EXCEPTII) {
      expect(toate).toContain(cale);
      expect(EXPORT_TITLU.test(readFileSync(join(RADACINA, cale), "utf8"))).toBe(false);
    }
  });
});
