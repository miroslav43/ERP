// src/app/(app)/salarizare/[id]/[entryId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { Fluturas } from "@/components/payroll/fluturas";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteInregistrare, listeazaBonusuriSiRetineri } from "@/lib/queries/payroll";

import { AVERTISMENT_SALARIZARE } from "../../etichete";

export const metadata: Metadata = { title: "Fluturaș" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string; readonly entryId: string }>;
}

export default async function PaginaFluturas({ params }: ProprietatiPagina) {
  const { id, entryId } = await params;
  idDinRuta(id);
  const idInregistrare = idDinRuta(entryId);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "payroll:read", "all")) {
    return (
      <main className="p-6">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta salarizarea." />
      </main>
    );
  }

  const inregistrare = await citesteInregistrare(tenant.organizationId, idInregistrare);
  if (inregistrare === null) notFound();
  const { bonusuri, retineri } = await listeazaBonusuriSiRetineri(
    tenant.organizationId,
    inregistrare.period_id,
    inregistrare.employee_id,
  );

  return (
    <main className="max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">
          <Link href={`/salarizare/${id}`} className="underline-offset-2 hover:underline">
            Perioada de salarizare
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">
          {inregistrare.angajat?.full_name ?? inregistrare.angajat?.marca ?? "Angajat"}
        </h1>
      </header>

      <div role="note" className="border-warning/40 bg-warning/8 rounded-lg border p-4 text-xs">
        {AVERTISMENT_SALARIZARE}
      </div>

      <Fluturas inregistrare={inregistrare} bonusuri={bonusuri} retineri={retineri} />
    </main>
  );
}
