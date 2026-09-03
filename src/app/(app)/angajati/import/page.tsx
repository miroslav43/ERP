// src/app/(app)/angajati/import/page.tsx
import { requireFeature } from "@/lib/auth/features";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { cn } from "@/lib/ui/cn";
import { ImportAngajatiClient } from "./import-client";

export const metadata = { title: "Import angajați" };

export default async function PaginaImportAngajati() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  // (`requireFeature` tot dă 404 pentru modul dezactivat.)
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  const scop = scopeFor(permisiuni, "employees:create");

  // Dreptul se verifică și la afișare, nu doar în acțiune: scope „none” = refuz explicit.
  if (scop === null || scop === "none") {
    return (
      <AccesRestrictionat mesaj="Nu ai dreptul de a adăuga angajați. Cere unui administrator permisiunea „Angajați – creare”." />
    );
  }
  if (scop !== "all") {
    return (
      <AccesRestrictionat mesaj="Importul în masă este disponibil doar cu drepturi pe întreaga organizație." />
    );
  }

  return (
    <div className={cn(LATIMI.detaliu, "flex flex-col gap-6")}>
      <AntetPagina
        titlu="Import angajați din Excel"
        descriere="Încarci fișierul, verifici previzualizarea, apoi aplici doar rândurile corecte. Rândurile respinse se descarcă într-un raport pe care îl poți corecta și reîncărca."
      />
      <ImportAngajatiClient />
    </div>
  );
}
