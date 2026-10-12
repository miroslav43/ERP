// src/app/(app)/flota/foi/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap, scopeFor, type PermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { angajatiDupaId, listeazaFoi, listeazaVehicule, vehiculeDupaId } from "@/lib/queries/fleet";
import { filtreFoiSchema } from "@/schemas/fleet";

import { ETICHETE_STATUS_FOAIE, TONURI_STATUS_FOAIE } from "../etichete";
import { dateFoaieNoua } from "./date-foaie-noua";
import { DialogFoaieNoua } from "./dialog-foaie-noua";
import { FiltreFoi } from "./filtre-foi";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_FLOTA } from "@/config/file-module";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisa } from "@/lib/navigare/fisa";
import { legaturaSigura } from "@/config/porti-ruta";

export const metadata: Metadata = { title: "Foi de parcurs" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelFoi({
  organizationId,
  parametri,
  permisiuni,
  poateCrea,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly permisiuni: PermissionMap;
  /** `trip_sheets:create`: starea goală pe un vehicul oferă foaia nouă. */
  readonly poateCrea: boolean;
}) {
  const moduleActive = await getEnabledFeatures(organizationId);
  const filtre = filtreDinUrl(filtreFoiSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await listeazaFoi(organizationId, filtre);

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/flota/foi" : `/flota/foi?${p.toString()}`;
  }

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.vehicul !== null || filtre.sofer !== null;
    // Ca la /flota: se scot DOAR cheile de filtrare. Un `href="/flota/foi"` sec
    // ar fi luat cu el și sortarea coloanelor, și mărimea paginii.
    const faraFiltre = adresa((p) => {
      p.delete("status");
      p.delete("vehicul");
      p.delete("cursor");
    });
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
        {...(filtre.vehicul !== null && poateCrea
          ? {
              // Omul a venit din fișa vehiculului: prima foaie se pornește de aici, pe el.
              actiune: {
                eticheta: "Foaie nouă pe acest vehicul",
                href: `/flota/foi?vehicul=${filtre.vehicul}&foaie=noua`,
              },
            }
          : areFiltre
            ? { actiune: { eticheta: "Șterge filtrele", href: faraFiltre } }
            : {})}
      />
    );
  }

  // Numele șoferului și numărul vehiculului se citesc SEPARAT, nu prin embed.
  // Un manager are `trip_sheets:read` la scope „team” dar niciun drept pe
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
      // „—” și nu gol: absența poate însemna și lipsa dreptului de a vedea
      // vehiculul, nu doar lipsa datei.
      celula: (f) => (
        // Rândul duce la foaie; vehiculul are linkul lui, doar pentru cine
        // poate deschide fișa vehiculului (managerul n-are `vehicles:*`).
        <LinkEntitate
          href={
            vehicule.has(f.vehicle_id)
              ? legaturaSigura(`/flota/${f.vehicle_id}`, {
                  features: moduleActive,
                  permissions: permisiuni,
                })
              : null
          }
        >
          {vehicule.get(f.vehicle_id)?.nr_inmatriculare ?? "—"}
        </LinkEntitate>
      ),
    },
    {
      cheie: "sofer",
      antet: "Șofer",
      peTelefon: "meta",
      celula: (f) => {
        const sofer = f.employee_id === null ? undefined : soferi.get(f.employee_id);
        return (
          <>
            <LinkEntitate href={hrefFisa(sofer, permisiuni)}>
              {sofer?.full_name ?? "—"}
            </LinkEntitate>
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
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "trip_sheets:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta foile de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "trip_sheets:create", "own");
  const scope = scopeFor(permisiuni, "trip_sheets:read");
  // `/flota/foi/noua` a dispărut; parametrul deschide caseta care i-a luat locul.
  const deschideCaseta = parametri["foaie"] === "noua";

  /*
   * Vehiculele pentru filtru se citesc AICI, nu în tabel: bara trebuie să fie pe
   * ecran înainte de rezultate, altfel „niciun rezultat pentru filtrele alese”
   * apare fără niciun control cu care să le ștergi.
   *
   * Lista poate veni GOALĂ, fără nicio eroare: un `manager` are
   * `trip_sheets:read` la scope „team” și niciun drept pe `vehicles`. Bara nu
   * randează atunci câmpul de vehicul — un `<select>` cu o singură opțiune,
   * „Toate”, ar fi arătat ca un filtru stricat.
   *
   * Datele casetei merg în paralel cu ea, și numai pentru cine chiar o poate
   * deschide: fără `trip_sheets:create` ar fi două drumuri la bază pentru un
   * buton care nu se randează.
   */
  const [{ randuri: vehiculeFiltru }, dateFoaie] = await Promise.all([
    listeazaVehicule(tenant.organizationId, {
      status: null,
      categorie: null,
      conformitate: null,
      cauta: null,
      cursor: null,
      limita: 100,
    }),
    poateCrea ? dateFoaieNoua(tenant.organizationId) : Promise.resolve(null),
  ]);

  // Filtrul de intrare din fișa angajatului: numele pastilei, citit sub RLS.
  const soferFiltrat = filtreDinUrl(filtreFoiSchema, parametri).sofer;
  const numeSoferFiltrat =
    soferFiltrat === null
      ? null
      : ((await angajatiDupaId(tenant.organizationId, [soferFiltrat])).get(soferFiltrat)
          ?.full_name ?? null);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Foi de parcurs"
        // Textul era fix și sugera registrul întregii firme și unui șofer care
        // își vede doar propriile curse.
        descriere={
          scope === "all"
            ? "Toate cursele organizației, cu kilometrii și starea aprobării."
            : scope === "team"
              ? "Cursele echipei dumneavoastră, cu kilometrii și starea aprobării."
              : "Cursele dumneavoastră, cu kilometrii și starea aprobării."
        }
        {...(dateFoaie === null
          ? {}
          : {
              actiuni: (
                <DialogFoaieNoua
                  key={deschideCaseta ? "foaie-noua" : "listă"}
                  date={dateFoaie}
                  deschisInitial={deschideCaseta}
                  vehiculInitial={filtreDinUrl(filtreFoiSchema, parametri).vehicul}
                  poateVedeaParcul={can(permisiuni, "vehicles:read", "own")}
                />
              ),
            })}
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
      />

      <FiltreFoi parametri={parametri} vehicule={vehiculeFiltru} numeSofer={numeSoferFiltrat} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelFoi
          organizationId={tenant.organizationId}
          parametri={parametri}
          permisiuni={permisiuni}
          poateCrea={poateCrea}
        />
      </Suspense>
    </div>
  );
}
