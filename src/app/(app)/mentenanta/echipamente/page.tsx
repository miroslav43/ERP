// src/app/(app)/mentenanta/echipamente/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench, WrenchIcon } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { listeazaEchipamente } from "@/lib/queries/maintenance";
import { filtreEchipamenteSchema } from "@/schemas/maintenance";

import { CLASE_STATUS_ECHIPAMENT, ETICHETE_STATUS_ECHIPAMENT } from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreEchipamenteForm } from "./filtre-echipamente";

export const metadata: Metadata = { title: "Echipamente" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelEchipamente({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreEchipamenteSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaEchipamente(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.cauta !== null;
    return (
      <EmptyState
        icon={Wrench}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun echipament înregistrat"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți tot parcul de echipamente."
            : "Adăugați primul echipament ca să puteți urmări mentenanța și autorizațiile ISCIR."
        }
      />
    );
  }

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <caption className="sr-only">Echipamentele organizației.</caption>
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Cod
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Denumire
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Locație
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                ISCIR
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {randuri.map((echipament) => (
              <tr key={echipament.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/mentenanta/echipamente/${echipament.id}`}
                    className="underline-offset-2 hover:underline focus-visible:outline-2"
                  >
                    {echipament.cod}
                  </Link>
                </td>
                <td className="px-4 py-3">{echipament.denumire}</td>
                <td className="px-4 py-3">{echipament.locatie ?? "—"}</td>
                <td className="px-4 py-3">
                  {echipament.este_iscir ? (
                    <WrenchIcon aria-label="Sub incidența ISCIR" className="size-4 text-amber-600" />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_ECHIPAMENT[echipament.status]}`}
                  >
                    {ETICHETE_STATUS_ECHIPAMENT[echipament.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/mentenanta/echipamente?${cautare.toString()}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaEchipamente({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta echipamentele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateAdauga = can(permisiuni, "maintenance:update", "team");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Echipamente</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Parcul de echipamente al organizației, cu starea și acoperirea ISCIR.
          </p>
        </div>
        {poateAdauga ? (
          <Link
            href="/mentenanta/echipamente/nou"
            className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Echipament nou
          </Link>
        ) : null}
      </header>

      <NavMentenanta />
      <FiltreEchipamenteForm />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={5} />}>
        <TabelEchipamente organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
