import "server-only";

import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AppRole, OrgSummary } from "@/lib/tenant/types";

/**
 * Organizațiile în care utilizatorul curent este membru activ.
 *
 * Alimentează comutatorul din topbar și ecranul „alege organizația". Nu
 * primește niciun `user_id` ca argument: identitatea vine din sesiune, iar
 * filtrarea o face RLS pe `organization_members`. Un apelant nu poate cere
 * organizațiile altcuiva pentru că nu are cum să o exprime.
 *
 * Memoizat pe durata unui request: layout-ul și topbar-ul îl pot cere amândouă
 * fără să lovească baza de două ori.
 */
export const listUserOrganizations = cache(async (): Promise<readonly OrgSummary[]> => {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations!inner(id, slug, name, status, deleted_at)")
    .is("deleted_at", null)
    .eq("status", "active");

  if (error) {
    console.error("[queries/organizations] listUserOrganizations", error);
    return [];
  }

  type Rand = {
    role: AppRole;
    organizations: {
      id: string;
      slug: string;
      name: string;
      status: string;
      deleted_at: string | null;
    } | null;
  };

  return (data as unknown as Rand[])
    .flatMap((rand) => {
      const org = rand.organizations;
      // O organizație suspendată sau ștearsă nu apare în comutator: accesul ei
      // este oricum stins de `app.current_org_ids()`, iar afișarea ei ar produce
      // un comutator care duce într-un ecran gol.
      if (org === null || org.deleted_at !== null) return [];
      if (org.status !== "active" && org.status !== "pending") return [];
      return [{ id: org.id, slug: org.slug, name: org.name, role: rand.role } satisfies OrgSummary];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));
});
