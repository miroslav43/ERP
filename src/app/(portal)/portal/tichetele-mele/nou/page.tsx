// src/app/(portal)/portal/tichetele-mele/nou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { listeazaObiecteleMele } from "@/lib/queries/ticketing";
import { fisaMea } from "@/lib/queries/portal";
import { FormularTichet } from "@/app/(app)/ticketing/nou/formular-tichet";

import { FaraFisa } from "../../fara-fisa";

export const metadata: Metadata = { title: "Tichet nou" };

export default async function PaginaTichetNouPortal({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "tickets:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a deschide tichete." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const obiecte = await listeazaObiecteleMele(stare.fisa.id);
  const parametri = await searchParams;
  const modul = typeof parametri["modul"] === "string" ? parametri["modul"] : "";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="text-foreground text-xl font-semibold">Tichet nou</h1>
        <p className="text-muted-foreground text-sm">
          Solicitările merg la managerul dumneavoastră direct sau la administrator. Problemele din
          aplicație ajung la echipa care o dezvoltă.
        </p>
      </header>

      <FormularTichet
        obiecteAlocate={obiecte}
        modulCurent={modul}
        prefixCale="/portal/tichetele-mele"
      />

      <p>
        <Link
          href="/portal/tichetele-mele"
          className="text-primary text-sm underline-offset-2 hover:underline"
        >
          Înapoi la tichetele mele
        </Link>
      </p>
    </div>
  );
}
