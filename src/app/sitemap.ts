import type { MetadataRoute } from "next";

import { ADRESA_SITE } from "@/content/landing/contact";

/**
 * O pagină publică. `traducere` e calea variantei în cealaltă limbă, sau `null`
 * când pagina nu are pereche.
 *
 * Perechea se DECLARĂ, nu se deduce din cale. Generatorul anterior prefixa orb
 * `/en` la fiecare intrare și emitea hreflang către `/en/cere-demo`,
 * `/en/legal/termeni` și `/en/legal/confidentialitate` — rute care nu există în
 * `src/app/(marketing)/en/`. Hreflang-ul cere reciprocitate: o trimitere către o
 * pagină care nu trimite înapoi invalidează întreaga grupă, nu doar rândul
 * greșit. Declarat pe rând, adăugarea unei pagini RO fără traducere nu mai poate
 * inventa o rută engleză.
 *
 * `actualizat` se bumpează DE MÂNĂ când se schimbă conținutul paginii. Nu e
 * `new Date()`: o dată de build pusă automat ar pretinde că toate paginile s-au
 * schimbat la fiecare livrare, iar un `lastModified` în care nu se poate avea
 * încredere e ignorat de motoare.
 */
type Pagina = Readonly<{
  cale: string;
  prioritate: number;
  limba: "ro" | "en";
  traducere: string | null;
  actualizat: string;
}>;

const PAGINI: readonly Pagina[] = [
  { cale: "/", prioritate: 1, limba: "ro", traducere: "/en", actualizat: "2026-08-31" },
  { cale: "/en", prioritate: 0.9, limba: "en", traducere: "/", actualizat: "2026-08-31" },
  {
    cale: "/preturi",
    prioritate: 0.8,
    limba: "ro",
    traducere: "/en/preturi",
    actualizat: "2026-08-22",
  },
  {
    cale: "/en/preturi",
    prioritate: 0.7,
    limba: "en",
    traducere: "/preturi",
    actualizat: "2026-08-22",
  },
  { cale: "/cere-demo", prioritate: 0.7, limba: "ro", traducere: null, actualizat: "2026-08-22" },
  // Paginile care au preluat conținutul mutat de pe pagina de start. Fără
  // traducere: engleza are azi doar `/en` și `/en/preturi`, iar o pereche
  // declarată către o rută inexistentă e mai rea decât nicio pereche.
  { cale: "/module", prioritate: 0.8, limba: "ro", traducere: null, actualizat: "2026-09-03" },
  {
    cale: "/pontaj-pe-telefon",
    prioritate: 0.8,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
  },
  { cale: "/incredere", prioritate: 0.6, limba: "ro", traducere: null, actualizat: "2026-09-03" },
  { cale: "/intrebari", prioritate: 0.6, limba: "ro", traducere: null, actualizat: "2026-09-03" },
  { cale: "/de-ce-nu", prioritate: 0.5, limba: "ro", traducere: null, actualizat: "2026-09-03" },
  { cale: "/domenii", prioritate: 0.5, limba: "ro", traducere: null, actualizat: "2026-09-03" },
  {
    cale: "/comparatie/excel",
    prioritate: 0.6,
    limba: "ro",
    traducere: null,
    actualizat: "2026-09-03",
  },
  {
    cale: "/legal/termeni",
    prioritate: 0.3,
    limba: "ro",
    traducere: null,
    actualizat: "2026-08-22",
  },
  {
    cale: "/legal/confidentialitate",
    prioritate: 0.3,
    limba: "ro",
    traducere: null,
    actualizat: "2026-08-22",
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGINI.map((pagina) => {
    const intrare = {
      url: `${ADRESA_SITE}${pagina.cale}`,
      lastModified: pagina.actualizat,
      changeFrequency: "monthly" as const,
      priority: pagina.prioritate,
    };

    if (pagina.traducere === null) return intrare;

    const ro = pagina.limba === "ro" ? pagina.cale : pagina.traducere;
    const en = pagina.limba === "en" ? pagina.cale : pagina.traducere;

    return {
      ...intrare,
      alternates: {
        languages: {
          ro: `${ADRESA_SITE}${ro}`,
          en: `${ADRESA_SITE}${en}`,
          // Româna e limba implicită: publicul e din România, iar engleza există
          // pentru excepții. Fără `x-default`, motoarele aleg singure pentru
          // vizitatorii care nu se potrivesc cu nicio limbă declarată.
          "x-default": `${ADRESA_SITE}${ro}`,
        },
      },
    };
  });
}
