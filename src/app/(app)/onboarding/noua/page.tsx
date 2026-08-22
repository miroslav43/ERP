// src/app/(app)/onboarding/noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { angajatiActivi, sabloaneActive } from "@/lib/queries/checklist";
import { todayInBucharest } from "@/lib/format/date";

import { FormularInstanta } from "./formular-instanta";

export const metadata: Metadata = { title: "Instanță de checklist nouă" };

export default async function PaginaInstantaNoua() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "checklists:create", "all")) {
    return (
      <AccesRestrictionat mesaj="Pornirea unui checklist e rezervată celor care administrează integrarea angajaților. Solicitați dreptul necesar dacă aveți nevoie de el." />
    );
  }

  const sabloane = await sabloaneActive(tenant.organizationId);
  if (sabloane.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
        <EmptyState
          icon={ListChecks}
          title="Niciun șablon activ"
          description="O instanță de checklist pornește dintr-un șablon. Creați întâi unul, în secțiunea Șabloane."
          action={{ label: "Creează un șablon", href: "/onboarding/sabloane/nou" }}
        />
      </main>
    );
  }

  // `employees:read < team`: câmpul devine un input de identificator, cu
  // mesaj explicativ, nu un `<select>` gol.
  const poateVedeaAngajati = can(permisiuni, "employees:read", "team");
  const angajati = poateVedeaAngajati ? await angajatiActivi(tenant.organizationId) : null;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">
          <Link href="/onboarding" className="underline-offset-2 hover:underline">
            Onboarding
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Instanță de checklist nouă</h1>
        <p className="text-muted-foreground text-sm">
          Pașii se copiază automat din șablon la salvare, pe baza datei de referință alese.
        </p>
      </header>

      <FormularInstanta sabloane={sabloane} angajati={angajati} astazi={todayInBucharest()} />
    </main>
  );
}
