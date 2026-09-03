import type { MetadataRoute } from "next";

import { ADRESA_SITE } from "@/content/landing/contact";

/**
 * Modulele aplicației autentificate, ca prefixe de nivel unu.
 *
 * Stau la RĂDĂCINĂ, nu sub `/panou` — lista veche bloca doar `/panou`, `/portal`,
 * `/super-admin` și `/setari`, deci cele douăzeci și cinci de module rămâneau
 * `allow`. Nu se indexa conținut (`src/proxy.ts` întoarce 307 spre autentificare),
 * dar se consuma buget de crawl pe redirecturi.
 */
const MODULE_INCHISE = [
  "angajati",
  "anunturi",
  "concedii",
  "cursuri",
  "departamente",
  "diurna",
  "documente",
  "evaluari",
  "flota",
  "inventar",
  "mentenanta",
  "notificari",
  "onboarding",
  "organigrama",
  "panou",
  "pontaj",
  "profil",
  "puncte-lucru",
  "rapoarte",
  "reges",
  "registru",
  "salarizare",
  "setari",
  "ssm",
  "ticketing",
  // Învelișuri din afara grupului (app), aceeași regulă.
  "portal",
  "super-admin",
  "bun-venit",
  "firma-in-configurare",
  "alege-organizatia",
] as const;

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
        ...MODULE_INCHISE.flatMap((modul) => [`/${modul}$`, `/${modul}/`]),
        "/api/",
        "/auth/",
      ],
    },
    sitemap: `${ADRESA_SITE}/sitemap.xml`,
  };
}
