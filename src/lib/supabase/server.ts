// src/lib/supabase/server.ts
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/config/env";
import type { Database } from "@/types/database";

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
          } catch {
            // Capcană: `cookies().set()` aruncă dacă suntem într-un Server
            // Component (răspunsul a început deja). Refresh-ul token-ului e
            // făcut oricum de middleware, deci pierderea e inofensivă aici.
            // Într-o Server Action apelul reușește și cookie-ul se scrie.
          }
        },
      },
      global: { headers: { "x-application-name": "administrativo" } },
    },
  );
}
