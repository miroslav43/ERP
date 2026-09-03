// src/lib/supabase/middleware.ts
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

import { fetchCuTermen } from "./fetch-cu-termen";
import { OPTIUNI_COOKIE } from "./optiuni-cookie";

/**
 * Deliberat NU importăm `@/config/env`: modulul acela validează la import și
 * secretele de server (chei de criptare, secretul de cookie), care nu au ce
 * căuta în bundle-ul de middleware. O cheie HR lipsă ar transforma fiecare
 * request într-un 500. Aici sunt necesare doar cele două valori publice, pe
 * care Next.js le înlocuiește literal la build.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (SUPABASE_URL === "" || SUPABASE_ANON_KEY === "") {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL sau NEXT_PUBLIC_SUPABASE_ANON_KEY lipsesc din mediu (middleware).",
  );
}

export type SessionUpdate = Readonly<{
  response: NextResponse;
  /**
   * Doar dacă cererea are o sesiune validă. Un `User` întreg ar fi fost o
   * promisiune pe care verificarea locală n-o poate ține: `getClaims()` întoarce
   * claim-urile din token, nu rândul din baza de auth. Singurul consumator —
   * `src/proxy.ts` — nu citea oricum niciun câmp.
   */
  autentificat: boolean;
}>;

/**
 * Reîmprospătează cookie-urile de sesiune Supabase și spune dacă requestul are
 * un utilizator autentificat. NU decide nimic despre organizație și nu
 * autorizează nimic — vezi comentariul din `src/proxy.ts`.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        // Cookie-urile noi trebuie puse ȘI pe request (ca restul lanțului să
        // le vadă în acest request), ȘI pe răspuns (ca browserul să le
        // primească). Omiterea uneia dintre cele două produce exact bug-ul de
        // „deconectare aleatorie” din ghidurile Supabase.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // @supabase/ssr 0.12 trimite aici antetele de no-store. Fără ele, un
        // CDN sau un reverse proxy poate cache-ui răspunsul CU `Set-Cookie` și
        // servi sesiunea unui utilizator altuia.
        for (const [antet, valoare] of Object.entries(headers)) {
          response.headers.set(antet, valoare);
        }
      },
    },
    // Aici cookie-urile sb-* chiar se rescriu spre browser, la fiecare cerere
    // de document: e locul în care durata sesiunii se reînnoiește efectiv.
    cookieOptions: OPTIUNI_COOKIE,
    // `fetchCuTermen` rămâne obligatoriu și după trecerea la verificarea locală:
    // acoperă în continuare reînnoirea de token (o dată pe oră per utilizator) și
    // aducerea JWKS-ului (o dată la 10 minute per proces). Un apel fără termen pe
    // oricare din ele agață traficul autentificat, ceea ce s-a și întâmplat pe 23
    // august — doar că acum se întâmplă mai rar, nu deloc.
    global: { fetch: fetchCuTermen() },
  });

  // getClaims(), nu getUser(): verifică semnătura ES256 LOCAL, cu JWKS-ul
  // cache-uit la nivel de modul, în loc să întrebe GoTrue peste rețea la fiecare
  // cerere care trece de matcher — inclusiv fiecare navigare RSC. ~90 ms → 1,7 ms.
  // getSession() singur NU e o alternativă: acela doar decodează cookie-ul, adică
  // date venite de la client, fără să verifice nimic.
  //
  // Fără argument: `getClaims(token)` ar sări peste `getSession()` și ar pierde
  // reînnoirea cookie-urilor sb-*, care e chiar motivul pentru care middleware-ul
  // ăsta există.
  const { data, error } = await supabase.auth.getClaims();

  return { response, autentificat: error === null && data !== null };
}
