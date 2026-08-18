// src/app/(app)/ssm/stingatoare/nou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { FormularStingator } from "./formular-stingator";

export const metadata: Metadata = { title: "Stingător nou" };

export default async function PaginaStingatorNou() {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "ssm:create", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a adăuga stingătoare. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <header>
        <p className="text-sm text-muted-foreground">
          <Link href="/ssm/stingatoare" className="underline-offset-2 hover:underline">
            Stingătoare
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Stingător nou</h1>
        <p className="text-sm text-muted-foreground">
          Scadențele de verificare, reîncărcare și probă de presiune se calculează automat, din
          datele ultimelor operațiuni și periodicitățile legale ale organizației.
        </p>
      </header>

      <FormularStingator />
    </main>
  );
}
