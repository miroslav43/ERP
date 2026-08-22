/**
 * Rutele-cheie ale aplicației, într-un singur loc.
 *
 * Pe host unic, `/` este landing-ul public, iar aplicația trăiește sub
 * `/panou`. Când vom trece pe subdomenii (`firma.administrativo.ro`),
 * `RUTA_DUPA_AUTENTIFICARE` devine `/` pe acel host, iar restul codului rămâne
 * neatins — de aceea constanta există în loc de literale împrăștiate.
 */
export const RUTA_PUBLICA = "/";
export const RUTA_AUTENTIFICARE = "/autentificare";
export const RUTA_DUPA_AUTENTIFICARE = "/panou";
export const RUTA_ALEGE_ORGANIZATIA = "/alege-organizatia";

export const RUTA_SUPER_ADMIN = "/super-admin";

/**
 * Unde ajunge cineva imediat după autentificare.
 *
 * Funcție pură, cu starea primită ca argument: apelantul face interogările, ea
 * doar decide. Așa poate fi testată fără bază de date și fără `server-only` —
 * `src/lib/auth/**` îl importă, deci nimic de acolo nu intră în vitest.
 *
 * Administratorul de platformă ajunge în consolă chiar dacă e și membru într-o
 * firmă: planul de platformă e „acasă" pentru el, iar spre firmă comută explicit
 * din antet. Fără regula asta, cine are dublu rol n-ar vedea niciodată consola
 * la intrare, iar separarea ar rămâne doar pe hârtie.
 */
export function rutaDupaAutentificare(
  stare: Readonly<{ estePlatformAdmin: boolean; areOrganizatii: boolean }>,
): string {
  if (stare.estePlatformAdmin) return RUTA_SUPER_ADMIN;
  if (stare.areOrganizatii) return RUTA_DUPA_AUTENTIFICARE;
  // Ecranul de alegere tratează explicit lista goală și explică de ce e goală.
  return RUTA_ALEGE_ORGANIZATIA;
}
