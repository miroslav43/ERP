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
import { anunturiPublicate, citesteAnunt, idAnunturiCitite } from "@/lib/queries/announcements";

import { MarcheazaCitit } from "@/app/(app)/anunturi/[id]/marcheaza-citit";
import Link from "next/link";

export const metadata: Metadata = { title: "Anunț" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaAnuntPortal({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "announcements"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

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
  // Următorul anunț necitit, ca omul să le parcurgă pe rând fără să se întoarcă
  // în listă după fiecare. Aceleași două citiri ca pe ecranul de start.
  const [publicate, citite] =
    propriaFisaId === null
      ? [[], new Set<string>()]
      : await Promise.all([
          anunturiPublicate(tenant.organizationId, new Date().toISOString()),
          idAnunturiCitite(tenant.organizationId, propriaFisaId),
        ]);
  const urmatorulNecitit = publicate.find((a) => a.id !== anunt.id && !citite.has(a.id)) ?? null;

  return (
    <div className="space-y-4 p-4">
      <p className="text-muted-foreground text-corp">
        <Link href="/portal/anunturi" className="underline-offset-2 hover:underline">
          Anunțuri
        </Link>
      </p>
      <div>
        <h1 className="text-foreground text-titlu font-semibold">{anunt.titlu}</h1>
        <p className="text-muted-foreground text-nota mt-1">
          {anunt.publicat_la === null ? "" : `Publicat ${formatDateTime(anunt.publicat_la)}`}
        </p>
      </div>

      <div className="bg-surface border-border rounded-panou text-corp border p-4 whitespace-pre-wrap">
        {anunt.continut}
      </div>

      {propriaFisaId !== null ? <MarcheazaCitit id={anunt.id} /> : null}

      {urmatorulNecitit === null ? null : (
        <p className="text-corp">
          <Link
            href={`/portal/anunturi/${urmatorulNecitit.id}`}
            className="underline underline-offset-2"
          >
            Următorul necitit: {urmatorulNecitit.titlu}
          </Link>
        </p>
      )}
    </div>
  );
}
