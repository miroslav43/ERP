// src/lib/auth/current-user.ts
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/tenant/types";

/**
 * Singurul loc din aplicație care întreabă „cine e utilizatorul?”.
 * Memoizat cu `React.cache()`: apelat de N ori într-un render, face un singur
 * drum la serverul de auth.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createServerSupabase();

  // getUser() validează token-ul la GoTrue. getSession() doar decodează
  // cookie-ul — adică date venite de la client — și nu se folosește pe server.
  const { data, error } = await supabase.auth.getUser();
  if (error !== null || data.user === null) return null;

  const numeBrut: unknown = data.user.user_metadata["full_name"];
  const nume = typeof numeBrut === "string" ? numeBrut.trim() : "";

  return {
    id: data.user.id,
    // Conturile fără e-mail nu sunt suportate în Faza 1a (vezi
    // `internal.handle_new_user`), dar tipul din SDK permite null.
    email: data.user.email ?? "",
    fullName: nume.length > 0 ? nume : null,
  };
});

/** Pentru pagini/layout-uri RSC. În Server Actions se folosește `resolveTenant()`. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user === null) redirect("/autentificare");
  return user;
}
