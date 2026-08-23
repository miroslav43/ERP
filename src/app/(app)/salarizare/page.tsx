// src/app/(app)/salarizare/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { RandTabel } from "@/components/data/rand-tabel";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { listeazaPerioade } from "@/lib/queries/payroll";
import { Wallet } from "lucide-react";

import {
  AVERTISMENT_SALARIZARE,
  CLASE_STATUS_PERIOADA,
  ETICHETE_STATUS_PERIOADA,
  numeLuna,
} from "./etichete";
import { FormularPerioadaNoua } from "./formular-perioada-noua";

export const metadata: Metadata = { title: "Salarizare" };

export default async function PaginaSalarizare() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:read", "all")) {
    return (
      <main className="p-6">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a administra salarizarea. Solicitați administratorului organizației rolul potrivit." />
      </main>
    );
  }

  const poateCrea = can(permisiuni, "payroll:create", "all");
  const perioade = await listeazaPerioade(tenant.organizationId);

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Salarizare</h1>
          <p className="text-muted-foreground text-sm">
            Perioadele de salarizare ale organizației.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/salarizare/istoric-venituri"
            className="border-foreground/60 hover:bg-surface rounded-md border px-4 py-2 text-sm font-medium"
          >
            Istoric venituri
          </Link>
          <Link
            href="/salarizare/setari"
            className="border-foreground/60 hover:bg-surface rounded-md border px-4 py-2 text-sm font-medium"
          >
            Setări
          </Link>
        </div>
      </header>

      <div role="note" className="border-warning/40 bg-warning/8 rounded-lg border p-4 text-sm">
        {AVERTISMENT_SALARIZARE}
      </div>

      {poateCrea ? <FormularPerioadaNoua /> : null}

      {perioade.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nicio perioadă de salarizare"
          description="Configurați setările, apoi creați prima perioadă pentru o lună cu pontajul deschis."
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Perioadă
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Stare
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Total brut
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Total net
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Cost angajator
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {perioade.map((p) => (
                <RandTabel key={p.id} href={`/salarizare/${p.id}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/salarizare/${p.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {numeLuna(p.luna)} {p.an}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_PERIOADA[p.status] ?? ""}`}
                    >
                      {ETICHETE_STATUS_PERIOADA[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatLei(p.total_brut)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatLei(p.total_net)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatLei(p.total_cost_angajator)}
                  </td>
                </RandTabel>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
