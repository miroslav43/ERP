// src/app/(app)/ssm/medicina-muncii/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Stethoscope } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { angajatiDupaId, fiseAptitudine } from "@/lib/queries/ssm";
import { filtreFiseSchema } from "@/schemas/ssm";

import { CLASE_REZULTAT_EXAMEN, ETICHETE_REZULTAT_EXAMEN, ETICHETE_TIP_EXAMEN } from "../etichete";
import { NavSsm } from "../nav-ssm";

export const metadata: Metadata = { title: "Medicina muncii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelFise({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreFiseSchema, parametri);
  const { randuri, urmatorulCursor } = await fiseAptitudine(organizationId, filtre);

  if (randuri.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="Nicio fișă de aptitudine înregistrată"
        description="Adăugați prima fișă ca să urmăriți valabilitatea controalelor medicale periodice."
        action={{ label: "Fișă nouă", href: "/ssm/medicina-muncii/noua" }}
      />
    );
  }

  const angajati = await angajatiDupaId(
    organizationId,
    randuri.map((f) => f.employee_id),
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
          <caption className="sr-only">Fișele de aptitudine la care aveți acces.</caption>
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Angajat
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Data examinării
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Valabilă până la
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Rezultat
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {randuri.map((f) => {
              const angajat = angajati.get(f.employee_id);
              return (
                <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3">
                    {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
                  </td>
                  <td className="px-4 py-3">{ETICHETE_TIP_EXAMEN[f.tip]}</td>
                  <td className="px-4 py-3">{formatDate(f.data_examinarii)}</td>
                  <td className="px-4 py-3">{f.valabil_pana === null ? "—" : formatDate(f.valabil_pana)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_REZULTAT_EXAMEN[f.rezultat]}`}
                    >
                      {ETICHETE_REZULTAT_EXAMEN[f.rezultat]}
                    </span>
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
            href={`/ssm/medicina-muncii?${cautare.toString()}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaMedicinaMuncii({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta dosarele de medicina muncii. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "ssm:create", "team");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Medicina muncii</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Fișele de aptitudine. Diagnosticul nu se stochează — doar rezultatul.
          </p>
        </div>
        {poateCrea ? (
          <Link
            href="/ssm/medicina-muncii/noua"
            className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Plus aria-hidden="true" className="size-4" />
            Fișă nouă
          </Link>
        ) : null}
      </header>

      <NavSsm
        poateVedeaInstruiri={can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")}
        poateVedeaMedicina
        poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
        poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
        poateVedeaEip={can(permisiuni, "ssm:read", "team")}
        poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={5} />}>
        <TabelFise organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
