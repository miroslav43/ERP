// src/app/(app)/flota/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Car, CarFront } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { listeazaVehicule, scadenteCurente, tipuriDocument } from "@/lib/queries/fleet";
import { filtreVehiculeSchema } from "@/schemas/fleet";

import {
  ETICHETE_CATEGORIE,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_VEHICUL,
  stareScadenta,
  TONURI_SCADENTA,
  TONURI_STATUS_VEHICUL,
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
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Car}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun vehicul înregistrat"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți întregul parc auto."
            : "Adăugați primul vehicul ca să puteți urmări ITP-ul, RCA-ul și foile de parcurs."
        }
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/flota" } } : {})}
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
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
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
                    <Badge ton={TONURI_STATUS_VEHICUL[v.status]}>
                      {ETICHETE_STATUS_VEHICUL[v.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_SCADENTA[stare]} cuAvertisment={stare === "expirat"}>
                      {ETICHETE_SCADENTA[stare]}
                    </Badge>
                    {scadenta === null ? null : (
                      <span className="text-muted-foreground text-nota ml-2">
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
          <Link href={`/flota?${cautare.toString()}`} className={buton({ varianta: "secundar" })}>
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
    <div className="space-y-6">
      <AntetPagina
        titlu="Parc auto"
        descriere={
          scope === "all"
            ? "Toate vehiculele organizației, cu documentul care expiră primul."
            : "Vehiculele la care aveți acces, cu documentul care expiră primul."
        }
        {...(poateAdauga
          ? {
              actiuni: (
                <Link href="/flota/nou" className={buton({ varianta: "primar" })}>
                  <CarFront aria-hidden="true" className="size-4" />
                  Vehicul nou
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

      <FiltreVehicule />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelVehicule organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
