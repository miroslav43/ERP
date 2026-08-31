// src/app/(app)/onboarding/sabloane/nou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";

import { AsistentSablon } from "../_componente/asistent-sablon";
import { optiuniAsistent } from "../_componente/optiuni";

export const metadata: Metadata = { title: "Șablon de checklist nou" };

export default async function PaginaSablonNou() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "checklists:create", "all")) {
    return (
      <AccesRestrictionat mesaj="Șabloanele pot fi create doar de administratorii integrării. Solicitați dreptul necesar dacă aveți nevoie de el." />
    );
  }

  const optiuni = await optiuniAsistent(tenant.organizationId);

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/onboarding/sabloane" className="underline-offset-2 hover:underline">
            Șabloane
          </Link>
        </p>
        <AntetPagina
          titlu="Parcurs de integrare nou"
          descriere="Antetul, etapele și pașii se salvează deodată, la final."
        />
      </div>

      <AsistentSablon
        departamente={optiuni.departamente}
        cursuri={optiuni.cursuri}
        materiale={optiuni.materiale}
        angajati={optiuni.angajati}
        astazi={todayInBucharest()}
      />
    </div>
  );
}
