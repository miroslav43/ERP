// src/app/(app)/inventar/nou/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { categorii } from "@/lib/queries/inventory";

import { FormularObiect } from "./formular-obiect";

export const metadata: Metadata = { title: "Obiect de inventar nou" };

export default async function PaginaObiectNou() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "inventory");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (scopeFor(permisiuni, "inventory:update") !== "all") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a adăuga obiecte de inventar. Această operațiune este rezervată persoanelor care administrează inventarul." />
    );
  }

  const listaCategorii = await categorii();

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Obiect de inventar nou</h1>
        <p className="text-sm text-muted-foreground">
          Obiectul se înregistrează cu starea de circuit „În stoc”. Predarea către un angajat se
          face separat, din fișa obiectului.
        </p>
      </header>
      <FormularObiect categorii={listaCategorii} />
    </main>
  );
}
