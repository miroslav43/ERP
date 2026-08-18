// src/app/(app)/ssm/accidente/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, ShieldAlert } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { accidente, angajatiDupaId } from "@/lib/queries/ssm";
import { filtreAccidenteSchema } from "@/schemas/ssm";

import { CLASE_TIP_ACCIDENT, ETICHETE_TIP_ACCIDENT } from "../etichete";
import { NavSsm } from "../nav-ssm";

export const metadata: Metadata = { title: "Accidente de muncă" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelAccidente({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreAccidenteSchema, parametri);
  const { randuri, urmatorulCursor } = await accidente(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.tip !== null || filtre.necomunicate !== null;
    return (
      <EmptyState
        icon={ShieldAlert}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun accident înregistrat"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate accidentele."
            : "Registrul de accidente e gol — sperăm să rămână așa."
        }
        {...(areFiltre ? {} : { action: { label: "Înregistrează un accident", href: "/ssm/accidente/nou" } })}
      />
    );
  }

  const angajati = await angajatiDupaId(
    organizationId,
    randuri.map((a) => a.employee_id).filter((id): id is string => id !== null),
  );

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <caption className="sr-only">Accidentele de muncă la care aveți acces.</caption>
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Data
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Angajat
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Comunicat ITM
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Cercetare
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {randuri.map((a) => {
              const angajat = a.employee_id === null ? undefined : angajati.get(a.employee_id);
              return (
                <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/ssm/accidente/${a.id}`}
                      className="underline-offset-2 hover:underline focus-visible:outline-2"
                    >
                      {formatDate(a.data_producerii)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_TIP_ACCIDENT[a.tip]}`}>
                      {ETICHETE_TIP_ACCIDENT[a.tip]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.comunicat_la_itm_la === null ? (
                      <span className="text-red-700 dark:text-red-400">Nu</span>
                    ) : (
                      "Da"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.cercetare_finalizata_la === null ? "În curs" : formatDate(a.cercetare_finalizata_la)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/ssm/accidente?${cautare.toString()}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaAccidente({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta registrul de accidente. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "ssm:create", "team");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Accidente de muncă</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Registrul de accidente, cu termenul de comunicare la ITM și stadiul cercetării.
          </p>
        </div>
        {poateCrea ? (
          <Link
            href="/ssm/accidente/nou"
            className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Plus aria-hidden="true" className="size-4" />
            Accident nou
          </Link>
        ) : null}
      </header>

      <NavSsm
        poateVedeaInstruiri={can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")}
        poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
        poateVedeaAccidente
        poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
        poateVedeaEip={can(permisiuni, "ssm:read", "team")}
        poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={5} />}>
        <TabelAccidente organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
