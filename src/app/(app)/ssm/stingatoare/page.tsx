// src/app/(app)/ssm/stingatoare/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FireExtinguisher, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { RandTabel } from "@/components/data/rand-tabel";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { stingatoare } from "@/lib/queries/ssm";
import { filtreStingatoareSchema } from "@/schemas/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import { CLASE_SCADENTA, CLASE_STATUS_STINGATOR, ETICHETE_SCADENTA, ETICHETE_STATUS_STINGATOR } from "../etichete";
import { NavSsm } from "../nav-ssm";
import { FiltreStingatoare } from "./filtre-stingatoare";

export const metadata: Metadata = { title: "Stingătoare" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function CelulaScadenta({
  areInregistrare,
  data,
  scadenta,
  azi,
}: {
  readonly areInregistrare: boolean;
  readonly data: string | null;
  readonly scadenta: string | null;
  readonly azi: string;
}) {
  const stare = stareScadentaSsm(areInregistrare, scadenta, azi);
  return (
    <td className="px-4 py-3 whitespace-nowrap">
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_SCADENTA[stare]}`}>
        {ETICHETE_SCADENTA[stare]}
      </span>
      {data === null ? null : <span className="ml-2 text-xs text-muted-foreground">{formatDate(data)}</span>}
    </td>
  );
}

async function TabelStingatoare({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreStingatoareSchema, parametri);
  const { randuri, urmatorulCursor } = await stingatoare(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.cauta !== null;
    return (
      <EmptyState
        icon={FireExtinguisher}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun stingător înregistrat"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate stingătoarele."
            : "Adăugați primul stingător ca să puteți urmări verificările, reîncărcările și probele de presiune."
        }
        {...(areFiltre ? {} : { action: { label: "Adaugă stingător", href: "/ssm/stingatoare/nou" } })}
      />
    );
  }

  const azi = todayInBucharest();

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Stingătoarele organizației, cu cele trei obligații de întreținere pe coloane distincte.
          </caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Cod
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Locație
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Verificare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Reîncărcare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Probă de presiune
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {randuri.map((s) => (
              <RandTabel key={s.id} href={`/ssm/stingatoare/${s.id}`}>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/ssm/stingatoare/${s.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {s.cod}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {s.locatie}
                  {s.cladire === null ? null : <span className="text-muted-foreground"> · {s.cladire}</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_STINGATOR[s.status]}`}
                  >
                    {ETICHETE_STATUS_STINGATOR[s.status]}
                  </span>
                </td>
                <CelulaScadenta
                  areInregistrare={s.ultima_verificare !== null}
                  data={s.ultima_verificare}
                  scadenta={s.scadenta_verificare}
                  azi={azi}
                />
                <CelulaScadenta
                  areInregistrare={s.ultima_reincarcare !== null}
                  data={s.ultima_reincarcare}
                  scadenta={s.scadenta_reincarcare}
                  azi={azi}
                />
                <CelulaScadenta
                  areInregistrare={s.ultima_proba_presiune !== null}
                  data={s.ultima_proba_presiune}
                  scadenta={s.scadenta_proba_presiune}
                  azi={azi}
                />
              </RandTabel>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/ssm/stingatoare?${cautare.toString()}`}
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm hover:bg-surface"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaStingatoare({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta stingătoarele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "ssm:create", "team");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Stingătoare</h1>
          <p className="text-sm text-muted-foreground">
            Verificarea tehnică, reîncărcarea și proba de presiune — trei obligații cu
            periodicități diferite.
          </p>
        </div>
        {poateCrea ? (
          <Link
            href="/ssm/stingatoare/nou"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus aria-hidden="true" className="size-4" />
            Stingător nou
          </Link>
        ) : null}
      </header>

      <NavSsm
        poateVedeaInstruiri={can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")}
        poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
        poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
        poateVedeaStingatoare
        poateVedeaEip={can(permisiuni, "ssm:read", "team")}
        poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
      />

      <FiltreStingatoare />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={6} />}>
        <TabelStingatoare organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
