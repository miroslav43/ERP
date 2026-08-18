// src/app/(app)/diurna/noua/page.tsx
import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";
import { baremeleTarilor, politicaLaData, tari } from "@/lib/queries/per-diem";

import { FormularDeplasare } from "./formular-deplasare";

export const metadata: Metadata = { title: "Deplasare nouă" };

interface AngajatMinim {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

export default async function PaginaDeplasareNoua() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "per_diem:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a înregistra deplasări. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateConfiguraPolitica = can(permisiuni, "per_diem:update", "all");
  const azi = todayInBucharest();
  const politica = await politicaLaData(tenant.organizationId, azi);

  if (politica === null) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold">Deplasare nouă</h1>
        </header>
        <EmptyState
          icon={Settings}
          title="Politica de diurnă nu este configurată"
          description={
            poateConfiguraPolitica
              ? "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Configurați pragurile și baremul firmei."
              : "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Cereți administratorului organizației să configureze politica firmei."
          }
          {...(poateConfiguraPolitica
            ? { action: { label: "Configurează politica", href: "/diurna/politica" } }
            : {})}
        />
      </main>
    );
  }

  const poateAlegeAngajat = can(permisiuni, "per_diem:create", "all");
  const listaTari = await tari();
  const baremuri = await baremeleTarilor(listaTari.map((t) => t.id));

  let angajati: readonly AngajatMinim[] | null = null;
  if (poateAlegeAngajat) {
    const db = await createServerSupabase();
    const { data } = await db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .returns<AngajatMinim[]>();
    angajati = data ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Deplasare nouă</h1>
        <p className="text-sm text-muted-foreground">
          Zilele și suma diurnei se calculează pe măsură ce completați formularul; suma finală se
          verifică din nou, exact, pe fișa deplasării, după ce adăugați etapele reale ale
          traseului.
        </p>
      </header>

      <FormularDeplasare tari={listaTari} politica={politica} baremuri={baremuri} angajati={angajati} />
    </main>
  );
}
