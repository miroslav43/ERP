import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * Fonturile consolei de platformă. Aplicația de firmă rămâne pe Inter.
 *
 * Subsetul `latin-ext` este OBLIGATORIU, din exact motivul documentat în
 * `src/app/layout.tsx`: româna corectă folosește ș și ț cu VIRGULĂ dedesubt
 * (U+0219, U+021B), nu cu sedilă. Fără el, browserul cade pe un font de rezervă
 * exact pentru aceste litere, iar textul apare cu grosimi amestecate în
 * mijlocul cuvintelor.
 *
 * De ce Plex și nu Inter: Inter e alegerea implicită a tuturor, iar consola de
 * platformă e locul unde diferența dintre planuri trebuie să se simtă. Mono
 * poartă cifrele — CUI, plafoane, ore, ID-uri de cerere — împreună cu
 * `tabular-nums`, ca să se alinieze în coloane la scanare.
 */
export const plexSans = IBM_Plex_Sans({
  variable: "--font-consola",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  variable: "--font-consola-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});
