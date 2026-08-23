// src/app/(app)/mentenanta/echipamente/nou/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature, getEnabledFeatures } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { FormularEchipament } from "../formular-echipament";

export const metadata: Metadata = { title: "Echipament nou" };

export default async function PaginaEchipamentNou() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:update", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a adăuga echipamente. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const db = await createServerSupabase();
  const [{ data: angajati }, { data: departamente }, features] = await Promise.all([
    db
      .from("employees")
      .select("id, full_name")
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    db
      .from("departments")
      .select("id, denumire")
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .order("denumire", { ascending: true }),
    getEnabledFeatures(tenant.organizationId),
  ]);

  return (
    <main className="space-y-6 p-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/mentenanta/echipamente" className="underline-offset-2 hover:underline">
            Echipamente
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Echipament nou</h1>
      </div>

      <FormularEchipament
        angajati={(angajati ?? []).map((a) => ({ id: a.id, nume: a.full_name ?? "—" }))}
        departamente={(departamente ?? []).map((d) => ({ id: d.id, nume: d.denumire }))}
        ssmActiv={features.has("ssm")}
        poateDerogare={can(permisiuni, "maintenance:update", "all")}
      />
    </main>
  );
}
