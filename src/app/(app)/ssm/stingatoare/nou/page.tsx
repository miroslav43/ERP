// src/app/(app)/ssm/stingatoare/nou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { FormularStingator } from "./formular-stingator";

export const metadata: Metadata = { title: "Stingător nou" };

export default async function PaginaStingatorNou() {
  await requireUser();
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "ssm"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "ssm:create", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a adăuga stingătoare. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <p className="text-muted-foreground text-corp">
        <Link href="/ssm/stingatoare" className="underline-offset-2 hover:underline">
          Stingătoare
        </Link>
      </p>

      <AntetPagina
        titlu="Stingător nou"
        descriere="Scadențele de verificare, reîncărcare și probă de presiune se calculează automat, din datele ultimelor operațiuni și periodicitățile legale ale organizației."
      />

      <FormularStingator />
    </div>
  );
}
