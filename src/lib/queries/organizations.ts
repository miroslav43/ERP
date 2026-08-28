import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/current-user";
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

  /*
    `getCurrentUser()`, nu `supabase.auth.getUser()` direct.

    Sunt același drum la GoTrue, dar primul e memoizat cu `React.cache()` pe
    durata requestului, iar al doilea nu. Fișierul chema varianta nememoizată,
    deci fiecare randare plătea DOUĂ validări de token în loc de una — iar
    mediana unui apel GoTrue e, după propria măsurătoare din
    `src/lib/supabase/fetch-cu-termen.ts:35-38`, sub 130 ms.

    Se simte în patru locuri: `<Topbar/>` (pe toate paginile din `(app)`),
    `(portal)/layout.tsx`, `comutaNucleu` din `(app)/actions.ts` — care făcea
    două GoTrue în aceeași acțiune — și `/alege-organizatia`, care făcea la fel.
  */
  const user = await getCurrentUser();
  if (user === null) return [];

  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations!inner(id, slug, name, status, deleted_at)")
    // Filtrul pe `user_id` NU e redundant cu RLS, deși pare.
    //
    // Politicile din 0002 lasă un membru să-și vadă COLEGII — trebuie, altfel
    // ecranul de membri ar fi gol. Fără filtrul de aici, interogarea întorcea
    // câte un rând per coleg, iar selectorul de organizație afișa aceeași firmă
    // de cinci ori, o dată pentru fiecare membru, cu rolul LUI: „Demo SRL —
    // Angajat", „Demo SRL — Manager", „Demo SRL — Resurse umane"…
    //
    // Pe lângă lista absurdă, era și o divulgare: cine sunt colegii și ce rol
    // are fiecare, pe un ecran dinaintea alegerii organizației. Iar pentru un
    // administrator de platformă, care prin aceleași politici citește TOATE
    // apartenențele, selectorul ar fi listat toate firmele-client.
    //
    // `resolveTenant()` are exact acest filtru, cu exact acest motiv scris
    // lângă el. Aici lipsea.
    .eq("user_id", user.id)
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
