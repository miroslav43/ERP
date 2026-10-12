// src/app/(portal)/portal/sesizari/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { optiuniAngajati } from "@/lib/queries/maintenance";
import { esteTerminala } from "@/domain/maintenance/sesizari";
import {
  actorPentru,
  incarcaFisaSesizare,
} from "@/app/(app)/mentenanta/sesizari/[id]/date-sesizare";
import { FisaSesizare } from "@/app/(app)/mentenanta/sesizari/[id]/fisa-sesizare";

export const metadata: Metadata = { title: "Sesizarea mea" };

/**
 * Fișa sesizării în portal — a raportorului sau a tehnicianului atribuit.
 *
 * Garda de proprietate, ca la tichet: politica de SELECT are ramuri legitime
 * pentru gestionari, dar sub eticheta „sesizarea mea” o rută de portal n-are
 * ce deschide altcuiva. Un gestionar o citește din aplicație.
 */
export default async function PaginaSesizareaMea({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
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
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune." />
      </div>
    );
  }

  const date = await incarcaFisaSesizare(tenant.organizationId, id, user.id);
  if (date === null) notFound();

  const poateGestiona = can(permisiuni, "maintenance:update", "team");
  const actor = actorPentru(date, poateGestiona, user.id);
  if (actor.esteRaportor !== true && actor.esteTehnician !== true) notFound();

  const angajati = esteTerminala(date.sesizare.status)
    ? []
    : await optiuniAngajati(tenant.organizationId);

  return (
    <div className={`${LATIMI.formular} p-4`}>
      <FisaSesizare
        date={date}
        hrefRaporteazaDinNou={
          can(permisiuni, "maintenance:create", "own")
            ? `/portal/sesizari/noua?echipament=${date.sesizare.equipment_id}`
            : null
        }
        zona="portal"
        actor={actor}
        userId={user.id}
        angajati={angajati}
        azi={todayInBucharest()}
        acum={new Date().toISOString()}
      />
    </div>
  );
}
