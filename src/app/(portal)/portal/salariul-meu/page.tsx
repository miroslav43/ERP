// src/app/(portal)/portal/salariul-meu/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { Fluturas } from "@/components/payroll/fluturas";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idFisaProprie } from "@/lib/queries/employees";
import { citesteFluturasulPropriu, listeazaBonusuriSiRetineri } from "@/lib/queries/payroll";
import { Wallet } from "lucide-react";

import { AVERTISMENT_SALARIZARE } from "../../../(app)/salarizare/etichete";

export const metadata: Metadata = { title: "Salariul meu" };

export default async function PaginaSalariulMeu() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "payroll:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta fluturașul de salariu." />
      </div>
    );
  }

  const propriaFisaId = await idFisaProprie(tenant.organizationId, user.id);
  if (propriaFisaId === null) {
    return (
      <div className="p-4">
        <div className="bg-surface border-border rounded-lg border p-6 text-center">
          <h1 className="text-foreground text-lg font-semibold">
            Nu aveți încă o fișă de personal
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Salariul se leagă de un angajat. Cereți resurselor umane să vă completeze fișa.
          </p>
        </div>
      </div>
    );
  }

  const inregistrare = await citesteFluturasulPropriu(tenant.organizationId, propriaFisaId);
  const { bonusuri, retineri } =
    inregistrare === null
      ? { bonusuri: [], retineri: [] }
      : await listeazaBonusuriSiRetineri(
          tenant.organizationId,
          inregistrare.period_id,
          inregistrare.employee_id,
        );

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-foreground text-xl font-semibold">Salariul meu</h1>

      {inregistrare === null ? (
        <EmptyState
          icon={Wallet}
          title="Niciun fluturaș disponibil încă"
          description="Fluturașul apare aici după ce luna e calculată și aprobată de resurse umane."
        />
      ) : (
        <>
          <p className="text-muted-foreground border-warning/40 bg-warning/8 rounded-lg border p-3 text-xs">
            {AVERTISMENT_SALARIZARE}
          </p>
          <Fluturas inregistrare={inregistrare} bonusuri={bonusuri} retineri={retineri} />
        </>
      )}
    </div>
  );
}
