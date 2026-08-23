// src/app/(app)/mentenanta/sesizari/noua/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";

import { FormularSesizare } from "./formular-sesizare";

export const metadata: Metadata = { title: "Sesizare nouă" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaSesizareNoua({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a trimite o sesizare de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const echipamentBrut =
    typeof parametri.echipament === "string" ? parametri.echipament : undefined;
  // QR-ul de pe echipament codează un id direct, nu un termen de căutat: o
  // valoare stricată e mai probabil un autocolant deteriorat sau tastare
  // greșită decât o intenție legitimă — 404 e răspunsul corect, ca la orice
  // segment `[id]` (vezi `lib/rute/parametri.ts`).
  const echipamentIdPrefill = echipamentBrut === undefined ? null : idDinRuta(echipamentBrut);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sesizare nouă</h1>
        <p className="text-muted-foreground text-sm">
          Raportați o defecțiune. Căutați echipamentul după cod sau denumire — durează un minut.
        </p>
      </div>

      <FormularSesizare echipamentIdPrefill={echipamentIdPrefill} />
    </main>
  );
}
