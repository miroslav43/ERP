/**
 * Catalogul vitrinelor — modulele care au demonstrație interactivă.
 *
 * ── DE CE E UN FIȘIER SEPARAT, FĂRĂ `"use client"` ────────────────────────
 * Datele astea se citesc din DOUĂ grafuri deodată: din `page.tsx`-ul de modul,
 * care e Server Component, și din `prin-geam.tsx`, care e client.
 *
 * Stăteau, până acum, chiar în `prin-geam.tsx`. Next rescrie fiecare export
 * numit al unui modul marcat `"use client"` într-un `registerClientReference`
 * (`node_modules/next/dist/build/webpack/loaders/next-flight-loader/index.js`),
 * iar proxy-ul acela ARUNCĂ la apel în graful de server
 * (`next-flight-loader/module-proxy.js`) — o referință de client e o adresă de
 * transmis browserului, nu o funcție de executat. `arePrinGeam(cheie)` chemat
 * din Server Component rupea prerandarea TUTUROR celor nouăsprezece pagini
 * `/module/*`, fiindcă `generateStaticParams` le trece pe toate la build.
 *
 * Un modul simplu se importă la fel de bine din amândouă părțile: pe server
 * rulează ca funcție obișnuită, iar în bundle-ul de client intră ca sursă.
 * Regula de aur: din partea de server nu se APELEAZĂ niciodată un export al
 * unui fișier `"use client"` — se poate doar randa ca element.
 *
 * Poarta care păzește regula asta: `vitrine.test.ts`.
 */

/**
 * Modulele cu vitrină, fiecare cu nota care spune CÂT din modul arată.
 *
 * Nota nu e decor. `ro.ts` promite, în punctele modulului `leave`, „Unsprezece
 * tipuri, fiecare cu temeiul legal notat", iar demonstrația are trei
 * (`src/demo/lume.ts`). Ambele texte apar pe aceeași pagină, deci pagina s-ar
 * contrazice singură sub ochii unui prospect. Textul din `ro.ts` e adevărat
 * despre PRODUS; ce arată mai puțin e demonstrația — deci demonstrația își
 * declară limita, nu produsul.
 */
const VITRINE: Readonly<Record<string, string>> = {
  leave:
    "Demonstrația arată un subset: trei tipuri de concediu din cele unsprezece ale modulului, pe o singură lună și pentru o firmă inventată.",
};

/** Are modulul o vitrină construită? Restul nu randează banda deloc. */
export function arePrinGeam(cheie: string): boolean {
  return Object.hasOwn(VITRINE, cheie);
}

/** Nota de subset a vitrinei, sau `undefined` dacă modulul n-are vitrină. */
export function notaVitrinei(cheie: string): string | undefined {
  return VITRINE[cheie];
}
