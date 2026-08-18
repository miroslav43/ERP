// src/app/(app)/flota/nou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { FormularVehicul } from "./formular-vehicul";

export const metadata: Metadata = { title: "Vehicul nou" };

export default async function PaginaVehiculNou() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "vehicles:create", "all")) {
    return (
      <AccesRestrictionat mesaj="Vehiculele pot fi adăugate doar de administratorii organizației. Solicitați dreptul necesar dacă aveți nevoie de el." />
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          <Link href="/flota" className="underline-offset-2 hover:underline">
            Parc auto
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Vehicul nou</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Numărul de înmatriculare și VIN-ul se normalizează automat la salvare — scrieți-le
          cum vă e comod.
        </p>
      </header>

      <FormularVehicul />
    </main>
  );
}
