/**
 * Cheia sub care se ține alegerea privind cookie-urile de analiză.
 *
 * ── DE CE ARE MODUL PROPRIU ───────────────────────────────────────────────
 * Stătea în `bara-consimtamant.tsx`, care e client component, și era importată
 * de `analitice.tsx`, care e server component. Legal la compilare, rupt la
 * rulare: Next înlocuiește exporturile unui modul „use client" cu un PROXY de
 * referință — un stub care aruncă dacă e apelat pe server. Interpolat într-un
 * template literal, proxy-ul s-a stringificat, iar scriptul emis a ieșit așa:
 *
 *   localStorage.getItem('function() {
 *     throw new Error("Attempted to call CHEIE_CONSIMTAMANT() from the server…
 *
 * JavaScript invalid în capul paginii: hidratarea murea, bara nu apărea
 * niciodată, `gtag` rămânea nedefinit. `tsc` și ESLint au tăcut amândouă —
 * tipul e `string`, importul e permis, totul compilează. Nici `next build`
 * n-ar fi prins-o: e un șir corect sintactic care devine cod greșit abia în
 * browser.
 *
 * Fișierul ăsta NU are directivă. Fără `"use client"` și fără `server-only`, e
 * un modul neutru, care se inlinează în ambele grafuri fără proxy.
 */
export const CHEIE_CONSIMTAMANT = "adm-consimtamant";

/**
 * Evenimentul de pe `window` la o alegere în bară, cu alegerea în `detail`.
 *
 * Îl ascultă `BibliotecaGa`: pe paginile uneltelor, `gtag.js` se încarcă abia
 * după „Accept”, și trebuie să se încarce în aceeași vizită, nu la următoarea.
 * Modul ăsta e neutru (fără directivă), deci constanta ajunge identică în
 * ambele grafuri — vezi docblock-ul de sus.
 */
export const EVENIMENT_CONSIMTAMANT = "adm-consimtamant-ales";

/** Cele două răspunsuri posibile. Orice altceva din stocare se ignoră. */
export type Alegere = "acceptat" | "refuzat";

/**
 * Atributul de pe `<html>` care arată bara de consimțământ.
 *
 * Îl pune scriptul de la parsare (`CONSIMTAMANT_IMPLICIT` din `analitice.tsx`)
 * când nu există o alegere citibilă; `globals.css` arată bara doar sub el.
 * Așa bara se vopsește odată cu pagina, nu după hidratare — pe hub era
 * elementul LCP, la 3,7 s pe telefon (auditul din 8 oct 2026).
 */
export const ATRIBUT_CONSIMTAMANT = "data-consimtamant";
