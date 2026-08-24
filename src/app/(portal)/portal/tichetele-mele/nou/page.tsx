// src/app/(portal)/portal/tichetele-mele/nou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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
    <div className={`${LATIMI.formular} space-y-4 p-4`}>
      <AntetPagina
        titlu="Tichet nou"
        descriere="Solicitările merg la managerul dumneavoastră direct sau la administrator. Problemele din aplicație ajung la echipa care o dezvoltă."
      />

      <FormularTichet
        obiecteAlocate={obiecte}
        modulCurent={modul}
        prefixCale="/portal/tichetele-mele"
      />

      <p>
        <Link href="/portal/tichetele-mele" className={buton({ varianta: "link" })}>
          Înapoi la tichetele mele
        </Link>
      </p>
    </div>
  );
}
