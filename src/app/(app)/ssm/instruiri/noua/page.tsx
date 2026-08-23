// src/app/(app)/ssm/instruiri/noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { tipuriInstruire } from "@/lib/queries/ssm";

import { FormularInstruireBloc } from "./formular-instruire-bloc";

export const metadata: Metadata = { title: "Instruire nouă" };

export default async function PaginaInstruireNoua() {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:create", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a înregistra instruiri SSM/PSI. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const tipuri = await tipuriInstruire(tenant.organizationId);
  if (tipuri.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <EmptyState
          icon={GraduationCap}
          title="Niciun tip de instruire configurat"
          description="Nomenclatorul de tipuri de instruire se completează de administratorul organizației."
        />
      </main>
    );
  }

  const db = await createServerSupabase();
  const { data: angajati } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", tenant.organizationId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .order("full_name")
    .limit(500);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">
          <Link href="/ssm/instruiri" className="underline-offset-2 hover:underline">
            Instruiri
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Instruire nouă</h1>
        <p className="text-muted-foreground text-sm">
          Un tip, o dată, câți angajați aveți nevoie — toți intră într-o singură înregistrare.
        </p>
      </header>

      <FormularInstruireBloc
        tipuri={tipuri.map((t) => ({ id: t.id, denumire: t.denumire, domeniu: t.domeniu }))}
        angajati={(angajati ?? []).map((a) => ({
          id: a.id,
          full_name: a.full_name,
          marca: a.marca,
        }))}
      />
    </main>
  );
}
