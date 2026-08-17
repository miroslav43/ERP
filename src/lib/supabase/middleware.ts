// src/lib/supabase/middleware.ts
import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

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
  user: User | null;
}>;

/**
 * Reîmprospătează cookie-urile de sesiune Supabase și spune dacă requestul are
 * un utilizator autentificat. NU decide nimic despre organizație și nu
 * autorizează nimic — vezi comentariul din `src/middleware.ts`.
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
  });

  // getUser(), niciodată getSession(): getSession decodează doar cookie-ul,
  // care este dată venită de la client. getUser() validează token-ul la
  // serverul de auth și este singurul rezultat de încredere pe server.
  const { data } = await supabase.auth.getUser();

  return { response, user: data.user };
}
