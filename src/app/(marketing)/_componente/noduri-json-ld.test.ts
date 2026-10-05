// src/app/(marketing)/_componente/noduri-json-ld.test.ts
import { describe, expect, it } from "vitest";

import { ADRESA_SITE } from "@/content/landing/contact";
import { PAGINI_LEGE } from "@/content/legal/pagini";

import { nodArticol } from "./noduri-json-ld";

describe("nodArticol", () => {
  it("citează textele de lege din `surse`", () => {
    for (const p of PAGINI_LEGE) {
      const nod = nodArticol(p);
      expect(nod.citation, p.cale).toEqual(
        (p.surse ?? []).map((s) => ({ "@type": "CreativeWork", name: s.eticheta, url: s.href })),
      );
    }
  });

  it("are `image` exact când pagina are captură", () => {
    for (const p of PAGINI_LEGE) {
      const nod = nodArticol(p);
      if (p.captura === undefined) {
        expect("image" in nod, `${p.cale}: fără captură, fără image`).toBe(false);
      } else {
        expect("image" in nod ? nod.image : undefined, p.cale).toEqual({
          "@type": "ImageObject",
          url: `${ADRESA_SITE}/capturi/${p.captura.cheie}-1920.webp`,
          width: 1920,
          height: 1200,
          caption: p.captura.alt,
        });
      }
    }
  });
});
