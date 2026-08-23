// src/app/(app)/flota/foi/noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { listeazaVehicule } from "@/lib/queries/fleet";
import { Car } from "lucide-react";

import { FormularFoaie } from "./formular-foaie";

export const metadata: Metadata = { title: "Foaie de parcurs nouă" };

export default async function PaginaFoaieNoua() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "trip_sheets:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a înregistra foi de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  // Doar vehiculele din parc: unul vândut sau casat nu mai poate primi curse, iar
  // un trigger le-ar refuza oricum — mai bine nu apar deloc în listă.
  const { randuri: vehicule } = await listeazaVehicule(tenant.organizationId, {
    status: "activ",
    categorie: null,
    cauta: null,
    cursor: null,
    limita: 100,
  });

  if (vehicule.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <EmptyState
          icon={Car}
          title="Niciun vehicul în parc"
          description="O foaie de parcurs are nevoie de un vehicul activ. Adăugați întâi unul în parcul auto."
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
          <Link href="/flota/foi" className="underline-offset-2 hover:underline">
            Foi de parcurs
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Foaie de parcurs nouă</h1>
        <p className="text-muted-foreground text-sm">
          Kilometrajul de plecare se completează singur din ultimul cunoscut al vehiculului.
          Verificați-l înainte de salvare — un kilometraj mai mic decât ultimul e refuzat.
        </p>
      </header>

      <FormularFoaie
        vehicule={vehicule.map((v) => ({
          id: v.id,
          nr_inmatriculare: v.nr_inmatriculare,
          km_curent: v.km_curent,
        }))}
        angajati={(angajati ?? []).map((a) => ({
          id: a.id,
          full_name: a.full_name,
          marca: a.marca,
        }))}
      />
    </main>
  );
}
