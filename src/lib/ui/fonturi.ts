import { IBM_Plex_Mono } from "next/font/google";

/**
 * Fontul cifrelor, comun celor trei zone care afișează date: aplicația de
 * firmă, portalul angajatului și consola de platformă.
 *
 * De ce există. `--font-mono` nu era declarat NICĂIERI în `@theme`, deși
 * `font-mono` apare de 75 de ori în cod. Consecința: CNP-ul, IBAN-ul, CUI-ul,
 * codul COR și seriile de inventar se randau în `ui-monospace` — adică în SF
 * Mono pe macOS, Consolas pe Windows și DejaVu Sans Mono pe Linux. Trei
 * desene diferite ale cifrei 1 și ale lui 7, într-un produs în care omul
 * compară cifră cu cifră două rânduri suprapuse.
 *
 * De ce Plex Mono. Era deja descărcat de consola de platformă, sub
 * `--font-consola-mono`, și NU-l consuma nimeni: variabila nu era înregistrată
 * în `@theme`, deci toate `font-mono` din consolă cădeau tot pe stiva
 * sistemului. Un font plătit și nefolosit. Declarația de aici îl folosește și
 * repară consola în aceeași trecere.
 *
 * De ce nu în `src/app/layout.tsx`. Rădăcina acoperă și `(marketing)`, care
 * are propriul Fira Mono pentru cifrele din foaia demonstrativă. Declarat aici
 * și aplicat pe cele trei învelișuri, fontul nu ajunge niciodată în bundle-ul
 * paginii de prezentare.
 *
 * Subsetul `latin-ext` rămâne obligatoriu, din același motiv ca la Inter: ș și
 * ț cu virgulă dedesubt (U+0219, U+021B). Chiar dacă fontul poartă mai ales
 * cifre, poartă și unități — „ore”, „zile”, „lei”.
 */
export const monoCifre = IBM_Plex_Mono({
  variable: "--font-mono-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});
