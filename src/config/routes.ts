/**
 * Rutele-cheie ale aplicației, într-un singur loc.
 *
 * Pe host unic, `/` este landing-ul public, iar aplicația trăiește sub
 * `/panou`. Când vom trece pe subdomenii (`firma.administrativo.ro`),
 * `RUTA_DUPA_AUTENTIFICARE` devine `/` pe acel host, iar restul codului rămâne
 * neatins — de aceea constanta există în loc de literale împrăștiate.
 */
import type { AppRole } from "@/lib/tenant/types";

export const RUTA_PUBLICA = "/";
export const RUTA_AUTENTIFICARE = "/autentificare";
export const RUTA_DUPA_AUTENTIFICARE = "/panou";
export const RUTA_ALEGE_ORGANIZATIA = "/alege-organizatia";

export const RUTA_SUPER_ADMIN = "/super-admin";
/** Portalul angajatului. `(app)/layout.tsx` redirecționează aici rolul `employee`. */
export const RUTA_PORTAL = "/portal";

/**
 * Poarta care ține angajatul exclusiv în portal.
 *
 * Aprinsă: `(app)/layout.tsx` trimite orice `employee` în `/portal`, iar
 * `(portal)/layout.tsx` trimite orice alt rol în `/panou`. Un singur înveliș per
 * rol, fără suprapunere.
 *
 * A stat stinsă cât timp portalul nu acoperea tot ce poate face un angajat în
 * aplicația mare — aprinsă mai devreme, i-ar fi luat cererea de concediu fără
 * să-i dea nimic în schimb. Fiecare rând de mai jos are acum corespondent:
 *
 *   `/panou`                    → `/portal`
 *   `/notificari`               → `/portal/notificarile-mele`
 *   `/profil`                   → `/portal/profilul-meu`
 *   `/concedii*`                → `/portal/concediile-mele*` (listă, cerere nouă, detaliu)
 *   `/pontaj*`                  → `/portal/pontajul-meu*` (lună, săptămână, zi)
 *   `/diurna*`                  → `/portal/diurna-mea*`
 *   `/mentenanta/sesizari*`     → `/portal/sesizari*` (inclusiv `?echipament=` din QR)
 *   `/ticketing*`               → `/portal/tichetele-mele*`
 *   `/inventar/in-primire`      → `/portal/in-primirea-mea`
 *   `/onboarding*`              → `/portal/integrarea-mea*`
 *   `/ssm`                      → `/portal/instruirile-mele`
 *   `/anunturi*`                → `/portal/anunturi*`
 *
 * Rămâne deschis, INTENȚIONAT: `/documente/[id]`. E Route Handler, deci nu trece
 * prin niciun layout, și e singurul drum prin care angajatul își tipărește o
 * adeverință — `hr_issued_select` are ramură `own`. Nu-l „repara".
 *
 * Un singur `boolean`, într-un singur loc: stingerea în producție e o linie, nu
 * arheologie prin proxy, rute și layout-uri.
 *
 * Adnotat `boolean`, nu lăsat să se îngusteze la literal: altfel TypeScript
 * declară moartă cealaltă ramură din fiecare apelant, iar la comutare ar apărea
 * brusc erori în locuri care nu s-au schimbat.
 */
export const POARTA_PORTAL_ACTIVA: boolean = true;

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
  stare: Readonly<{
    estePlatformAdmin: boolean;
    areOrganizatii: boolean;
    /**
     * Rolul din organizația care VA DEVENI activă, când se poate ști.
     *
     * `null` când nu se poate: la autentificare, un cont cu apartenențe în mai
     * multe firme n-are un rol unic — cookie-ul de hint sau ecranul de alegere
     * decid abia după. A ghici acolo ar duce jumătate din oameni în locul greșit.
     * La comutarea explicită de organizație, dimpotrivă, ținta e cunoscută, deci
     * rolul se transmite și saltul suplimentar prin `/panou` dispare.
     */
    rol: AppRole | null;
  }>,
): string {
  if (stare.estePlatformAdmin) return RUTA_SUPER_ADMIN;
  // Ecranul de alegere tratează explicit lista goală și explică de ce e goală.
  if (!stare.areOrganizatii) return RUTA_ALEGE_ORGANIZATIA;
  // Portalul e singura aplicație a unui angajat. Fără ramura asta, aterizează în
  // învelișul de administrare și e trimis înapoi de poarta din layout — corect,
  // dar cu o navigare în plus și o clipire de chrome pe care nu-l poate folosi.
  if (stare.rol === "employee") return RUTA_PORTAL;
  return RUTA_DUPA_AUTENTIFICARE;
}
