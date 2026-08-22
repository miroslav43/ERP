// src/app/(app)/angajati/[id]/editeaza/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { citesteAngajat } from "@/lib/queries/employees";

import { FormularAngajat } from "../../formular-angajat";

export const metadata: Metadata = { title: "Editează fișa angajatului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaEditeazaAngajat({ params }: ProprietatiPagina) {
  const { id } = await params;
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (scopeFor(permisiuni, "employees:update") !== "all") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a edita fișele de personal. Această operațiune este rezervată personalului de resurse umane." />
    );
  }

  const angajat = await citesteAngajat(tenant.organizationId, id, "all", null);
  if (angajat === null) notFound();

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
        <h1 className="text-2xl font-semibold">Editează fișa — {angajat.full_name}</h1>
        <p className="text-muted-foreground text-sm">
          CNP-ul și IBAN-ul rămân neschimbate dacă lăsați câmpurile goale.
        </p>
      </header>
      <FormularAngajat
        departamente={departamente.data ?? []}
        functii={functii.data ?? []}
        angajatExistent={{
          id: angajat.id,
          last_name: angajat.last_name,
          first_name: angajat.first_name,
          email_personal: angajat.email_personal,
          telefon: angajat.telefon,
          data_nasterii: angajat.data_nasterii,
          gen: angajat.gen,
          department_id: angajat.department?.id ?? null,
          job_position_id: angajat.job_position?.id ?? null,
          hired_on: angajat.hired_on,
        }}
      />
    </main>
  );
}
