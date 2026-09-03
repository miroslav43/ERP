// src/app/(app)/cursuri/[id]/reguli/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiPentruAtribuire,
  citesteCurs,
  regulileCursului,
  tinteRegula,
} from "@/lib/queries/cursuri";

import { ReguliCurs } from "./reguli-curs";

export const metadata: Metadata = { title: "Reguli de atribuire" };

export default async function PaginaReguli({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const cursId = idDinRuta(id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "courses"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta regulile de atribuire." />;
  }

  const curs = await citesteCurs(tenant.organizationId, cursId);
  if (curs === null) notFound();

  const poateEdita = can(permisiuni, "courses:create", "team");
  const [reguli, tinte, angajati] = await Promise.all([
    regulileCursului(tenant.organizationId, cursId),
    tinteRegula(tenant.organizationId),
    angajatiPentruAtribuire(tenant.organizationId),
  ]);

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <AntetPagina
        titlu="Reguli de atribuire"
        descriere={`Cine primește automat „${curs.denumire}”.`}
        firimituri={[
          { eticheta: "Cursuri", href: "/cursuri" },
          { eticheta: curs.denumire, href: `/cursuri/${cursId}` },
          { eticheta: "Reguli" },
        ]}
      />

      {curs.publicat ? null : (
        <Callout fel="atentie" titlu="Cursul nu e publicat">
          Regulile nu atribuie nimic pentru un curs nepublicat. Publicați-l din pagina cursului.
        </Callout>
      )}

      <ReguliCurs
        cursId={cursId}
        denumire={curs.denumire}
        reguli={reguli}
        departamente={tinte.departamente}
        angajati={angajati}
        poateEdita={poateEdita}
      />
    </div>
  );
}
