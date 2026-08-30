// src/app/(app)/onboarding/sabloane/_componente/optiuni.ts
//
// Listele din care alege asistentul de șablon: departamente, posturi, cursuri
// publicate și angajați. Stau aici, nu în fiecare pagină, fiindcă „nou” și
// „[id]” au nevoie de exact aceleași patru și le-ar fi scris de două ori.

import { getEnabledFeatures } from "@/lib/auth/features";
import { angajatiActivi } from "@/lib/queries/checklist";
import { listeazaCursuri } from "@/lib/queries/cursuri";
import { createServerSupabase } from "@/lib/supabase/server";

export interface OptiuneDenumita {
  readonly id: string;
  readonly denumire: string;
}

export interface OptiuneAngajat {
  readonly id: string;
  readonly nume: string;
}

export interface OptiuniAsistent {
  readonly departamente: readonly OptiuneDenumita[];
  readonly cursuri: readonly OptiuneDenumita[];
  readonly materiale: readonly OptiuneDenumita[];
  readonly angajati: readonly OptiuneAngajat[];
}

export async function optiuniAsistent(organizationId: string): Promise<OptiuniAsistent> {
  const db = await createServerSupabase();

  /*
   * Cursurile publicate, pentru pasul de tip „curs” (0076).
   *
   * `getEnabledFeatures` decide, nu un try/catch: `requireFeature` ar da 404 pe
   * TOATĂ pagina dacă modulul de cursuri e stins, iar șabloanele de integrare
   * n-au nicio treabă cu asta. Lista goală face cardul să apară dezactivat, cu
   * motivul scris — nu să dispară fără explicație.
   */
  const moduleActive = await getEnabledFeatures(organizationId);

  // Cel mai bun efort pe toate patru: `departments_select` cere
  // `departments:read`, iar `employees_select` cere `employees:read` — niciunul
  // garantat pentru cine are `checklists:create`. O listă goală înseamnă un
  // câmp opțional nefolosit, nu o eroare de pagină.
  const [departamenteRes, cursuri, materialeRes, angajati] = await Promise.all([
    db
      .from("departments")
      .select("id, denumire")
      .eq("organization_id", organizationId)
      .eq("activ", true)
      .order("denumire")
      .limit(200)
      .returns<OptiuneDenumita[]>(),
    moduleActive.has("courses")
      ? listeazaCursuri(organizationId, {
          doar_publicate: "da",
          cauta: null,
          cursor: null,
          limita: 100,
        }).then((r) => r.randuri.map((c) => ({ id: c.id, denumire: c.denumire })))
      : Promise.resolve([]),
    // Materialele cu o versiune publicată. Fără versiune n-ar fi ce citi, iar
    // pasul s-ar naște nebifabil — aceeași lecție ca la `curs_finalizat`.
    moduleActive.has("courses")
      ? db
          .from("course_materials")
          .select("id, titlu")
          .eq("organization_id", organizationId)
          .not("versiune_curenta_id", "is", null)
          .is("deleted_at", null)
          .order("titlu")
          .limit(200)
          .returns<{ id: string; titlu: string }[]>()
      : Promise.resolve({ data: [] as { id: string; titlu: string }[] }),
    angajatiActivi(organizationId).then((lista) =>
      lista.map((a) => ({ id: a.id, nume: a.full_name ?? a.marca })),
    ),
  ]);

  return {
    departamente: departamenteRes.data ?? [],
    cursuri,
    materiale: (materialeRes.data ?? []).map((m) => ({ id: m.id, denumire: m.titlu })),
    angajati,
  };
}
