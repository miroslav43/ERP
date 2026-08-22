// src/app/(app)/flota/aprobari/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { angajatiDupaId, listeazaFoi, vehiculeDupaId } from "@/lib/queries/fleet";

import { NavFlota } from "../nav-flota";
import { DecizieFoaie } from "./decizie-foaie";

export const metadata: Metadata = { title: "Foi de aprobat" };

async function ListaDeAprobat({ organizationId }: { readonly organizationId: string }) {
  // Foile de parcurs NU generează sarcini în `approval_tasks`: triggerul de acolo
  // creează sarcini doar pentru `entity_type = 'leave_request'`. Aprobarea se
  // face direct pe rând, iar RLS decide cine vede ce.
  const { randuri } = await listeazaFoi(organizationId, {
    status: "trimis",
    vehicul: null,
    cursor: null,
    limita: 100,
  });

  if (randuri.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nimic de aprobat"
        description="Toate foile de parcurs trimise au fost deja decise."
      />
    );
  }

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

  return (
    <ul className="space-y-3">
      {randuri.map((f) => {
        const sofer = f.employee_id === null ? undefined : soferi.get(f.employee_id);
        const vehicul = vehicule.get(f.vehicle_id);
        return (
          <li key={f.id} className="border-border rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium">
                  <Link href={`/flota/foi/${f.id}`} className="underline-offset-2 hover:underline">
                    {vehicul?.nr_inmatriculare ?? "Vehicul indisponibil"}
                  </Link>
                  {sofer === undefined ? null : (
                    <span className="text-muted-foreground">
                      {" "}
                      · {sofer.full_name} ({sofer.marca})
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm">
                  {formatDateTime(new Date(f.plecare_la))}
                  {f.sosire_la === null ? null : ` – ${formatDateTime(new Date(f.sosire_la))}`}
                  {f.km_parcursi === null ? null : ` · ${f.km_parcursi.toLocaleString("ro-RO")} km`}
                </p>
                {f.traseu === null ? null : (
                  <p className="text-muted-foreground text-sm">{f.traseu}</p>
                )}
              </div>
              <DecizieFoaie id={f.id} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function PaginaAprobari() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "trip_sheets:approve", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a aproba foi de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Foi de aprobat</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Foaia de parcurs justifică fiscal consumul de combustibil, de aceea nu vă puteți aproba
          propria foaie — nici măcar cu drepturi depline.
        </p>
      </header>

      <NavFlota
        poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
        poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
        poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
      />

      <Suspense fallback={<SkeletonTable cols={5} />}>
        <ListaDeAprobat organizationId={tenant.organizationId} />
      </Suspense>
    </main>
  );
}
