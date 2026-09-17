import type { MetadataRoute } from "next";

import { SEGMENTE_APLICATIE } from "@/config/routes";
import { ADRESA_SITE } from "@/content/landing/contact";

/*
 * Modulele aplicației autentificate, ca prefixe de nivel unu, vin din
 * `SEGMENTE_APLICATIE` — aceeași listă pe care `src/proxy.ts` o folosește ca să
 * decidă cine primește ecranul de autentificare.
 *
 * Stau la RĂDĂCINĂ, nu sub `/panou` — lista veche bloca doar `/panou`, `/portal`,
 * `/super-admin` și `/setari`, deci cele douăzeci și cinci de module rămâneau
 * `allow`. Nu se indexa conținut (proxy-ul întoarce 307 spre autentificare), dar
 * se consuma buget de crawl pe redirecturi.
 */

/**
 * `Disallow` se potrivește pe PREFIX, nu pe segment.
 *
 * Un rând `Disallow: /pontaj` ar bloca și `/pontaj-pe-telefon`, iar
 * `Disallow: /reges` ar bloca `/reges-online` — exact paginile publice pe care le
 * construim. De aceea fiecare modul primește două reguli: `$` pentru calea
 * exactă și `/` pentru subarbore. Ambele sunt înțelese de Google, Bing și de
 * crawlerele AI care respectă robots.txt.
 *
 * Paginile de autentificare NU apar aici, deliberat: ele primesc
 * `robots: { index: false }` în metadata. O pagină interzisă în robots.txt nu
 * poate fi citită, deci `noindex` nu ajunge niciodată să fie văzut, iar URL-ul
 * poate rămâne în index fără conținut. Ca să scoți ceva din index trebuie să
 * lași robotul să intre.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        ...SEGMENTE_APLICATIE.flatMap((modul) => [`/${modul}$`, `/${modul}/`]),
        "/api/",
        "/auth/",
      ],
    },
    sitemap: `${ADRESA_SITE}/sitemap.xml`,
  };
}
