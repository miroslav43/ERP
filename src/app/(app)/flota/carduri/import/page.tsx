import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_FLOTA } from "@/config/file-module";
import { requireFeature } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { ImportExtrasClient } from "./import-extras-client";

export const metadata: Metadata = { title: "Import extras de card" };

/**
 * Importul extraselor de card (0214, F12b). Analiza cere `vehicles:create`
 * (urcarea în `{org}/vehicles/…`), aplicarea `vehicles:update`: pagina se
 * deschide doar cu amândouă la `all`, ca omul să nu ajungă la jumătatea
 * drumului într-un refuz.
 */
export default async function PaginaImportExtras() {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "vehicles:create", "all") || !can(permisiuni, "vehicles:update", "all")) {
    return (
      <AccesRestrictionat mesaj="Extrasele de card le importă administratorul parcului auto." />
    );
  }

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Import extras de card"
        descriere="Încărcați extrasul lunar de la emitentul cardurilor (.csv sau .xlsx). Vedeți întâi previzualizarea; nimic nu se scrie până nu confirmați."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
      />
      <ImportExtrasClient />
    </div>
  );
}
