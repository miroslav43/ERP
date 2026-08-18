// src/app/(app)/pontaj/perioade/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { CheckCircle2 } from "lucide-react";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime, formatMonthYear } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiPontajDupaId,
  citestePerioadaDupaId,
  departamente,
  liniiDeAprobat,
  loturiPerioadei,
} from "@/lib/queries/attendance";

import { CLASE_STATUS_PERIOADA, ETICHETE_STATUS_PERIOADA } from "../../etichete";

export const metadata: Metadata = { title: "Lotul de aprobare" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaPerioadaDetaliu({ params }: ProprietatiPagina) {
  // Un segment care nu e UUID nu poate desemna niciun rând: 404, nu 22P02.
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  // `attendance_batches_select` cere `attendance:read ≥ team`.
  if (!can(permisiuni, "attendance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta loturile de aprobare ale pontajului. Această secțiune este rezervată managerilor și personalului de resurse umane." />
    );
  }

  const perioada = await citestePerioadaDupaId(tenant.organizationId, id);
  if (perioada === null) notFound();

  const [loturi, liniiNeaprobate, departamenteList] = await Promise.all([
    loturiPerioadei(tenant.organizationId, id),
    liniiDeAprobat(tenant.organizationId, id),
    departamente(tenant.organizationId),
  ]);

  const idManageri = loturi
    .map((l) => l.manager_employee_id)
    .filter((v): v is string => v !== null);
  const manageri = await angajatiPontajDupaId(tenant.organizationId, idManageri);
  const hartaDepartamente = new Map(departamenteList.map((d) => [d.id, d.denumire]));

  return (
    <main className="space-y-6 p-6">
      <header>
        <p className="text-sm text-muted-foreground">
          <Link href="/pontaj/perioade" className="underline-offset-2 hover:underline">
            Perioade de pontaj
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{formatMonthYear(perioada.an, perioada.luna)}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {formatDate(perioada.data_inceput)} – {formatDate(perioada.data_sfarsit)}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_PERIOADA[perioada.status]}`}
          >
            {ETICHETE_STATUS_PERIOADA[perioada.status]}
          </span>
          {perioada.blocata_la === null ? null : (
            <span>· blocată la {formatDateTime(perioada.blocata_la)}</span>
          )}
        </p>
      </header>

      <section aria-labelledby="titlu-neaprobate" className="rounded-lg border border-border p-4">
        <h2 id="titlu-neaprobate" className="text-sm font-medium">
          Linii încă neaprobate
        </h2>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{liniiNeaprobate.length}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprobarea în bloc se face din{" "}
          <Link href="/pontaj/aprobare" className="underline-offset-2 hover:underline">
            ecranul de aprobare
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="titlu-loturi" className="space-y-3">
        <h2 id="titlu-loturi" className="text-lg font-semibold">
          Loturile de aprobare
        </h2>

        {loturi.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Niciun lot de aprobare"
            description="Nu s-a aprobat încă niciun grup de linii de pontaj pentru această lună."
          />
        ) : (
          <ul className="space-y-3">
            {loturi.map((lot) => {
              const manager =
                lot.manager_employee_id === null ? undefined : manageri.get(lot.manager_employee_id);
              return (
                <li key={lot.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {lot.department_id === null
                          ? "Toată organizația"
                          : (hartaDepartamente.get(lot.department_id) ?? "Departament necunoscut")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Aprobat la {formatDateTime(lot.aprobat_la)}
                        {manager === undefined ? null : ` · ${manager.full_name} (${manager.marca})`}
                      </p>
                      {lot.observatii === null ? null : (
                        <p className="text-sm text-muted-foreground">{lot.observatii}</p>
                      )}
                    </div>
                    <p className="text-right text-sm">
                      <span className="block text-2xl font-semibold tabular-nums">
                        {lot.linii_aprobate}
                      </span>
                      <span className="text-xs text-muted-foreground">linii aprobate</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
