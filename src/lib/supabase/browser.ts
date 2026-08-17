// src/lib/supabase/browser.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/config/env";
import type { Database } from "@/types/database";

export type BrowserSupabase = ReturnType<typeof createBrowserClient<Database>>;

let client: BrowserSupabase | null = null;

/**
 * Singleton per filă de browser. Două instanțe ar porni fiecare propriul timer
 * de refresh și s-ar suprascrie reciproc token-urile, cu deconectări aparent
 * aleatorii ca rezultat.
 *
 * Se folosește exclusiv pentru abonamente Realtime și pentru fluxurile de auth
 * din client. Citirile de date se fac în RSC, prin `createServerSupabase()`.
 */
export function getBrowserSupabase(): BrowserSupabase {
  client ??= createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return client;
}
