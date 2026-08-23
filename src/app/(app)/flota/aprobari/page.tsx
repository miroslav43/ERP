// src/app/(app)/flota/aprobari/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
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
      <StareGoala
        fel="initiala"
        pictograma={CheckCircle2}
        titlu="Nimic de aprobat"
        descriere="Toate foile de parcurs trimise au fost deja decise."
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
          <li key={f.id} className="border-border rounded-panou border p-4">
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
                <p className="text-muted-foreground text-corp">
                  {formatDateTime(new Date(f.plecare_la))}
                  {f.sosire_la === null ? null : ` – ${formatDateTime(new Date(f.sosire_la))}`}
                  {f.km_parcursi === null ? null : ` · ${f.km_parcursi.toLocaleString("ro-RO")} km`}
                </p>
                {f.traseu === null ? null : (
                  <p className="text-muted-foreground text-corp">{f.traseu}</p>
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "trip_sheets:approve", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a aproba foi de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Foi de aprobat"
        descriere="Foaia de parcurs justifică fiscal consumul de combustibil, de aceea nu vă puteți aproba propria foaie — nici măcar cu drepturi depline."
        file={
          <NavFlota
            poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
            poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
            poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
          />
        }
      />

      <Suspense fallback={<Schelet forma="lista" />}>
        <ListaDeAprobat organizationId={tenant.organizationId} />
      </Suspense>
    </div>
  );
}
