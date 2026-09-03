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
 * Toate avatarurile membrilor unei organizații — varianta FĂRĂ filtrul pe
 * listă de conturi din `avataturiPeUtilizatori`.
 *
 * ── DE CE O FUNCȚIE NOUĂ, NU `avataturiPeUtilizatori` MODIFICATĂ ──────────
 * `avataturiPeUtilizatori` are mulți alți apelanți (`lib/queries/employees.ts`)
 * pentru care filtrul pe id-uri e exact ce vor — nu li se schimbă semnătura.
 *
 * ── DE CE UN FILTRU PE `organizationId`, NU DOAR RLS ──────────────────────
 * Varianta inițială se baza pe atât: politica `profiles_select` restrânge
 * prin `app.shares_org(id)`, care cere ca autorul cererii și profilul cerut
 * să aibă o organizație COMUNĂ — dar `shares_org` se uită la
 * `app.current_org_ids()`, adică la TOATE organizațiile în care autorul e
 * membru activ, nu doar la firma din sesiune. Pentru un cont membru activ în
 * două organizații (există cel puțin unul în producție), un `citesteTot` fără
 * filtru pe `/departamente` al firmei A traversează și membrii firmei B —
 * citire mai largă decât are nevoie pagina, deci filtrul de mai jos.
 *
 * ── DE CE DOI PAȘI, NU UN EMBED ────────────────────────────────────────────
 * Nu există cheie străină între `profiles` și `organization_members` — se
 * întâlnesc pe `organization_members.user_id = profiles.id`, nu pe o
 * referință (aceeași lipsă documentată la `rolurileConturilor` /
 * `toateRolurileConturilor` din `employees.ts`). Fără FK, PostgREST refuză
 * embed-ul, deci restrângerea se face în doi pași: întâi membrii activi ai
 * ACELEI organizații, apoi avatarele lor. Al doilea pas cere id-urile aflate
 * la primul, NU lista de angajați a apelantului — funcția tot nu depinde de
 * rezultatul vreunei alte citiri din pagină, deci pleacă în același val.
 *
 * ── DE CE `citesteTot` ─────────────────────────────────────────────────────
 * PostgREST trunchiază tăcut la 1000 de rânduri; `citesteTot` aruncă la
 * plafon în loc să tacă. Volumul real per organizație e mic azi, dar poarta
 * costă puțin și scoate capcana din discuție definitiv.
 */
export async function toateAvatarurile(
  organizationId: string,
): Promise<ReadonlyMap<string, string | null>> {
  const db = await createServerSupabase();

  const membri = await citesteTot<{ user_id: string }>(
    (dupa, pas) => {
      const q = db
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("user_id", { ascending: true })
        .limit(pas);
      return (dupa === null ? q : q.gt("user_id", dupa)).returns<{ user_id: string }[]>();
    },
    (rand) => rand.user_id,
    { nume: "membrii organizației" },
  );

  const idUnice = [...new Set(membri.map((rand) => rand.user_id))];
  if (idUnice.length === 0) return new Map();

  const randuri = await citesteTot<{ id: string; avatar_path: string | null }>(
    (dupa, pas) => {
      const q = db
        .from("profiles")
        .select("id, avatar_path")
        .in("id", idUnice)
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
