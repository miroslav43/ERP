// src/app/(app)/flota/foi/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, FilePlus2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { angajatiDupaId, listeazaFoi, vehiculeDupaId } from "@/lib/queries/fleet";
import { filtreFoiSchema } from "@/schemas/fleet";

import { ETICHETE_STATUS_FOAIE, TONURI_STATUS_FOAIE } from "../etichete";
import { NavFlota } from "../nav-flota";

export const metadata: Metadata = { title: "Foi de parcurs" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelFoi({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreFoiSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaFoi(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.vehicul !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={ClipboardList}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio foaie de parcurs"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate foile."
            : "Înregistrați prima cursă ca să puteți justifica consumul de combustibil."
        }
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/flota/foi" } } : {})}
      />
    );
  }

  // Numele șoferului și numărul vehiculului se citesc SEPARAT, nu prin embed.
  // Un manager are `trip_sheets:read` la scope „team" dar niciun drept pe
  // `vehicles`; un embed refuzat de RLS vine NULL fără nicio eroare, adică o
  // coloană goală pe care nimeni n-o explică.
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

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
          <caption className="sr-only">Foile de parcurs la care aveți acces.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Plecare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Vehicul
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Șofer
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Kilometri
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Traseu
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((f) => {
              const vehicul = vehicule.get(f.vehicle_id);
              const sofer = f.employee_id === null ? undefined : soferi.get(f.employee_id);
              return (
                <RandTabel key={f.id} href={`/flota/foi/${f.id}`}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/flota/foi/${f.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {formatDateTime(new Date(f.plecare_la))}
                    </Link>
                  </td>
                  {/* „—" și nu gol: absența poate însemna și lipsa dreptului de a
                      vedea vehiculul, nu doar lipsa datei. */}
                  <td className="px-4 py-3">{vehicul?.nr_inmatriculare ?? "—"}</td>
                  <td className="px-4 py-3">
                    {sofer?.full_name ?? "—"}
                    {sofer === undefined ? null : (
                      <span className="text-muted-foreground"> · {sofer.marca}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {f.km_parcursi === null ? (
                      <span className="text-muted-foreground">în curs</span>
                    ) : (
                      `${f.km_parcursi.toLocaleString("ro-RO")} km`
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">{f.traseu ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_STATUS_FOAIE[f.status]}>
                      {ETICHETE_STATUS_FOAIE[f.status]}
                    </Badge>
                  </td>
                </RandTabel>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/flota/foi?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaFoi({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "trip_sheets:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta foile de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "trip_sheets:create", "own");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Foi de parcurs"
        descriere="Cursele înregistrate, cu kilometrii și starea aprobării."
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/flota/foi/noua" className={buton({ varianta: "primar" })}>
                  <FilePlus2 aria-hidden="true" className="size-4" />
                  Foaie nouă
                </Link>
              ),
            }
          : {})}
        file={
          <NavFlota
            poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
            poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
            poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
          />
        }
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelFoi organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
