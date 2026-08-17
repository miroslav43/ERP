// src/app/(app)/angajati/nou/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { FormularAngajat } from "../formular-angajat";

export const metadata: Metadata = { title: "Angajat nou" };

export default async function PaginaAngajatNou() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (scopeFor(permisiuni, "employees:create") !== "all") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a adăuga angajați. Această operațiune este rezervată personalului de resurse umane." />
    );
  }

  const db = await createServerSupabase();
  const [departamente, functii] = await Promise.all([
    db
      .from("departments")
      .select("id, denumire")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire"),
    db
      .from("job_positions")
      .select("id, denumire")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire"),
  ]);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Angajat nou</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Fișa se creează cu starea „Candidat”. Devine activă după înregistrarea contractului
          individual de muncă.
        </p>
      </header>
      <FormularAngajat departamente={departamente.data ?? []} functii={functii.data ?? []} />
    </main>
  );
}
