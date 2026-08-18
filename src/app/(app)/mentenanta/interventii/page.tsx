// src/app/(app)/mentenanta/interventii/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { echipamenteDupaId, interventii } from "@/lib/queries/maintenance";
import { filtreInterventiiSchema } from "@/schemas/maintenance";

import {
  CLASE_REZULTAT_INTERVENTIE,
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_TIP_MENTENANTA,
} from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreInterventiiForm } from "./filtre-interventii";

export const metadata: Metadata = { title: "Intervenții de mentenanță" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelInterventii({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreInterventiiSchema, parametri);
  const { randuri, urmatorulCursor } = await interventii(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.tip !== null || filtre.rezultat !== null || filtre.echipament !== null;
    return (
      <EmptyState
        icon={Wrench}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio intervenție înregistrată"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate intervențiile."
            : "Intervențiile se adaugă din fișa fiecărui echipament, sau la rezolvarea unei sesizări."
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
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <caption className="sr-only">Intervențiile de mentenanță ale organizației.</caption>
          <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Data
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Echipament
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Descriere
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Cost total
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Rezultat
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {randuri.map((interventie) => {
              const echipament = echipamente.get(interventie.equipment_id);
              return (
                <tr key={interventie.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-3">{formatDate(interventie.data)}</td>
                  <td className="px-4 py-3">
                    {echipament === undefined ? (
                      "—"
                    ) : (
                      <Link
                        href={`/mentenanta/echipamente/${interventie.equipment_id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {echipament.cod} — {echipament.denumire}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">{ETICHETE_TIP_MENTENANTA[interventie.tip]}</td>
                  <td className="px-4 py-3">{interventie.descriere}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatLei(interventie.cost_total ?? interventie.cost_piese + interventie.cost_manopera)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_REZULTAT_INTERVENTIE[interventie.rezultat]}`}
                    >
                      {ETICHETE_REZULTAT_INTERVENTIE[interventie.rezultat]}
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
            href={`/mentenanta/interventii?${cautare.toString()}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaInterventii({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta intervențiile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Intervenții de mentenanță</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Istoricul intervențiilor, cu costurile lor. Se adaugă din fișa fiecărui echipament.
        </p>
      </header>

      <NavMentenanta />
      <FiltreInterventiiForm />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={6} />}>
        <TabelInterventii organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
