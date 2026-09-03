import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ZonaIncarcare } from "@/components/incarcare/zona-incarcare";
import { ADRESA_SITE } from "@/content/landing/contact";

/**
 * Subsetul `latin-ext` este obligatoriu, nu opțional.
 *
 * Româna corectă folosește ș și ț cu VIRGULĂ dedesubt (U+0219, U+021B), nu cu
 * sedilă (ş, ţ — U+015F, U+0163, care aparțin alfabetului turc). Fără
 * `latin-ext`, browserul cade pe un font de rezervă exact pentru aceste litere,
 * iar textul apare cu grosimi amestecate în mijlocul cuvintelor.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  /**
   * `metadataBase` stă AICI, nu doar în `(marketing)/layout.tsx`.
   *
   * Fără el, orice rută din afara grupului de marketing — `/autentificare`,
   * `/invitatie/[token]`, ecranele portalului — rezolvă URL-urile relative din
   * Open Graph pe un origin de rezervă dedus de Next, și emite un avertisment la
   * build. O singură bază, moștenită de tot arborele; grupurile o pot suprascrie,
   * dar nu mai trebuie s-o inventeze.
   */
  metadataBase: new URL(ADRESA_SITE),
  title: {
    default: "Administrativo",
    template: "%s · Administrativo",
  },
  description:
    "Sistem de administrare a personalului pentru firme din România: pontaj, concedii, salarii, SSM, flotă și inventar.",
  /*
   * NU se declară `icons` aici.
   *
   * A existat un `icons: { icon: "/marca.svg" }` care n-a ajuns niciodată în
   * `<head>`: metadatele bazate pe FIȘIER au prioritate mai mare și suprascriu
   * obiectul `metadata` (`generate-metadata.md`). Iar fișierele există —
   * `icon.tsx` (512), `icon1.tsx` (192), `apple-icon.tsx` (180), `favicon.ico`.
   * Declarația era cod mort care arăta ca o configurație activă, iar
   * `public/marca.svg` pe care o numea nu e folosit de nicio pagină.
   */
};

/**
 * `viewportFit: "cover"` nu e cosmetic: fără el, `env(safe-area-inset-*)`
 * evaluează la ZERO pe iOS, iar bara de navigare a portalului
 * (`(portal)/bara-portal.tsx`, care se bazează pe `pb-[env(safe-area-inset-bottom)]`)
 * ajunge sub indicatorul de gesturi al iPhone-ului — exact zona în care
 * atingerea deschide ecranul de start în loc să apese butonul.
 */
export const viewport: Viewport = {
  themeColor: "#0F1E3D",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        {/*
          Voalul de încărcare stă AICI, nu per zonă, și asta e toată ideea.
          Drumul reclamat — `/alege-organizatia` → `/panou` — traversează două
          grupuri de rute: layout-ul `(auth)` se demontează, cel `(app)` se
          montează. Singurul înveliș comun celor două e acesta.

          Funcționează fiindcă `redirect()` dintr-o Server Action face navigare
          CLIENT, nu înlocuire de document (`redirect.md:13`), deci componentul
          supraviețuiește exact intervalului în care ecranul tăcea.

          `ZonaToast` rămâne montată per zonă — are altă cerință, fiindcă o
          notificare a utilizatorului precedent n-are ce căuta pe ecranul
          următorului. Voalul n-are starea asta: se stinge când se golește
          lista de surse.
        */}
        <ZonaIncarcare />
      </body>
    </html>
  );
}
