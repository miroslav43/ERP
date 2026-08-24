// src/app/(app)/pontaj/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
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
  setariPontaj,
} from "@/lib/queries/attendance";
import { zileNelucratoare } from "@/lib/queries/leave";
import { zileLucratoareLuna } from "@/lib/queries/payroll";
import { filtrePontajSchema, type StatusPerioada } from "@/schemas/attendance";
import type { PermissionScope } from "@/config/permissions";

import type { IntervalNoapte } from "./interval-noapte";
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
  orePeZi,
  intervalNoapte,
  oreAsteptateLuna,
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
  readonly orePeZi: number;
  readonly intervalNoapte: IntervalNoapte;
  readonly oreAsteptateLuna: number;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const { nationale, organizatie } = await zileNelucratoare(organizationId, an, an);
  const sarbatoriNationale = Object.fromEntries(nationale.map((z) => [z.data, z.denumire]));
  const zileRecuperare = organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data);
  const liberSuplimentar = organizatie
    .filter((z) => z.tip === "liber_suplimentar")
    .map((z) => z.data);

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
              respins: i.respins_la !== null,
              motivRespingere: i.motiv_respingere,
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
        orePeZi={orePeZi}
        intervalNoapte={intervalNoapte}
        oreAsteptateLuna={oreAsteptateLuna}
        azi={todayInBucharest()}
      />
    );
  }

  const { randuri: angajati, urmatorulCursor } = await listeazaAngajatiPontaj(
    organizationId,
    filtre,
  );

  if (angajati.length === 0) {
    const areFiltre = filtre.departament !== null || filtre.cauta !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Users}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun angajat de pontat"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toți angajații."
            : "Nu există angajați activi în organizație pentru luna selectată."
        }
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/pontaj" } } : {})}
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
            respins: i.respins_la !== null,
            motivRespingere: i.motiv_respingere,
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
        orePeZi={orePeZi}
        intervalNoapte={intervalNoapte}
        oreAsteptateLuna={oreAsteptateLuna}
        azi={todayInBucharest()}
      />
      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link href={`/pontaj?${cautare.toString()}`} className={buton({ varianta: "secundar" })}>
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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
  // Nu există seed pentru `attendance_settings` — 8h e implicitul deja folosit
  // în formular înainte de această modificare (`celula-zi.tsx`).
  const setari =
    perioada === null ? null : await setariPontaj(tenant.organizationId, perioada.data_inceput);
  const orePeZi = setari?.ore_pe_zi ?? 8;
  // Fereastra de noapte, din care celula derivă `ore_noapte` în loc s-o ceară
  // tastată de mână. Implicitele oglindesc `attendance_settings` (0013:39-40):
  // fără rând de setări, 22:00–06:00 e tot ce spune Codul Muncii art. 125.
  const intervalNoapte = {
    start: setari?.noapte_start?.slice(0, 5) ?? "22:00",
    sfarsit: setari?.noapte_sfarsit?.slice(0, 5) ?? "06:00",
  } as const;
  // „Ore așteptate” pentru lună — bază de raportare, NU calculul de salariu
  // (acela rămâne în `salarizare`, care poate citi aceleași cifre mai târziu).
  const oreAsteptateLuna =
    perioada === null
      ? 0
      : orePeZi * (await zileLucratoareLuna(tenant.organizationId, an, filtre.luna));

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Pontaj"
        descriere={`Foaia colectivă pentru ${formatMonthYear(an, filtre.luna)}.`}
        actiuni={
          <Link href="/pontaj/setari" className={buton({ varianta: "secundar" })}>
            Setări
          </Link>
        }
        file={<NavPontaj poateAproba={poateAproba} />}
      />

      {scope === "own" ? null : (
        <FiltrePontaj
          an={an}
          luna={filtre.luna}
          departament={filtre.departament}
          cauta={filtre.cauta}
          departamente={listaDepartamente}
        />
      )}

      {perioada === null ? (
        <StareGoala
          fel="initiala"
          pictograma={CalendarClock}
          titlu="Luna nu a fost deschisă"
          descriere="Deschideți perioada din „Perioade” înainte de a înregistra pontaj."
          {...(poateDeschide
            ? { actiune: { eticheta: "Mergi la Perioade", href: "/pontaj/perioade" } }
            : {})}
        />
      ) : (
        <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={10} />}>
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
            orePeZi={orePeZi}
            intervalNoapte={intervalNoapte}
            oreAsteptateLuna={oreAsteptateLuna}
            parametri={parametri}
          />
        </Suspense>
      )}
    </div>
  );
}
