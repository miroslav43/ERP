import type { MetadataRoute } from "next";

import { ADRESA_SITE } from "@/content/landing/contact";

/** Doar paginile publice. Restul aplicației e închis implicit prin `src/proxy.ts`. */
const PAGINI = [
  { cale: "/", prioritate: 1 },
  { cale: "/en", prioritate: 0.9 },
  { cale: "/preturi", prioritate: 0.8 },
  { cale: "/en/preturi", prioritate: 0.7 },
  { cale: "/cere-demo", prioritate: 0.7 },
  { cale: "/legal/termeni", prioritate: 0.3 },
  { cale: "/legal/confidentialitate", prioritate: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGINI.map((pagina) => ({
    url: `${ADRESA_SITE}${pagina.cale}`,
    changeFrequency: "monthly" as const,
    priority: pagina.prioritate,
    alternates: {
      languages: {
        ro: `${ADRESA_SITE}${pagina.cale.replace(/^\/en/, "") || "/"}`,
        en: `${ADRESA_SITE}${pagina.cale.startsWith("/en") ? pagina.cale : `/en${pagina.cale === "/" ? "" : pagina.cale}`}`,
      },
    },
  }));
}
