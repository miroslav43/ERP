// src/app/(app)/salarizare/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { RandTabel } from "@/components/data/rand-tabel";
import { StareGoala } from "@/components/ui/stare-goala";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { listeazaPerioade } from "@/lib/queries/payroll";
import { Wallet } from "lucide-react";

import {
  AVERTISMENT_SALARIZARE,
  TONURI_STATUS_PERIOADA,
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
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a administra salarizarea. Solicitați administratorului organizației rolul potrivit." />
      </div>
    );
  }

  const poateCrea = can(permisiuni, "payroll:create", "all");
  const perioade = await listeazaPerioade(tenant.organizationId);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Salarizare"
        descriere="Perioadele de salarizare ale organizației."
        actiuni={
          <>
            <Link href="/salarizare/istoric-venituri" className={buton({ varianta: "secundar" })}>
              Istoric venituri
            </Link>
            <Link href="/salarizare/setari" className={buton({ varianta: "secundar" })}>
              Setări
            </Link>
          </>
        }
      />

      <div
        role="note"
        className="border-warning/40 bg-warning/8 rounded-panou text-corp border p-4"
      >
        {AVERTISMENT_SALARIZARE}
      </div>

      {poateCrea ? <FormularPerioadaNoua /> : null}

      {perioade.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Wallet}
          titlu="Nicio perioadă de salarizare"
          descriere="Configurați setările, apoi creați prima perioadă pentru o lună cu pontajul deschis."
        />
      ) : (
        <div className="border-border rounded-panou overflow-x-auto border">
          <table className="text-corp w-full">
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
                    <Badge ton={TONURI_STATUS_PERIOADA[p.status] ?? "neutru"}>
                      {ETICHETE_STATUS_PERIOADA[p.status] ?? p.status}
                    </Badge>
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
    </div>
  );
}
