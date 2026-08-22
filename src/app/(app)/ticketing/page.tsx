// src/app/(app)/ticketing/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
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
      <EmptyState
        icon={LifeBuoy}
        title="Niciun tichet deschis"
        description="Când ai nevoie de software, de un echipament, ți s-a stricat ceva sau ai găsit o problemă în aplicație, deschide un tichet."
      />
    );
  }

  return <TabelTichete randuri={randuri} />;
}

export default async function PaginaTichetelorMele({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "tickets:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta tichetele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tichetele mele</h1>
          <p className="text-muted-foreground text-sm">
            Cererile și problemele pe care le-ai trimis către IT, cu starea fiecăreia.
          </p>
        </div>
        <Link
          href="/ticketing/nou"
          className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
        >
          Tichet nou
        </Link>
      </header>

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={6} />}>
        <ListaMea organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
