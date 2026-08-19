// src/lib/queries/profile.ts
// Citirea profilului propriu — un singur rând, garantat de `profiles_select`
// (`id = auth.uid()`), nu de vreun filtru de organizație.

import { createServerSupabase } from "@/lib/supabase/server";

export interface ProfilPropriu {
  readonly id: string;
  readonly email: string;
  readonly full_name: string | null;
  readonly phone: string | null;
  readonly avatar_path: string | null;
  readonly last_seen_at: string | null;
  readonly created_at: string;
}

export async function citesteProfilPropriu(userId: string): Promise<ProfilPropriu | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("profiles")
    .select("id, email, full_name, phone, avatar_path, last_seen_at, created_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle<ProfilPropriu>();

  if (error !== null) throw error;
  return data;
}

/**
 * Poza fiecărui cont, într-un singur query — nu una per angajat din listă.
 * `userIds` poate conține `null`/duplicate (angajați fără cont în portal);
 * ambele se filtrează aici, ca apelantul să nu trebuiască să le cureți el.
 */
export async function avataturiPeUtilizatori(
  userIds: readonly (string | null)[],
): Promise<ReadonlyMap<string, string | null>> {
  const idUnice = [...new Set(userIds.filter((id): id is string => id !== null))];
  if (idUnice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("profiles")
    .select("id, avatar_path")
    .in("id", idUnice)
    .is("deleted_at", null)
    .returns<{ id: string; avatar_path: string | null }[]>();
  if (error !== null) throw error;

  return new Map((data ?? []).map((rand) => [rand.id, rand.avatar_path]));
}
