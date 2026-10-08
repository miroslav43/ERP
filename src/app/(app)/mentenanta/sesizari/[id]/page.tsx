// src/app/(app)/mentenanta/sesizari/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { optiuniAngajati } from "@/lib/queries/maintenance";
import { esteTerminala } from "@/domain/maintenance/sesizari";

import { actorPentru, incarcaFisaSesizare } from "./date-sesizare";
import { FisaSesizare } from "./fisa-sesizare";
import { hrefFisaDinHarta } from "@/lib/navigare/fisa";

export const metadata: Metadata = { title: "Sesizare de defecțiune" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Fișa sesizării în aplicație. Poarta e `maintenance:read`/own — un
 * tehnician-angajat ajunge aici din notificare, pe sesizarea LUI; ce vede
 * dincolo de ea decide RLS (politica de SELECT are ramura „atribuită mie”).
 */
export default async function PaginaSesizare({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const date = await incarcaFisaSesizare(tenant.organizationId, id, user.id);
  if (date === null) notFound();

  const poateGestiona = can(permisiuni, "maintenance:update", "team");
  const actor = actorPentru(date, poateGestiona, user.id);
  // Selectoarele de tehnician și de executant — doar cât sesizarea mai e vie.
  // Sub RLS, un angajat primește doar fișa lui; e exact ce are nevoie.
  const angajati = esteTerminala(date.sesizare.status)
    ? []
    : await optiuniAngajati(tenant.organizationId);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <FisaSesizare
        date={date}
        zona="app"
        actor={actor}
        userId={user.id}
        angajati={angajati}
        azi={todayInBucharest()}
        acum={new Date().toISOString()}
        legaturaFisa={(idFisa) => hrefFisaDinHarta(idFisa, date.numeAngajati, permisiuni)}
      />
    </div>
  );
}
