// src/lib/queries/profile.ts
// Citirea profilului propriu — un singur rând, garantat de `profiles_select`
// (`id = auth.uid()`), nu de vreun filtru de organizație.

import { createServerSupabase } from "@/lib/supabase/server";

export interface ProfilPropriu {
  readonly id: string;
  readonly email: string;
  readonly full_name: string | null;
  readonly phone: string | null;
  readonly last_seen_at: string | null;
  readonly created_at: string;
}

export async function citesteProfilPropriu(userId: string): Promise<ProfilPropriu | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("profiles")
    .select("id, email, full_name, phone, last_seen_at, created_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle<ProfilPropriu>();

  if (error !== null) throw error;
  return data;
}
