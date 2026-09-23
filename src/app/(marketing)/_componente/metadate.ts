// src/app/(marketing)/_componente/metadate.ts
import type { Metadata } from "next";

/**
 * Metadatele unei pagini publice, cu Open Graph-ul EI.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Până pe 23 sept 2026, paginile își puneau doar `title`, `description` și
 * `canonical`. Next îmbină metadatele SUPERFICIAL, pe chei: o pagină fără
 * `openGraph` moștenește obiectul întreg din layout, adică titlul și descrierea
 * homepage-ului. Auditul SEO a găsit același `og:title` („Program de pontaj și
 * HR pentru firme cu 5–50 de angajați") pe toate cele 48 de adrese: orice
 * link distribuit pe LinkedIn sau WhatsApp arăta homepage-ul, oricare ar fi
 * fost pagina. Invers, `/en` își punea propriul `openGraph` și pierdea din el
 * `type` și `siteName`, fiindcă obiectul din layout era înlocuit, nu completat.
 *
 * De aici: câmpurile comune stau într-un singur loc (`OG_COMUN`, folosit și de
 * layout), iar fiecare pagină primește obiectul complet.
 *
 * Imaginea nu intră aici: `opengraph-image.tsx` e metadată pe fișier și are
 * prioritate peste cea din configurare, pe tot segmentul.
 */

const MARCA = "Administrativo";
const SUFIX = ` · ${MARCA}`;

export const OG_COMUN = { type: "website", siteName: MARCA } as const;

const LOCALE = {
  ro: { locale: "ro_RO", alternateLocale: "en_GB" },
  en: { locale: "en_GB", alternateLocale: "ro_RO" },
} as const;

type DatePagina = Readonly<{
  /** Fără marcă: șablonul `%s · Administrativo` din layout o adaugă. */
  titlu: string;
  descriere: string;
  /** Calea canonică, relativă la `metadataBase`. */
  cale: string;
  /** Titlul e deja complet (homepage-urile) — nu primește sufixul mărcii. */
  titluAbsolut?: boolean;
  limba?: keyof typeof LOCALE;
  /** Perechile hreflang, doar unde varianta cealaltă există cu adevărat. */
  limbi?: Readonly<Record<string, string>>;
}>;

export function metadatePagina({
  titlu,
  descriere,
  cale,
  titluAbsolut = false,
  limba = "ro",
  limbi,
}: DatePagina): Metadata {
  return {
    title: titluAbsolut ? { absolute: titlu } : titlu,
    description: descriere,
    alternates: limbi === undefined ? { canonical: cale } : { canonical: cale, languages: limbi },
    openGraph: {
      ...OG_COMUN,
      ...LOCALE[limba],
      title: titluAbsolut ? titlu : `${titlu}${SUFIX}`,
      description: descriere,
      url: cale,
    },
  };
}
