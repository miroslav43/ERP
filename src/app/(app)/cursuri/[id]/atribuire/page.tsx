// src/app/(app)/cursuri/[id]/atribuire/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { createServerSupabase } from "@/lib/supabase/server";
import { angajatiPentruAtribuire, citesteCurs } from "@/lib/queries/cursuri";

import { FormularAtribuire } from "./formular-atribuire";

export const metadata: Metadata = { title: "Atribuire curs" };

export default async function PaginaAtribuire({
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

  if (!can(permisiuni, "courses:create", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a atribui cursuri." />;
  }

  const curs = await citesteCurs(tenant.organizationId, cursId);
  if (curs === null) notFound();

  const db = await createServerSupabase();
  const [angajati, active] = await Promise.all([
    angajatiPentruAtribuire(tenant.organizationId),
    db
      .from("course_enrollments")
      .select("employee_id")
      .eq("organization_id", tenant.organizationId)
      .eq("course_id", cursId)
      .is("deleted_at", null)
      .in("status", ["neinceput", "in_curs", "finalizat"])
      .limit(500)
      .then((r) => (r.data ?? []).map((x) => x.employee_id)),
  ]);

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <AntetPagina
        titlu="Atribuire"
        descriere={`Cine trebuie să parcurgă „${curs.denumire}”.`}
        firimituri={[
          { eticheta: "Cursuri", href: "/cursuri" },
          { eticheta: curs.denumire, href: `/cursuri/${cursId}` },
          { eticheta: "Atribuire" },
        ]}
      />

      {curs.publicat ? null : (
        <Callout fel="atentie" titlu="Cursul nu e publicat">
          Un curs nepublicat nu se poate atribui. Publicați-l din pagina cursului.
        </Callout>
      )}

      <FormularAtribuire
        cursId={cursId}
        denumire={curs.denumire}
        termenZile={curs.termen_zile}
        angajati={angajati}
        deja={active}
      />
    </div>
  );
}
