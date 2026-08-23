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
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
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
  const { randuri, urmatorulCursor, total, sortare } = await listeazaFoi(organizationId, filtre);

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

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/flota/foi" : `/flota/foi?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "plecare",
      antet: "Plecare",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (f) => formatDateTime(new Date(f.plecare_la)),
    },
    {
      cheie: "vehicul",
      antet: "Vehicul",
      peTelefon: "meta",
      // „—" și nu gol: absența poate însemna și lipsa dreptului de a vedea
      // vehiculul, nu doar lipsa datei.
      celula: (f) => vehicule.get(f.vehicle_id)?.nr_inmatriculare ?? "—",
    },
    {
      cheie: "sofer",
      antet: "Șofer",
      peTelefon: "meta",
      celula: (f) => {
        const sofer = f.employee_id === null ? undefined : soferi.get(f.employee_id);
        return (
          <>
            {sofer?.full_name ?? "—"}
            {sofer === undefined ? null : (
              <span className="text-muted-foreground"> · {sofer.marca}</span>
            )}
          </>
        );
      },
    },
    {
      cheie: "km",
      antet: "Kilometri",
      numeric: true,
      peTelefon: "meta",
      celula: (f) =>
        f.km_parcursi === null ? (
          <span className="text-muted-foreground">în curs</span>
        ) : (
          `${f.km_parcursi.toLocaleString("ro-RO")} km`
        ),
    },
    {
      cheie: "traseu",
      antet: "Traseu",
      peTelefon: "meta",
      celula: (f) => <span className="block max-w-xs truncate">{f.traseu ?? "—"}</span>,
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (f) => (
        <Badge ton={TONURI_STATUS_FOAIE[f.status]}>{ETICHETE_STATUS_FOAIE[f.status]}</Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Foile de parcurs la care aveți acces."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(f) => f.id}
        href={(f) => `/flota/foi/${f.id}`}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul nu supraviețuiește unei schimbări de sortare: ar continua
            // de la un rând care, în noua ordine, nu mai e acolo unde era.
            p.delete("cursor");
          })
        }
        gol={null}
      />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa((p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </div>
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
