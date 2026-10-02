// src/app/(marketing)/_componente/metadate.test.ts
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { IMAGINE_DISTRIBUIRE, metadatePagina } from "./metadate";

const MARKETING = join(process.cwd(), "src/app/(marketing)");

describe("metadatePagina", () => {
  it("pune imaginea de distribuire pe fiecare pagină, nu doar pe homepage", () => {
    // Auditul din 2 oct 2026: 47 din 48 de adrese fără `og:image`. `openGraph`
    // din pagină îl înlocuiește pe cel moștenit — imaginea trebuie să fie ÎN el.
    for (const limba of ["ro", "en"] as const) {
      const m = metadatePagina({ titlu: "Probă", descriere: "Descriere.", cale: "/proba", limba });
      expect(m.openGraph?.images, limba).toEqual([IMAGINE_DISTRIBUIRE]);
      expect(m.twitter, limba).toEqual({
        card: "summary_large_image",
        images: [IMAGINE_DISTRIBUIRE.url],
      });
    }
  });

  it("adresa imaginii are o rută care o servește", () => {
    const dosar = join(MARKETING, IMAGINE_DISTRIBUIRE.url.slice(1));
    expect(existsSync(join(dosar, "route.ts"))).toBe(true);
  });

  it("nu mai există o imagine pe convenția de fișier, cu adresă cu hash", () => {
    // Ar dubla imaginea pe `/` și ar aduce înapoi adresa care nu poate fi referită.
    expect(existsSync(join(MARKETING, "opengraph-image.tsx"))).toBe(false);
  });
});
