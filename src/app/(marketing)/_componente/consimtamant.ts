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

/** Cele două răspunsuri posibile. Orice altceva din stocare se ignoră. */
export type Alegere = "acceptat" | "refuzat";
