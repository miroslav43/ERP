// src/app/(app)/flota/anomalii/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { anomaliiNeconfirmate, vehiculeDupaId } from "@/lib/queries/fleet";

import { NavFlota } from "../nav-flota";
import { ConfirmaAnomalie } from "./confirma-anomalie";

export const metadata: Metadata = { title: "Anomalii de kilometraj" };

async function TabelAnomalii({ organizationId }: { readonly organizationId: string }) {
  const anomalii = await anomaliiNeconfirmate(organizationId);

  if (anomalii.length === 0) {
    // Lista goală e o stare BUNĂ aici, nu o lipsă de date — textul trebuie să
    // spună asta, altfel omul caută ce a greșit.
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nicio anomalie neconfirmată"
        description="Kilometrajul tuturor vehiculelor este continuu. Diferențele apar aici automat, când o foaie de parcurs sare peste kilometri."
      />
    );
  }

  const vehicule = await vehiculeDupaId(
    organizationId,
    anomalii.map((a) => a.vehicle_id),
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Discontinuități de kilometraj constatate automat, în așteptarea unei explicații.
        </caption>
        <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Constatată
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Vehicul
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Așteptat
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Declarat
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Explicație
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {anomalii.map((a) => (
            <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <td className="px-4 py-3 whitespace-nowrap">
                {formatDateTime(new Date(a.created_at))}
              </td>
              <td className="px-4 py-3">
                {vehicule.get(a.vehicle_id)?.nr_inmatriculare ?? "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {a.km_asteptat.toLocaleString("ro-RO")} km
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {a.km_declarat.toLocaleString("ro-RO")} km
                <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                  +{(a.km_declarat - a.km_asteptat).toLocaleString("ro-RO")}
                </span>
              </td>
              <td className="px-4 py-3">
                <ConfirmaAnomalie id={a.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaginaAnomalii() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "vehicles:update", "team")) {
    return (
      <AccesRestrictionat mesaj="Anomaliile de kilometraj pot fi consultate de cei care administrează parcul auto. Solicitați administratorului organizației dreptul necesar." />
    );
  }

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Anomalii de kilometraj</h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
          Un kilometraj care sare peste o diferență neobișnuită nu blochează salvarea foii —
          cea mai frecventă explicație e o cursă necompletată, iar un refuz l-ar împinge pe
          șofer să potrivească cifra. Diferența ajunge aici, ca cineva să o explice.
          <span className="mt-1 block">
            Un <strong>regres</strong> de kilometraj, în schimb, e refuzat din start: un
            odometru nu poate da înapoi.
          </span>
        </p>
      </header>

      <NavFlota
        poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
        poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
        poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
      />

      <Suspense fallback={<SkeletonTable cols={5} />}>
        <TabelAnomalii organizationId={tenant.organizationId} />
      </Suspense>
    </main>
  );
}
