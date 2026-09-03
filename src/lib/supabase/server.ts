// src/lib/supabase/server.ts
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/config/env";
import type { Database } from "@/types/database";

import { fetchCuTermen } from "./fetch-cu-termen";
import { OPTIUNI_COOKIE } from "./optiuni-cookie";

/**
 * Clientul folosit în Server Components și Server Actions. Rulează cu cheia
 * `anon` și cu sesiunea utilizatorului, deci fiecare interogare trece prin RLS.
 *
 * Când `pnpm db:types` generează `src/types/database.ts`, singura modificare
 * necesară este `createServerClient<Database>(...)` aici, în `browser.ts` și în
 * `admin.ts`. Restul codului rămâne neatins.
 */
export type ServerSupabase = ReturnType<typeof createServerClient<Database>>;

/**
 * Un client NOU pentru fiecare request. Nu se ridică la nivel de modul și nu se
 * memoizează între requesturi: instanța ține sesiunea, iar una partajată ar
 * servi sesiunea unui utilizator altuia.
 */
export async function createServerSupabase(): Promise<ServerSupabase> {
  const store = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch (eroare) {
            // Capcană: `cookies().set()` aruncă dacă suntem într-un Server
            // Component (răspunsul a început deja). Într-o Server Action apelul
            // reușește și cookie-ul se scrie.
            //
            // Reîmprospătarea prin `updateSession()` din `proxy.ts` acoperă
            // MAJORITATEA cererilor, dar nu pe toate: rutele `/api/` și
            // prefetch-urile de `<Link>` ies din proxy ÎNAINTE de
            // `updateSession()` (vezi comentariile de acolo). O cerere ajunsă
            // aici pe una din căile alea poate găsi refresh-tokenul deja ROTIT
            // de GoTrue (sub 90 s până la expirare) — iar scrierea eșuată de mai
            // sus înseamnă că rotația aia se pierde: browserul rămâne cu un
            // token deja consumat, pe care GoTrue îl revocă la următoarea
            // folosire. Simptomul e „deconectare aleatorie", fără nimic altceva
            // în jurnal — de-aia avertismentul de mai jos.
            console.warn(
              "createServerSupabase: scrierea cookie-ului de sesiune a eșuat într-un Server Component — posibilă rotație de refresh-token pierdută, utilizatorul poate fi deconectat la următoarea cerere",
              eroare,
            );
          }
        },
      },
      // Durata și transportul sesiunii, scrise explicit. Fără linia asta se
      // moștenea tăcut implicitul bibliotecii, inclusiv absența lui `Secure`.
      cookieOptions: OPTIUNI_COOKIE,
      // `fetch` cu termen pe antet: fără el, un socket agățat spre Supabase
      // blochează cererea la infinit. Vezi `fetch-cu-termen.ts` pentru
      // incidentul care a impus-o.
      global: {
        headers: { "x-application-name": "administrativo" },
        fetch: fetchCuTermen(),
      },
    },
  );
}
