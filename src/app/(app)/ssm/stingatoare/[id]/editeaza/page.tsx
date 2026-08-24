// src/app/(app)/ssm/stingatoare/[id]/editeaza/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteStingator } from "@/lib/queries/ssm";

import { FormularStingator } from "../../nou/formular-stingator";

export const metadata: Metadata = { title: "Editează stingătorul" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaEditeazaStingator({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:update", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a edita stingătoarele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const stingator = await citesteStingator(tenant.organizationId, id);
  if (stingator === null) notFound();

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina titlu={`Editează stingătorul ${stingator.cod}`} />
      <FormularStingator stingatorExistent={stingator} />
    </div>
  );
}
