// src/lib/auth/platform.ts
import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/tenant/types";

import { getCurrentUser } from "./current-user";

/**
 * Sursa de adevăr pentru rolul de platformă este tabela `platform_admins` —
 * nu o coloană booleană pe `profiles` și nu un claim în JWT. Revocarea are
 * astfel efect la următorul request, nu la expirarea token-ului.
 *
 * Funcționează indiferent de politica RLS aplicată tabelei: un utilizator
 * obișnuit fie nu vede niciun rând, fie nu vede rândul altcuiva — în ambele
 * cazuri răspunsul este `false`.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (user === null) return false;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("platform_admins")
    .select("id")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (error !== null) {
    // Fail closed: la eroare de citire NU presupunem privilegii de platformă.
    console.error("[platform] verificarea platform_admins a eșuat", {
      code: error.code,
    });
    return false;
  }

  return data !== null;
});

/**
 * Guard pentru `app/(platform)/super-admin/**`.
 *
 * Lipsa drepturilor dă 404, nu 403: consola de platformă nu se anunță celor
 * care nu au ce căuta în ea. Se repetă în fiecare Server Action din zonă —
 * layout-ul nu protejează acțiunile.
 */
export async function requirePlatformAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user === null) redirect("/autentificare");
  if (!(await isPlatformAdmin())) notFound();
  return user;
}
