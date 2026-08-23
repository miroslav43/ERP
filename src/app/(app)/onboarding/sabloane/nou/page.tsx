// src/app/(app)/onboarding/sabloane/nou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";

import { FormularSablon } from "./formular-sablon";

export const metadata: Metadata = { title: "Șablon de checklist nou" };

interface OptiuneDenumita {
  readonly id: string;
  readonly denumire: string;
}

export default async function PaginaSablonNou() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "checklists:create", "all")) {
    return (
      <AccesRestrictionat mesaj="Șabloanele pot fi create doar de administratorii integrării. Solicitați dreptul necesar dacă aveți nevoie de el." />
    );
  }

  // Cel mai bun efort: `departments_select`/`job_positions_select` cer
  // `departments:read`, pe care nu orice rol cu `checklists:create` îl are.
  // O listă goală înseamnă doar câmpuri opționale nefolosite, nu o eroare.
  const db = await createServerSupabase();
  const [departamenteRes, posturiRes] = await Promise.all([
    db
      .from("departments")
      .select("id, denumire")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .order("denumire")
      .limit(200)
      .returns<OptiuneDenumita[]>(),
    db
      .from("job_positions")
      .select("id, denumire")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .order("denumire")
      .limit(200)
      .returns<OptiuneDenumita[]>(),
  ]);

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/onboarding/sabloane" className="underline-offset-2 hover:underline">
            Șabloane
          </Link>
        </p>
        <AntetPagina
          titlu="Șablon de checklist nou"
          descriere="Pașii se adaugă după salvare, din fișa șablonului."
        />
      </div>

      <FormularSablon
        departamente={departamenteRes.data ?? []}
        posturi={posturiRes.data ?? []}
        astazi={todayInBucharest()}
      />
    </div>
  );
}
