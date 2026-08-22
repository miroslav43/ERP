// src/app/(app)/mentenanta/planuri/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { RandTabel } from "@/components/data/rand-tabel";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { angajatiDupaId, echipamenteDupaId, planuriScadente } from "@/lib/queries/maintenance";
import { stareScadentaData } from "@/domain/maintenance/scadente";

import {
  CLASE_STARE_SCADENTA,
  ETICHETE_STARE_SCADENTA,
  ETICHETE_TIP_CONTOR,
  ETICHETE_TIP_MENTENANTA,
} from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";

export const metadata: Metadata = { title: "Planuri de mentenanță" };

export default async function PaginaPlanuri() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta planurile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const azi = todayInBucharest();
  const planuri = await planuriScadente(tenant.organizationId);

  const [echipamente, responsabili] = await Promise.all([
    echipamenteDupaId(
      tenant.organizationId,
      planuri.map((p) => p.equipment_id),
    ),
    angajatiDupaId(
      tenant.organizationId,
      planuri.map((p) => p.responsabil_employee_id).filter((v): v is string => v !== null),
    ),
  ]);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Planuri de mentenanță</h1>
        <p className="text-muted-foreground text-sm">
          Planurile ACTIVE ale organizației, cu cea mai apropiată scadență prima. Scadența pe contor
          se vede exact pe fișa fiecărui echipament, unde intră și ultima citire.
        </p>
      </header>

      <NavMentenanta />

      {planuri.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Niciun plan de mentenanță activ"
          description="Planurile se adaugă din fișa fiecărui echipament."
        />
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Planurile de mentenanță active, cu scadența lor.</caption>
            <thead className="bg-surface text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Plan
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Echipament
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Periodicitate
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Responsabil
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Scadență
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {planuri.map((plan) => {
                const echipament = echipamente.get(plan.equipment_id);
                const stare = stareScadentaData(plan.urmatoarea_scadenta, azi);
                return (
                  <RandTabel
                    key={plan.id}
                    href={
                      echipament === undefined
                        ? null
                        : `/mentenanta/echipamente/${plan.equipment_id}`
                    }
                  >
                    <td className="px-4 py-3 font-medium">
                      {plan.denumire}
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({ETICHETE_TIP_MENTENANTA[plan.tip]})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {echipament === undefined ? (
                        "—"
                      ) : (
                        <Link
                          href={`/mentenanta/echipamente/${plan.equipment_id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {echipament.cod} — {echipament.denumire}
                        </Link>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {plan.periodicitate_zile !== null ? `${plan.periodicitate_zile} zile` : ""}
                      {plan.periodicitate_zile !== null && plan.periodicitate_contor !== null
                        ? " · "
                        : ""}
                      {plan.periodicitate_contor !== null && plan.tip_contor !== null
                        ? `${plan.periodicitate_contor} ${ETICHETE_TIP_CONTOR[plan.tip_contor]}`
                        : ""}
                    </td>
                    <td className="px-4 py-3">
                      {plan.responsabil_employee_id === null
                        ? "—"
                        : (responsabili.get(plan.responsabil_employee_id)?.full_name ?? "—")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STARE_SCADENTA[stare]}`}
                      >
                        {ETICHETE_STARE_SCADENTA[stare]}
                      </span>
                      {plan.urmatoarea_scadenta !== null ? (
                        <span className="text-muted-foreground ml-2 text-xs">
                          {formatDate(plan.urmatoarea_scadenta)}
                        </span>
                      ) : null}
                    </td>
                  </RandTabel>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
