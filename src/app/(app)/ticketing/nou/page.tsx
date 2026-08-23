// src/app/(app)/ticketing/nou/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { listeazaObiecteleMele } from "@/lib/queries/ticketing";
import { fisaProprie } from "@/lib/queries/portal";

import { FormularTichet } from "./formular-tichet";

export const metadata: Metadata = { title: "Tichet nou" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaTichetNou({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "tickets:create", "own")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a deschide tichete." />;
  }

  // Fișa proprie, ca să știm ce obiecte are în primire. `fisaProprie` citește
  // prin RLS — politica de pe `employees` îi permite fiecăruia propria fișă,
  // deci nu e nevoie să ocolim nimic.
  const fisa = await fisaProprie(tenant.organizationId, user.id);

  const obiecte = fisa === null ? [] : await listeazaObiecteleMele(fisa.id);
  const parametri = await searchParams;
  const modul = typeof parametri["modul"] === "string" ? parametri["modul"] : "";

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Tichet nou</h1>
        <p className="text-muted-foreground text-sm">
          Solicitările merg la managerul tău direct sau la administrator. Problemele din aplicație
          ajung direct la echipa care o dezvoltă.
        </p>
      </header>

      <FormularTichet obiecteAlocate={obiecte} modulCurent={modul} />
    </main>
  );
}
