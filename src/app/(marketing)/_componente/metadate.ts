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
 * Imaginea INTRĂ aici. Până pe 2 oct 2026, comentariul de aici spunea că
 * `opengraph-image.tsx` „are prioritate pe tot segmentul". Situl viu arăta
 * contrariul: 47 din 48 de adrese fără `og:image`. Obiectul `openGraph` al
 * paginii îl înlocuiește pe cel moștenit cu totul, imaginea de pe fișier
 * inclusă — același mecanism descris în primul paragraf, a doua oară.
 */

const MARCA = "Administrativo";
const SUFIX = ` · ${MARCA}`;

export const OG_COMUN = { type: "website", siteName: MARCA } as const;

/**
 * Imaginea de distribuire, la o adresă FIXĂ.
 *
 * Nu pe convenția `opengraph-image.tsx`: într-un grup de rute, Next îi pune
 * adresei un hash (`/opengraph-image-pwu6ef`), pe care nicio pagină nu-l poate
 * referi. Ruta e `imagine-distribuire.png/route.ts`; extensia o scoate și din
 * `proxy.ts` (matcher-ul sare peste `.png`).
 */
export const IMAGINE_DISTRIBUIRE = {
  url: "/imagine-distribuire.png",
  width: 1200,
  height: 630,
  alt: "Administrativo — pontaj, concedii și salarizare pentru firme din România",
} as const;

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
      images: [IMAGINE_DISTRIBUIRE],
    },
    twitter: { card: "summary_large_image", images: [IMAGINE_DISTRIBUIRE.url] },
  };
}
