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
