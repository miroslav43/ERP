// src/app/(marketing)/_componente/noduri-json-ld.test.ts
import { describe, expect, it } from "vitest";

import { ADRESA_SITE } from "@/content/landing/contact";
import { PAGINI_LEGE } from "@/content/legal/pagini";

import { nodArticol, nodUnealta } from "./noduri-json-ld";

describe("nodUnealta", () => {
  it("e o aplicație web gratuită, cu data din sitemap", async () => {
    const { dataPaginii } = await import("@/content/landing/harta");
    const nod = nodUnealta({
      cale: "/unelte/calculator-salariu",
      nume: "Calculator salariu net și brut",
      descriere: "Descriere.",
    });
    expect(nod).toMatchObject({
      "@type": "WebApplication",
      "@id": `${ADRESA_SITE}/unelte/calculator-salariu#unealta`,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "RON" },
      dateModified: dataPaginii("/unelte/calculator-salariu"),
    });
  });

  it("cu imagine, are `ImageObject` cu adresa absolută; fără, nu are cheia", () => {
    const cu = nodUnealta({
      cale: "/unelte/cerere-demisie",
      nume: "Cerere de demisie",
      descriere: "Descriere.",
      imagine: {
        url: "/capturi/unelte/x-1200.webp",
        latime: 1200,
        inaltime: 1200,
        descriere: "Alt.",
      },
    });
    expect(cu).toMatchObject({
      image: {
        "@type": "ImageObject",
        url: `${ADRESA_SITE}/capturi/unelte/x-1200.webp`,
        width: 1200,
        height: 1200,
        caption: "Alt.",
      },
    });
    const fara = nodUnealta({ cale: "/unelte/calculator-salariu", nume: "C", descriere: "D." });
    expect("image" in fara).toBe(false);
  });
});

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
