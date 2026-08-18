// src/app/(app)/pontaj/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { anDinUrl, filtreDinUrl } from "@/lib/rute/parametri";
import {
  citestePerioada,
  departamente,
  intrariLuna,
  intrariProprii,
  listeazaAngajatiPontaj,
} from "@/lib/queries/attendance";
import { zileNelucratoare } from "@/lib/queries/leave";
import { filtrePontajSchema, type StatusPerioada } from "@/schemas/attendance";
import type { PermissionScope } from "@/config/permissions";

import { NavPontaj } from "./nav-pontaj";
import { FiltrePontaj } from "./filtre-pontaj";
import { FoaieColectiva, type RandFoaie } from "./foaie-colectiva";

export const metadata: Metadata = { title: "Pontaj" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function Foaie({
  organizationId,
  scope,
  an,
  filtre,
  dataInceput,
  dataSfarsit,
  statusPerioada,
  blocataLa,
  utilizatorEticheta,
  poateEdita,
  poateAproba,
  parametri,
}: {
  readonly organizationId: string;
  readonly scope: PermissionScope;
  readonly an: number;
  readonly filtre: ReturnType<typeof filtrePontajSchema.parse>;
  readonly dataInceput: string;
  readonly dataSfarsit: string;
  readonly statusPerioada: StatusPerioada;
  readonly blocataLa: string | null;
  readonly utilizatorEticheta: string;
  readonly poateEdita: boolean;
  readonly poateAproba: boolean;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const { nationale, organizatie } = await zileNelucratoare(organizationId, an, an);
  const sarbatoriNationale = Object.fromEntries(nationale.map((z) => [z.data, z.denumire]));
  const zileRecuperare = organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data);
  const liberSuplimentar = organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data);

  // Scope „own”: fără citirea tabelei `employees` (RLS o interzice rolului
  // `employee` — vezi `intrariProprii`). Un singur „rând”, identificat prin
  // autentificare, nu prin `employees.id`.
  if (scope === "own") {
    const intrari = await intrariProprii(organizationId, dataInceput, dataSfarsit);
    const randuri: readonly RandFoaie[] = [
      {
        angajatId: null,
        eticheta: utilizatorEticheta,
        intrari: Object.fromEntries(
          intrari.map((i) => [
            i.data,
            {
              id: i.id,
              oraInceput: i.ora_inceput,
              oraSfarsit: i.ora_sfarsit,
              oreLucrate: i.ore_lucrate,
              oreSuplimentare: i.ore_suplimentare,
              oreNoapte: i.ore_noapte,
              tipZi: i.tip_zi,
              esteDinConcediu: i.leave_request_id !== null,
              aprobat: i.approved_at !== null,
              observatii: i.observatii,
            },
          ]),
        ),
      },
    ];

    return (
      <FoaieColectiva
        dataInceput={dataInceput}
        dataSfarsit={dataSfarsit}
        statusPerioada={statusPerioada}
        blocataLa={blocataLa}
        randuri={randuri}
        sarbatoriNationale={sarbatoriNationale}
        zileRecuperare={zileRecuperare}
        liberSuplimentar={liberSuplimentar}
        poateEdita={poateEdita}
        poateAproba={poateAproba}
      />
    );
  }

  const { randuri: angajati, urmatorulCursor } = await listeazaAngajatiPontaj(organizationId, filtre);

  if (angajati.length === 0) {
    const areFiltre = filtre.departament !== null || filtre.cauta !== null;
    return (
      <EmptyState
        icon={Users}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun angajat de pontat"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toți angajații."
            : "Nu există angajați activi în organizație pentru luna selectată."
        }
      />
    );
  }

  const intrari = await intrariLuna(
    organizationId,
    angajati.map((a) => a.id),
    dataInceput,
    dataSfarsit,
  );

  const randuri: readonly RandFoaie[] = angajati.map((a) => ({
    angajatId: a.id,
    eticheta: `${a.full_name} (${a.marca})`,
    intrari: Object.fromEntries(
      intrari
        .filter((i) => i.employee_id === a.id)
        .map((i) => [
          i.data,
          {
            id: i.id,
            oraInceput: i.ora_inceput,
            oraSfarsit: i.ora_sfarsit,
            oreLucrate: i.ore_lucrate,
            oreSuplimentare: i.ore_suplimentare,
            oreNoapte: i.ore_noapte,
            tipZi: i.tip_zi,
            esteDinConcediu: i.leave_request_id !== null,
            aprobat: i.approved_at !== null,
            observatii: i.observatii,
          },
        ]),
    ),
  }));

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <FoaieColectiva
        dataInceput={dataInceput}
        dataSfarsit={dataSfarsit}
        statusPerioada={statusPerioada}
        blocataLa={blocataLa}
        randuri={randuri}
        sarbatoriNationale={sarbatoriNationale}
        zileRecuperare={zileRecuperare}
        liberSuplimentar={liberSuplimentar}
        poateEdita={poateEdita}
        poateAproba={poateAproba}
      />
      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/pontaj?${cautare.toString()}`}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaPontaj({ searchParams }: ProprietatiPagina) {
  const { user, tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  // `can(..., "own")` și nu `scopeFor(...) !== null`: scope-ul „none" e refuz
  // explicit ȘI e truthy, deci a doua formă ar lăsa poarta deschisă.
  if (!can(permisiuni, "attendance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta pontajul. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const scope = scopeFor(permisiuni, "attendance:read") ?? "own";
  // `manager` NU are `attendance:create` → foaia e read-only, exact ca RLS.
  const poateEdita = can(permisiuni, "attendance:create", "own");
  const poateAproba = can(permisiuni, "attendance:approve", "team");
  const poateDeschide = can(permisiuni, "attendance:create", "all");

  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));
  const filtre = filtreDinUrl(filtrePontajSchema, parametri);

  const perioada = await citestePerioada(tenant.organizationId, an, filtre.luna);
  const listaDepartamente = scope === "own" ? [] : await departamente(tenant.organizationId);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Pontaj</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Foaia colectivă pentru {formatMonthYear(an, filtre.luna)}.
        </p>
      </header>

      <NavPontaj poateAproba={poateAproba} />

      {scope === "own" ? null : <FiltrePontaj an={an} departamente={listaDepartamente} />}

      {perioada === null ? (
        <EmptyState
          icon={CalendarClock}
          title="Luna nu a fost deschisă"
          description="Deschideți perioada din „Perioade” înainte de a înregistra pontaj."
          {...(poateDeschide
            ? { action: { label: "Mergi la Perioade", href: "/pontaj/perioade" } }
            : {})}
        />
      ) : (
        <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={10} />}>
          <Foaie
            organizationId={tenant.organizationId}
            scope={scope}
            an={an}
            filtre={filtre}
            dataInceput={perioada.data_inceput}
            dataSfarsit={perioada.data_sfarsit}
            statusPerioada={perioada.status}
            blocataLa={perioada.blocata_la}
            utilizatorEticheta={user.fullName ?? user.email}
            poateEdita={poateEdita}
            poateAproba={poateAproba}
            parametri={parametri}
          />
        </Suspense>
      )}
    </main>
  );
}
