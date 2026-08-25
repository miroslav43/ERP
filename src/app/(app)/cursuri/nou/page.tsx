// src/app/(app)/cursuri/nou/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { FormularCurs } from "./formular-curs";

export const metadata: Metadata = { title: "Curs nou" };

export default async function PaginaCursNou() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "courses");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "courses:create", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a crea cursuri." />;
  }

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <AntetPagina
        titlu="Curs nou"
        descriere="După ce îl creați, adăugați lecțiile din bibliotecă, apoi publicați-l."
        firimituri={[{ eticheta: "Cursuri", href: "/cursuri" }, { eticheta: "Curs nou" }]}
      />
      <FormularCurs />
    </div>
  );
}
