// src/app/(app)/flota/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Car, CarFront } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { RandTabel } from "@/components/data/rand-tabel";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { listeazaVehicule, scadenteCurente, tipuriDocument } from "@/lib/queries/fleet";
import { filtreVehiculeSchema } from "@/schemas/fleet";

import {
  CLASE_SCADENTA,
  CLASE_STATUS_VEHICUL,
  ETICHETE_CATEGORIE,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_VEHICUL,
  stareScadenta,
} from "./etichete";
import { FiltreVehicule } from "./filtre-vehicule";
import { NavFlota } from "./nav-flota";

export const metadata: Metadata = { title: "Parc auto" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelVehicule({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreVehiculeSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaVehicule(organizationId, filtre);

  if (randuri.length === 0) {
    // Mesajul diferă după cauză: „niciun vehicul" cere o acțiune, „niciun
    // rezultat" cere doar ștergerea filtrelor. Un singur text pentru amândouă
    // l-ar trimite pe om să adauge un vehicul care există deja.
    const areFiltre = filtre.status !== null || filtre.categorie !== null || filtre.cauta !== null;
    return (
      <EmptyState
        icon={Car}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun vehicul înregistrat"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți întregul parc auto."
            : "Adăugați primul vehicul ca să puteți urmări ITP-ul, RCA-ul și foile de parcurs."
        }
      />
    );
  }

  const [scadente, tipuri] = await Promise.all([
    scadenteCurente(randuri.map((v) => v.id)),
    tipuriDocument(),
  ]);
  const azi = todayInBucharest();
  const denumireTip = new Map(tipuri.map((t) => [t.id, t.denumire]));

  /** Cea mai apropiată scadență a unui vehicul — aia decide culoarea rândului. */
  const celMaiApropiat = (vehiculId: string) => {
    const aleLui = scadente
      .filter((s) => s.vehicle_id === vehiculId && s.expira_la !== null)
      .sort((a, b) => (a.expira_la ?? "").localeCompare(b.expira_la ?? ""));
    return aleLui[0] ?? null;
  };

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Vehiculele organizației, cu starea documentului care expiră primul.
          </caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Număr
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Vehicul
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Categorie
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Kilometraj
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Prima scadență
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((v) => {
              const scadenta = celMaiApropiat(v.id);
              const stare = stareScadenta(scadenta?.expira_la ?? null, azi);
              return (
                <RandTabel key={v.id} href={`/flota/${v.id}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/flota/${v.id}`} className="underline-offset-2 hover:underline">
                      {v.nr_inmatriculare}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {v.marca} {v.model}
                    {v.an_fabricatie === null ? null : (
                      <span className="text-muted-foreground"> · {v.an_fabricatie}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{ETICHETE_CATEGORIE[v.categorie]}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {v.km_curent.toLocaleString("ro-RO")} km
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_VEHICUL[v.status]}`}
                    >
                      {ETICHETE_STATUS_VEHICUL[v.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_SCADENTA[stare]}`}
                    >
                      {ETICHETE_SCADENTA[stare]}
                    </span>
                    {scadenta === null ? null : (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {denumireTip.get(scadenta.document_type_id) ?? "document"} ·{" "}
                        {scadenta.expira_la}
                      </span>
                    )}
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
            href={`/flota?${cautare.toString()}`}
            className="border-foreground/60 hover:bg-surface rounded-md border px-4 py-2 text-sm"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaFlota({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // `can(..., "own")` și nu `scopeFor(...) !== null`: scope-ul „none" e refuz
  // explicit ȘI e truthy, deci a doua formă ar lăsa poarta deschisă.
  if (!can(permisiuni, "vehicles:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta parcul auto. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const scope = scopeFor(permisiuni, "vehicles:read");
  const poateAdauga = can(permisiuni, "vehicles:create", "all");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Parc auto</h1>
          <p className="text-muted-foreground text-sm">
            {scope === "all"
              ? "Toate vehiculele organizației, cu documentul care expiră primul."
              : "Vehiculele la care aveți acces, cu documentul care expiră primul."}
          </p>
        </div>
        {poateAdauga ? (
          <Link
            href="/flota/nou"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <CarFront aria-hidden="true" className="size-4" />
            Vehicul nou
          </Link>
        ) : null}
      </header>

      <NavFlota
        poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
        poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
        poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
      />
      <FiltreVehicule />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={6} />}>
        <TabelVehicule organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
