// src/app/(app)/mentenanta/setari/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { optiuniAngajati, setariMentenanta } from "@/lib/queries/maintenance";

import { FormularSetariMentenanta } from "./formular-setari-mentenanta";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_MENTENANTA } from "@/config/file-module";

export const metadata: Metadata = { title: "Setări mentenanță" };

/**
 * Setările modulului (0181, `maintenance_settings`): cine primește sesizările,
 * termenele și programul utilajelor. Poarta e `maintenance:update = all` —
 * aceeași pe care o cere politica tabelei; `manager` cu `team` ar atinge zero
 * rânduri, deci nici nu-i arătăm formularul.
 */
export default async function PaginaSetariMentenanta() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:update", "all")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a configura mentenanța. Setările le schimbă administratorul organizației." />
    );
  }

  const [setari, angajati] = await Promise.all([
    setariMentenanta(tenant.organizationId),
    optiuniAngajati(tenant.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Setări mentenanță"
        descriere="Cine primește sesizările, termenele de închidere și avertizare, programul de lucru al utilajelor."
        file={<FileModul eticheta="Navigare mentenanță" file={FILE_MENTENANTA} tenant={tenant} />}
      />
      <div className={`${LATIMI.formular}`}>
        <FormularSetariMentenanta setari={setari} angajati={angajati} />
      </div>
    </div>
  );
}
