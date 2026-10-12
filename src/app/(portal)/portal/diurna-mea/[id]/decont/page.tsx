// src/app/(portal)/portal/diurna-mea/[id]/decont/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteDeplasare } from "@/lib/queries/per-diem";
import { fisaMea } from "@/lib/queries/portal";
import { ContinutDecont } from "@/app/(app)/diurna/[id]/decont/continut-decont";

import { FaraFisa } from "../../../fara-fisa";

export const metadata: Metadata = { title: "Decontul meu de deplasare" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Decontul propriu, de tipărit, din portal. Același document ca în aplicația
 * mare (`ContinutDecont`), sub preambulul portalului: modulul, `per_diem:read`
 * și garda de proprietate — deplasarea altcuiva nu există (404, nu 403).
 */
export default async function PaginaDecontulMeu({ params }: ProprietatiPagina) {
  const deplasareId = idDinRuta((await params).id);
  const { tenant, user } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "per_diem"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const deplasare = await citesteDeplasare(tenant.organizationId, deplasareId);
  if (deplasare === null || deplasare.employee_id !== stare.fisa.id) notFound();

  return (
    <div className="p-4">
      <ContinutDecont
        organizationId={tenant.organizationId}
        deplasare={deplasare}
        caleFisa={`/portal/diurna-mea/${deplasare.id}`}
      />
    </div>
  );
}
