// src/app/(portal)/portal/anunturi/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { idFisaProprie } from "@/lib/queries/employees";
import { citesteAnunt } from "@/lib/queries/announcements";

import { MarcheazaCitit } from "@/app/(app)/anunturi/[id]/marcheaza-citit";

export const metadata: Metadata = { title: "Anunț" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaAnuntPortal({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "announcements");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "announcements:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta avizierul." />
      </div>
    );
  }

  const anunt = await citesteAnunt(tenant.organizationId, id);
  if (anunt === null) notFound();

  const propriaFisaId = await idFisaProprie(tenant.organizationId, user.id);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold">{anunt.titlu}</h1>
        <p className="text-muted-foreground mt-1 text-xs">
          {anunt.publicat_la === null ? "" : `Publicat ${formatDateTime(anunt.publicat_la)}`}
        </p>
      </div>

      <div className="bg-surface border-border rounded-lg border p-4 text-sm whitespace-pre-wrap">
        {anunt.continut}
      </div>

      {propriaFisaId !== null ? <MarcheazaCitit id={anunt.id} /> : null}
    </div>
  );
}
