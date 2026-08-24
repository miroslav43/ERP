import { IBM_Plex_Sans } from "next/font/google";

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
 * platformă e locul unde diferența dintre planuri trebuie să se simtă.
 *
 * Mono NU se mai declară aici. Instanța locală (`--font-consola-mono`) era
 * descărcată și neconsumată de nimeni — variabila nu era înregistrată în
 * `@theme`, deci toate `font-mono` din consolă cădeau tot pe stiva sistemului.
 * Cifrele vin acum din `monoCifre` (`src/lib/ui/fonturi.ts`), comun celor trei
 * zone care afișează date.
 */
export const plexSans = IBM_Plex_Sans({
  variable: "--font-consola",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
