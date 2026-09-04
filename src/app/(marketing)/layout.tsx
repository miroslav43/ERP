// src/app/(marketing)/layout.tsx
import type { Metadata, Viewport } from "next";
import { Fira_Mono, Fira_Sans_Condensed } from "next/font/google";
import type { ReactNode } from "react";

import { ADRESA_SITE } from "@/content/landing/contact";
import { RO } from "@/content/landing/ro";

import { Analitice } from "./_componente/analitice";
import { DateStructurate } from "./_componente/date-structurate";

/**
 * Fonturile stratului de marketing.
 *
 * Se declară AICI, nu în layout-ul rădăcină: altfel cele douăzeci și trei de
 * ecrane ale aplicației ar preîncărca două familii pe care nu le folosesc.
 *
 * `latin-ext` e obligatoriu — fără el, browserul cade pe fontul de rezervă
 * exact pe ș și ț. Ambele familii au fost verificate empiric înainte de prima
 * linie de layout: U+0219 și U+021B au glife PROPRII, distincte de variantele
 * cu sedilă U+015F/U+0163, iar în Fira glifa se numește chiar `scommaaccent`.
 *
 * `preload` doar pe titlu: H1-ul e cel mai mare element de text al paginii,
 * deci elementul care decide LCP-ul.
 */
const firaCondensed = Fira_Sans_Condensed({
  weight: "600",
  subsets: ["latin", "latin-ext"],
  variable: "--font-fira-condensed",
  display: "swap",
  preload: true,
});

const firaMono = Fira_Mono({
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-fira-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(ADRESA_SITE),
  title: { default: RO.meta.titlu, template: "%s · Administrativo" },
  description: RO.meta.descriere,
  applicationName: "Administrativo",
  openGraph: {
    type: "website",
    siteName: "Administrativo",
    locale: "ro_RO",
    alternateLocale: ["en_GB"],
    title: RO.meta.titlu,
    description: RO.meta.descriere,
  },
  twitter: { card: "summary_large_image" },
  /*
   * Dovada de proprietate pentru Search Console și Bing.
   *
   * Se citește din mediu la RANDARE, nu la build: nu e un `NEXT_PUBLIC_*`, deci
   * nu se coace în pachetul de client, iar schimbarea ei nu cere reconstrucție.
   * Absentă, câmpul lipsește complet din HTML — `undefined` nu emite nimic.
   *
   * E calea a doua, nu prima. Verificarea recomandată e pe DOMENIU, printr-un
   * TXT în DNS: acoperă dintr-o dată toate subdomeniile și amândouă protocoalele,
   * nu cere nicio livrare, și nu se pierde dacă cineva schimbă antetul paginii.
   * Eticheta din HTML rămâne pentru cazul în care DNS-ul nu e la îndemână.
   */
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : {},
  },
  robots: { index: true, follow: true },
};

/**
 * Rădăcina declară `themeColor: "#0F1E3D"`, navy-ul aplicației. Fără
 * suprascrierea de aici, prima imagine pe telefon ar fi o bară de browser navy
 * lipită de un antet aproape alb.
 */
export const viewport: Viewport = { themeColor: "#ECEFEC" };

export default function LayoutMarketing({ children }: { children: ReactNode }) {
  return (
    <div className={`${firaCondensed.variable} ${firaMono.variable} mk bg-mk-hartie text-mk-text`}>
      {/*
        Stă pe LAYOUT, nu pe pagina de start: identitatea firmei și a sitului sunt
        aceleași pe toate paginile publice, iar o pagină nouă le primește fără să
        și le declare. Nodurile specifice unei pagini (ofertă, articol) se adaugă
        în pagina lor, legate prin `@id` de nodurile de aici.
      */}
      <DateStructurate />
      {children}
      {/*
        Măsurarea stă în grupul de MARKETING, nu în layoutul rădăcină: montată
        acolo, ar trimite la Google căile din interiorul aplicației — `/angajati`,
        `/salarizare`, `/concedii`. Într-un produs de HR, până și lista rutelor
        vizitate spune ceva despre oamenii unei firme.
      */}
      <Analitice />
    </div>
  );
}
