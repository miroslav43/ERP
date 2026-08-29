import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ZonaIncarcare } from "@/components/incarcare/zona-incarcare";

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
  title: {
    default: "Administrativo",
    template: "%s · Administrativo",
  },
  description:
    "Sistem de administrare a personalului pentru firme din România: pontaj, concedii, salarii, SSM, flotă și inventar.",
  // `favicon.ico` rămâne pentru browserele vechi; varianta SVG e clară la orice
  // densitate de ecran și e chiar marca desenată în antet.
  icons: { icon: [{ url: "/marca.svg", type: "image/svg+xml" }] },
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
