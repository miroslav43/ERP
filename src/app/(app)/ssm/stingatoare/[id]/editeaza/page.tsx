// src/app/(app)/ssm/stingatoare/[id]/editeaza/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "ssm:update", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a edita stingătoarele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const stingator = await citesteStingator(tenant.organizationId, id);
  if (stingator === null) notFound();

  return (
    <main className="max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Editează stingătorul {stingator.cod}</h1>
      </header>
      <FormularStingator stingatorExistent={stingator} />
    </main>
  );
}
