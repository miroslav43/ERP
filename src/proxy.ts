import { NextResponse, type NextRequest } from "next/server";

import { RUTA_AUTENTIFICARE, RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * ACEST FIȘIER NU ESTE UN BOUNDARY DE AUTORIZARE.
 *
 * CVE-2025-29927 a arătat că middleware-ul Next.js poate fi sărit complet
 * dintr-un simplu antet de request. Orice verificare de drepturi făcută aici ar
 * fi ocolibilă. Prin urmare face exact trei lucruri, toate de confort:
 *   1. reîmprospătează cookie-urile de sesiune Supabase (obligatoriu — altfel
 *      token-ul expiră în mijlocul navigării);
 *   2. redirect grosier către autentificare pentru vizitatorii nelogați;
 *   3. duce utilizatorul deja autentificat de pe landing în aplicație.
 *
 * Autorizarea reală se face în trei locuri independente:
 *   - `resolveTenant()` în layout-ul (app)/(portal), pentru randare;
 *   - `resolveTenant()` din nou, în FIECARE Server Action prin `createAction`
 *     (un layout nu protejează o Server Action — sunt puncte de intrare
 *     separate);
 *   - politicile RLS din Postgres, ultima linie, care nu depind de nimic din ce
 *     trimite clientul.
 *
 * Numele fișierului: Next.js 16 a redenumit convenția `middleware.ts` în
 * `proxy.ts`. Funcția exportată se numește acum `proxy`.
 */

/** Rutele accesibile fără sesiune. Restul aplicației e închis implicit. */
const RUTE_PUBLICE: readonly string[] = [
  "/autentificare",
  "/invitatie",
  "/resetare-parola",
  "/parola-noua",
  "/auth",
  "/cere-demo",
  "/preturi",
  "/legal",
];

/**
 * Numele parametrului care poartă destinația după autentificare.
 *
 * O singură constantă, folosită și la scriere (aici), și la citire (pagina de
 * autentificare). Când cele două au diferit, linkurile profunde se pierdeau
 * tăcut: utilizatorul ajungea pe tabloul de bord în loc de pagina cerută, fără
 * nicio eroare care să semnaleze problema.
 */
export const PARAM_REDIRECT = "redirect";

function estePublica(pathname: string): boolean {
  if (pathname === "/") return true;
  return RUTE_PUBLICE.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // Rutele de API răspund în JSON și își verifică singure sesiunea. Un redirect
  // 307 către o pagină HTML le-ar strica pe toate, inclusiv webhook-urile.
  if (pathname.startsWith("/api/")) return response;

  /** Copiază cookie-urile reîmprospătate pe răspunsul de redirect. */
  const cuCookies = (destinatie: URL): NextResponse => {
    const redirect = NextResponse.redirect(destinatie);
    // Capcană: cookie-urile reîmprospătate trăiesc pe `response`. Fără copiere,
    // sesiunea se pierde și utilizatorul intră într-o buclă de reautentificare.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  if (user !== null) {
    // Autentificat pe landing → direct în aplicație. Pe host unic, `/` este
    // pagina publică de prezentare; nu are ce arăta cuiva care e deja înăuntru.
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = RUTA_DUPA_AUTENTIFICARE;
      url.search = "";
      return cuCookies(url);
    }
    return response;
  }

  if (estePublica(pathname)) return response;

  const url = request.nextUrl.clone();
  url.pathname = RUTA_AUTENTIFICARE;
  url.search = "";
  // Doar calea internă. Pagina de autentificare reinjectează valoarea într-un
  // redirect după login, deci un URL absolut aici ar fi open redirect: la
  // citire se verifică din nou că începe cu „/” și nu cu „//”.
  url.searchParams.set(PARAM_REDIRECT, `${pathname}${search}`);
  return cuCookies(url);
}

export const config = {
  matcher: [
    /*
     * Tot, minus bundle-urile Next, fișierele statice din /public și
     * favicon-ul. Fără excluderi, fiecare imagine ar declanșa un apel de
     * refresh către GoTrue.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|otf|map)$).*)",
  ],
};
