// src/app/(app)/angajati/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { UserPlus, Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { idFisaProprie, listeazaAngajati } from "@/lib/queries/employees";
import { filtreAngajatiSchema } from "@/schemas/employee";

import { CLASE_STATUS, ETICHETE_STATUS } from "./etichete";
import { FiltreAngajati } from "./filtre-angajati";

export const metadata: Metadata = { title: "Angajați" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ProprietatiTabel {
  readonly organizationId: string;
  readonly scope: "own" | "team" | "all";
  readonly userId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}

async function TabelAngajati({ organizationId, scope, userId, parametri }: ProprietatiTabel) {
  const filtre = filtreAngajatiSchema.parse(parametri);
  const propriaFisaId = scope === "all" ? null : await idFisaProprie(organizationId, userId);
  const { randuri, urmatorulCursor } = await listeazaAngajati({
    organizationId,
    scope,
    propriaFisaId,
    filtre,
  });

  if (randuri.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Niciun angajat găsit"
        description="Nu există fișe care să corespundă filtrelor alese. Ștergeți filtrele sau adăugați primul angajat."
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
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Lista angajaților din organizație</caption>
          <thead className="bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Marcă
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Nume și prenume
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Departament
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Funcție
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Angajat din
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {randuri.map((rand) => (
              <tr key={rand.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <td className="px-4 py-3 font-mono text-xs">{rand.marca}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/angajati/${rand.id}`}
                    className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-blue-300"
                  >
                    {rand.full_name}
                  </Link>
                  {!rand.is_primary ? (
                    <span className="ml-2 text-xs text-zinc-500">(cumul de funcții)</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{rand.department?.denumire ?? "—"}</td>
                <td className="px-4 py-3">{rand.job_position?.denumire ?? "—"}</td>
                <td className="px-4 py-3">
                  {rand.hired_on === null ? "—" : formatDate(rand.hired_on)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_STATUS[rand.status]}`}
                  >
                    {ETICHETE_STATUS[rand.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="mt-4 flex justify-end">
        {urmatorulCursor === null ? (
          <p className="text-sm text-zinc-500">Aceasta este ultima pagină.</p>
        ) : (
          <Link
            href={`/angajati?${cautare.toString()}`}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaAngajati({ searchParams }: ProprietatiPagina) {
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);
  const scope = scopeFor(permisiuni, "employees:read");

  if (scope === null || scope === "none") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evidența de personal. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = scopeFor(permisiuni, "employees:create") === "all";

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Angajați</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {scope === "own"
              ? "Vedeți propria fișă de personal."
              : scope === "team"
                ? "Vedeți fișele angajaților din subordinea dumneavoastră."
                : "Evidența completă de personal a organizației."}
          </p>
        </div>
        {poateCrea ? (
          <Link
            href="/angajati/nou"
            className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <UserPlus aria-hidden="true" className="size-4" />
            Angajat nou
          </Link>
        ) : null}
      </header>

      <FiltreAngajati />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable />}>
        <TabelAngajati
          organizationId={tenant.organizationId}
          scope={scope}
          userId={utilizator.id}
          parametri={parametri}
        />
      </Suspense>
    </main>
  );
}
