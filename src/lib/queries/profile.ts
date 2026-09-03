// src/lib/queries/profile.ts
// Citirea profilului propriu — un singur rând, garantat de `profiles_select`
// (`id = auth.uid()`), nu de vreun filtru de organizație.

import { createServerSupabase } from "@/lib/supabase/server";

import { citesteTot } from "./citeste-tot";

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

/**
 * Toate avatarurile vizibile prin RLS — varianta FĂRĂ filtrul pe listă de
 * conturi din `avataturiPeUtilizatori`.
 *
 * ── DE CE O FUNCȚIE NOUĂ, NU `avataturiPeUtilizatori` MODIFICATĂ ──────────
 * `avataturiPeUtilizatori` are mulți alți apelanți (`lib/queries/employees.ts`)
 * pentru care filtrul pe id-uri e exact ce vor — nu li se schimbă semnătura.
 *
 * ── DE CE FĂRĂ FILTRU AICI, ȘI DE CE `citesteTot` ─────────────────────────
 * `/departamente` are nevoie de avatare ÎNAINTE să existe lista de angajați și
 * de structura departamentelor, ca citirea să plece în ACELAȘI val cu ele, nu
 * după. Filtrul `.in(id-uri)` cerea exact id-urile alea, deci întârzia fără
 * rost. Politica `profiles_select` restrânge deja prin `app.shares_org(id)`;
 * filtrul nu adăuga izolare. Fără el, rezultatul nu mai e mărginit la firma
 * apelantului — crește cu numărul de profiluri al PLATFORMEI vizibile prin
 * `shares_org`, iar PostgREST trunchiază tăcut la 1000 de rânduri — de-aia
 * `citesteTot`, nu `.limit()`.
 */
export async function toateAvatarurile(): Promise<ReadonlyMap<string, string | null>> {
  const db = await createServerSupabase();
  const randuri = await citesteTot<{ id: string; avatar_path: string | null }>(
    (dupa, pas) => {
      const q = db
        .from("profiles")
        .select("id, avatar_path")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(pas);
      return (dupa === null ? q : q.gt("id", dupa)).returns<
        { id: string; avatar_path: string | null }[]
      >();
    },
    (rand) => rand.id,
    { nume: "avatarurile" },
  );

  return new Map(randuri.map((rand) => [rand.id, rand.avatar_path]));
}
