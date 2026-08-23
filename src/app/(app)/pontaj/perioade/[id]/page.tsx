// src/app/(app)/pontaj/perioade/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Badge } from "@/components/ui/badge";
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

import { TONURI_STATUS_PERIOADA, ETICHETE_STATUS_PERIOADA } from "../../etichete";

export const metadata: Metadata = { title: "Lotul de aprobare" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaPerioadaDetaliu({ params }: ProprietatiPagina) {
  // Un segment care nu e UUID nu poate desemna niciun rând: 404, nu 22P02.
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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

  // Aceleași cuvinte ca înainte, doar mutate din trei noduri într-un singur șir:
  // `descriere` primește text, nu JSX.
  const intervalPerioadei =
    `${formatDate(perioada.data_inceput)} – ${formatDate(perioada.data_sfarsit)}` +
    (perioada.blocata_la === null ? "" : ` · blocată la ${formatDateTime(perioada.blocata_la)}`);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-muted-foreground text-corp">
          <Link href="/pontaj/perioade" className="underline-offset-2 hover:underline">
            Perioade de pontaj
          </Link>
        </p>
        <AntetPagina
          titlu={formatMonthYear(perioada.an, perioada.luna)}
          descriere={intervalPerioadei}
          actiuni={
            <Badge ton={TONURI_STATUS_PERIOADA[perioada.status]}>
              {ETICHETE_STATUS_PERIOADA[perioada.status]}
            </Badge>
          }
        />
      </div>

      <section
        aria-labelledby="titlu-neaprobate"
        className="border-border rounded-panou border p-4"
      >
        <h2 id="titlu-neaprobate" className="text-corp font-medium">
          Linii încă neaprobate
        </h2>
        <p className="text-titlu mt-1 font-semibold tabular-nums">{liniiNeaprobate.length}</p>
        <p className="text-muted-foreground text-corp mt-1">
          Aprobarea în bloc se face din{" "}
          <Link href="/pontaj/aprobare" className="underline-offset-2 hover:underline">
            ecranul de aprobare
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="titlu-loturi" className="space-y-3">
        <h2 id="titlu-loturi" className="text-sectiune font-semibold">
          Loturile de aprobare
        </h2>

        {loturi.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={CheckCircle2}
            titlu="Niciun lot de aprobare"
            descriere="Nu s-a aprobat încă niciun grup de linii de pontaj pentru această lună."
            compact
          />
        ) : (
          <ul className="space-y-3">
            {loturi.map((lot) => {
              const manager =
                lot.manager_employee_id === null
                  ? undefined
                  : manageri.get(lot.manager_employee_id);
              return (
                <li key={lot.id} className="border-border rounded-panou border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {lot.department_id === null
                          ? "Toată organizația"
                          : (hartaDepartamente.get(lot.department_id) ?? "Departament necunoscut")}
                      </p>
                      <p className="text-muted-foreground text-corp">
                        Aprobat la {formatDateTime(lot.aprobat_la)}
                        {manager === undefined
                          ? null
                          : ` · ${manager.full_name} (${manager.marca})`}
                      </p>
                      {lot.observatii === null ? null : (
                        <p className="text-muted-foreground text-corp">{lot.observatii}</p>
                      )}
                    </div>
                    <p className="text-corp text-right">
                      <span className="text-titlu block font-semibold tabular-nums">
                        {lot.linii_aprobate}
                      </span>
                      <span className="text-muted-foreground text-nota">linii aprobate</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
