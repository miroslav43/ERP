// src/app/(app)/angajati/nou/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/ui/cn";

import { AsistentAngajatNou } from "./_components/asistent-angajat-nou";

export const metadata: Metadata = { title: "Angajat nou" };

const ZILE_CONCEDIU_IMPLICIT_FALLBACK = 20;

export default async function PaginaAngajatNou() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (scopeFor(permisiuni, "employees:create") !== "all") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a adăuga angajați. Această operațiune este rezervată personalului de resurse umane." />
    );
  }

  const db = await createServerSupabase();
  const [departamente, functii, angajati, organizatie, obiecteInventar] = await Promise.all([
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
    db
      .from("employees")
      .select("id, full_name")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name"),
    db
      .from("organizations")
      .select("zile_concediu_anual_implicit")
      .eq("id", tenant.organizationId)
      .maybeSingle(),
    // Golul dacă modulul Inventar nu e activat: RLS filtrează tăcut, nu aruncă.
    db
      .from("inventory_items")
      .select("id, denumire, numar_inventar")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "in_stoc")
      .order("denumire"),
  ]);

  return (
    <div className={cn(LATIMI.formular, "space-y-6")}>
      <AntetPagina
        titlu="Înrolare angajat"
        descriere="Un singur formular pentru fișa de personal, contractul de muncă și fișa postului — marca se atribuie automat, iar contractul și documentele se generează la trimitere."
      />
      <AsistentAngajatNou
        departamente={departamente.data ?? []}
        functii={functii.data ?? []}
        angajati={(angajati.data ?? []).map((a) => ({
          id: a.id,
          full_name: a.full_name ?? "",
        }))}
        zileConcediuImplicit={
          organizatie.data?.zile_concediu_anual_implicit ?? ZILE_CONCEDIU_IMPLICIT_FALLBACK
        }
        obiecteDisponibile={obiecteInventar.data ?? []}
      />
    </div>
  );
}
