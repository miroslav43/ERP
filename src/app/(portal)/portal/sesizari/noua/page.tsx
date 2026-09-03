// src/app/(portal)/portal/sesizari/noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { FormularSesizare } from "@/app/(app)/mentenanta/sesizari/noua/formular-sesizare";

export const metadata: Metadata = { title: "Sesizare nouă" };

export default async function PaginaSesizareNouaPortal({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a trimite o sesizare de defecțiune." />
      </div>
    );
  }

  const parametri = await searchParams;
  const brut = typeof parametri["echipament"] === "string" ? parametri["echipament"] : undefined;
  // Numele parametrului e `echipament` și AICI, identic cu ruta din aplicația
  // mare: autocolantele cu cod QR sunt lipite fizic pe utilaje și codifică deja
  // forma asta. Un nume „mai bun” ar însemna autocolante de reimprimat.
  // Un identificator stricat e mai probabil un autocolant deteriorat decât o
  // intenție — 404, ca la orice segment `[id]`.
  const echipamentIdPrefill = brut === undefined ? null : idDinRuta(brut);

  return (
    <div className={`${LATIMI.formular} space-y-4 p-4`}>
      <AntetPagina
        titlu="Sesizare nouă"
        descriere="Raportați o defecțiune. Căutați echipamentul după cod sau denumire — durează un minut."
      />

      <FormularSesizare
        echipamentIdPrefill={echipamentIdPrefill}
        caleDupaSalvare="/portal/sesizari"
      />

      <p>
        <Link href="/portal/sesizari" className={buton({ varianta: "link" })}>
          Înapoi la sesizările mele
        </Link>
      </p>
    </div>
  );
}
