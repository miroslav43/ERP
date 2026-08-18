// src/app/(app)/flota/foi/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, FilePlus2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { angajatiDupaId, listeazaFoi, vehiculeDupaId } from "@/lib/queries/fleet";
import { filtreFoiSchema } from "@/schemas/fleet";

import { CLASE_STATUS_FOAIE, ETICHETE_STATUS_FOAIE } from "../etichete";
import { NavFlota } from "../nav-flota";

export const metadata: Metadata = { title: "Foi de parcurs" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelFoi({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreFoiSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaFoi(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.vehicul !== null;
    return (
      <EmptyState
        icon={ClipboardList}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio foaie de parcurs"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate foile."
            : "Înregistrați prima cursă ca să puteți justifica consumul de combustibil."
        }
      />
    );
  }

  // Numele șoferului și numărul vehiculului se citesc SEPARAT, nu prin embed.
  // Un manager are `trip_sheets:read` la scope „team" dar niciun drept pe
  // `vehicles`; un embed refuzat de RLS vine NULL fără nicio eroare, adică o
  // coloană goală pe care nimeni n-o explică.
  const [soferi, vehicule] = await Promise.all([
    angajatiDupaId(
      organizationId,
      randuri.map((f) => f.employee_id).filter((id): id is string => id !== null),
    ),
    vehiculeDupaId(
      organizationId,
      randuri.map((f) => f.vehicle_id),
    ),
  ]);

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Foile de parcurs la care aveți acces.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Plecare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Vehicul
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Șofer
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Kilometri
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Traseu
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {randuri.map((f) => {
              const vehicul = vehicule.get(f.vehicle_id);
              const sofer = f.employee_id === null ? undefined : soferi.get(f.employee_id);
              return (
                <tr key={f.id} className="hover:bg-surface">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/flota/foi/${f.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {formatDateTime(new Date(f.plecare_la))}
                    </Link>
                  </td>
                  {/* „—" și nu gol: absența poate însemna și lipsa dreptului de a
                      vedea vehiculul, nu doar lipsa datei. */}
                  <td className="px-4 py-3">{vehicul?.nr_inmatriculare ?? "—"}</td>
                  <td className="px-4 py-3">
                    {sofer?.full_name ?? "—"}
                    {sofer === undefined ? null : (
                      <span className="text-muted-foreground"> · {sofer.marca}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {f.km_parcursi === null ? (
                      <span className="text-muted-foreground">în curs</span>
                    ) : (
                      `${f.km_parcursi.toLocaleString("ro-RO")} km`
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">{f.traseu ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_FOAIE[f.status]}`}
                    >
                      {ETICHETE_STATUS_FOAIE[f.status]}
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
            href={`/flota/foi?${cautare.toString()}`}
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm hover:bg-surface"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaFoi({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "trip_sheets:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta foile de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "trip_sheets:create", "own");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Foi de parcurs</h1>
          <p className="text-sm text-muted-foreground">
            Cursele înregistrate, cu kilometrii și starea aprobării.
          </p>
        </div>
        {poateCrea ? (
          <Link
            href="/flota/foi/noua"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <FilePlus2 aria-hidden="true" className="size-4" />
            Foaie nouă
          </Link>
        ) : null}
      </header>

      <NavFlota
        poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
        poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
        poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={6} />}>
        <TabelFoi organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
