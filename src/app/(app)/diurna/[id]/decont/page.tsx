// src/app/(app)/diurna/[id]/decont/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteDeplasare } from "@/lib/queries/per-diem";

import { ContinutDecont } from "./continut-decont";

export const metadata: Metadata = { title: "Decont deplasare" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Pagină printabilă — layout propriu, ascuns de meniu la tipărire.
 *
 * Documentul în sine e `ContinutDecont`, comun cu portalul
 * (`/portal/diurna-mea/[id]/decont`): aici rămâne doar preambulul aplicației
 * mari. Învelișul poartă `data-tipar="ascunde"`, iar regula e o singură dată în
 * `globals.css`, deci orice ecran din produs se tipărește curat.
 */
export default async function PaginaDecont({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "per_diem"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const deplasare = await citesteDeplasare(tenant.organizationId, id);
  if (deplasare === null) notFound();

  return (
    <ContinutDecont
      organizationId={tenant.organizationId}
      deplasare={deplasare}
      caleFisa={`/diurna/${deplasare.id}`}
    />
  );
}
