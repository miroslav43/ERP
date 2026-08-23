// src/app/(app)/ticketing/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { listeazaTichete } from "@/lib/queries/ticketing";
import { filtreTicheteSchema } from "@/schemas/ticketing";
import { filtreDinUrl } from "@/lib/rute/parametri";

import { TabelTichete } from "./tabel-tichete";

export const metadata: Metadata = { title: "Tichetele mele" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function ListaMea({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreTicheteSchema, parametri);
  // Nu filtrăm după solicitant: RLS-ul arată deja fiecăruia ce are voie să
  // vadă. Un angajat obișnuit vede exact tichetele proprii.
  const { randuri } = await listeazaTichete(organizationId, filtre);

  if (randuri.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={LifeBuoy}
        titlu="Niciun tichet deschis"
        descriere="Când ai nevoie de software, de un echipament, ți s-a stricat ceva sau ai găsit o problemă în aplicație, deschide un tichet."
      />
    );
  }

  return <TabelTichete randuri={randuri} />;
}

export default async function PaginaTichetelorMele({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "tickets:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta tichetele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Tichetele mele"
        descriere="Cererile și problemele pe care le-ai trimis către IT, cu starea fiecăreia."
        actiuni={
          <Link href="/ticketing/nou" className={buton({ varianta: "primar" })}>
            Tichet nou
          </Link>
        }
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <ListaMea organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
