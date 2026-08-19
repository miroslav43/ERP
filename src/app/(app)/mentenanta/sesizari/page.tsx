// src/app/(app)/mentenanta/sesizari/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { RandTabel } from "@/components/data/rand-tabel";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { echipamenteDupaId, sesizari } from "@/lib/queries/maintenance";
import { filtreSesizariSchema } from "@/schemas/maintenance";

import {
  CLASE_STATUS_SESIZARE,
  CLASE_URGENTA_SESIZARE,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
} from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreSesizariForm } from "./filtre-sesizari";

export const metadata: Metadata = { title: "Sesizări de defecțiune" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelSesizari({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreSesizariSchema, parametri);
  const { randuri, urmatorulCursor } = await sesizari(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.urgenta !== null || filtre.echipament !== null;
    return (
      <EmptyState
        icon={Wrench}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio sesizare înregistrată"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate sesizările."
            : "Sesizările apar aici pe măsură ce echipa raportează defecțiuni."
        }
      />
    );
  }

  const echipamente = await echipamenteDupaId(
    organizationId,
    randuri.map((r) => r.equipment_id),
  );

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Sesizările de defecțiune ale organizației.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Echipament
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Descriere
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Raportată la
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Urgență
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {randuri.map((sesizare) => {
              const echipament = echipamente.get(sesizare.equipment_id);
              return (
                <RandTabel key={sesizare.id} href={`/mentenanta/sesizari/${sesizare.id}`}>
                  <td className="px-4 py-3 font-medium">
                    {echipament === undefined ? "Echipament necunoscut" : `${echipament.cod} — ${echipament.denumire}`}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/mentenanta/sesizari/${sesizare.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {sesizare.descriere}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(sesizare.raportat_la)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_URGENTA_SESIZARE[sesizare.urgenta]}`}
                    >
                      {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_SESIZARE[sesizare.status]}`}
                    >
                      {ETICHETE_STATUS_SESIZARE[sesizare.status]}
                    </span>
                  </td>
                </RandTabel>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/mentenanta/sesizari?${cautare.toString()}`}
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm hover:bg-surface"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaSesizari({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sesizări de defecțiune</h1>
          <p className="text-sm text-muted-foreground">
            Defecțiunile raportate, cu starea lor de triaj și rezolvare.
          </p>
        </div>
        <Link
          href="/mentenanta/sesizari/noua"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Sesizare nouă
        </Link>
      </header>

      <NavMentenanta />
      <FiltreSesizariForm />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={5} />}>
        <TabelSesizari organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
