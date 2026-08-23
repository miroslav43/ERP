// src/app/(portal)/portal/salariul-meu/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { Fluturas } from "@/components/payroll/fluturas";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { fisaMea } from "@/lib/queries/portal";
import { citesteFluturasulPropriu, listeazaBonusuriSiRetineri } from "@/lib/queries/payroll";
import { Wallet } from "lucide-react";

import { AVERTISMENT_SALARIZARE } from "../../../(app)/salarizare/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Salariul meu" };

export default async function PaginaSalariulMeu() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta fluturașul de salariu." />
      </div>
    );
  }

  // `fisaMea`, nu `idFisaProprie`: cea din urmă doar SORTEAZĂ după `is_primary`,
  // în timp ce `app.current_employee_id()` — prin care trec toate ramurile `own`
  // din RLS — chiar îl cere. Un cont a cărui unică fișă nu e principală primea
  // altfel un ecran care îi arăta numele și nicio dată, fără nicio explicație.
  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const propriaFisaId = stare.fisa.id;

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
    <div className="mx-auto max-w-2xl space-y-4 p-4">
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
