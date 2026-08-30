// src/app/(app)/pontaj/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { ComutatorVizualizare, type ParametriAdresa } from "@/components/ui/comutator-vizualizare";
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
import { configZiDin, type ConfigZi } from "@/domain/attendance/calcul-ore";
import { limiteleFirmei, type LimiteFirmei } from "@/domain/attendance/limite-legale";
import { esteLuni, lunieaSaptamanii } from "@/domain/attendance/saptamana";
import { ziIso } from "@/domain/calendar/grila-lunara";

import { NavPontaj } from "./nav-pontaj";
import { FiltrePontaj } from "./filtre-pontaj";
import { FoaieColectiva } from "./foaie-colectiva";
import { CalendarLuna, type OmZi } from "./calendar-luna";
import { SectiuneSaptamana } from "./sectiune-saptamana";
import { intrarilePeZi, type RandFoaie } from "./intrare-client";
import {
  OPTIUNI_VIZUALIZARE,
  PARAM_SAPTAMANA,
  PARAM_VIZUALIZARE,
  VIZUALIZARE_IMPLICITA,
  vizualizareSchema,
  type Vizualizare,
} from "./vizualizari";

export const metadata: Metadata = { title: "Pontaj" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Luna întreagă: aceleași citiri, două desene.
 *
 * `luna` (calendar de 7 coloane) și `lista` (matricea angajați × zile) se
 * hrănesc din EXACT aceleași rânduri. De aceea componenta se ramifică abia la
 * randare: o a doua citire ar fi însemnat două ecrane care pot arăta lucruri
 * diferite pentru aceeași lună, iar plafonul `max_rows = 1000` al PostgREST ar
 * fi trebuit socotit de două ori.
 */
async function LunaIntreaga({
  organizationId,
  scope,
  an,
  filtre,
  vizualizare,
  dataInceput,
  dataSfarsit,
  statusPerioada,
  blocataLa,
  utilizatorEticheta,
  poateEdita,
  poateAproba,
  config,
  limite,
  oreAsteptateLuna,
  parametri,
  azi,
}: {
  readonly organizationId: string;
  readonly scope: PermissionScope;
  readonly an: number;
  readonly filtre: ReturnType<typeof filtrePontajSchema.parse>;
  readonly vizualizare: Exclude<Vizualizare, "saptamana">;
  readonly dataInceput: string;
  readonly dataSfarsit: string;
  readonly statusPerioada: StatusPerioada;
  readonly blocataLa: string | null;
  readonly utilizatorEticheta: string;
  readonly poateEdita: boolean;
  readonly poateAproba: boolean;
  readonly config: ConfigZi;
  /**
   * Limitele legale ale firmei, sau `null` când n-a configurat nimic. Foaia
   * verifică pe ele zilele DEJA încărcate — fără nicio citire nouă, fiindcă
   * luna e deja în pagină.
   */
  readonly limite: LimiteFirmei | null;
  readonly oreAsteptateLuna: number;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly azi: string;
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
        intrari: intrarilePeZi(intrari),
      },
    ];

    return vizualizare === "luna" ? (
      <CalendarLuna
        an={an}
        luna={filtre.luna}
        peZi={peZiDinRanduri(randuri)}
        sarbatoriNationale={sarbatoriNationale}
        azi={azi}
        angajatiAfisati={1}
      />
    ) : (
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
        config={config}
        limite={limite}
        oreAsteptateLuna={oreAsteptateLuna}
        azi={azi}
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
    intrari: intrarilePeZi(intrari.filter((i) => i.employee_id === a.id)),
  }));

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  const paginare = (
    <nav aria-label="Paginare" className="flex justify-end">
      {urmatorulCursor === null ? null : (
        <Link href={`/pontaj?${cautare.toString()}`} className={buton({ varianta: "secundar" })}>
          Pagina următoare
        </Link>
      )}
    </nav>
  );

  if (vizualizare === "luna") {
    return (
      <>
        <CalendarLuna
          an={an}
          luna={filtre.luna}
          peZi={peZiDinRanduri(randuri)}
          sarbatoriNationale={sarbatoriNationale}
          azi={azi}
          angajatiAfisati={randuri.length}
        />
        {paginare}
      </>
    );
  }

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
        config={config}
        limite={limite}
        oreAsteptateLuna={oreAsteptateLuna}
        azi={azi}
      />
      {paginare}
    </>
  );
}

/**
 * Matricea „angajat → zile" întoarsă pe dos, în „zi → angajați".
 *
 * Ordinea oamenilor dintr-o zi o dă ordinea rândurilor, adică sortarea din
 * `listeazaAngajatiPontaj`. Contează: „+2 alții" trebuie să însemne aceiași doi
 * oameni în fiecare zi a lunii, nu o listă care se rearanjează de la o căsuță la
 * alta.
 */
function peZiDinRanduri(randuri: readonly RandFoaie[]): Readonly<Record<string, readonly OmZi[]>> {
  const peZi: Record<string, OmZi[]> = {};
  for (const rand of randuri) {
    for (const [data, intrare] of Object.entries(rand.intrari)) {
      (peZi[data] ??= []).push({ eticheta: rand.eticheta, intrare });
    }
  }
  return peZi;
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
  const poateConfigura = can(permisiuni, "attendance:update", "all");

  const azi = todayInBucharest();
  const anAzi = Number(azi.slice(0, 4));
  const lunaAzi = Number(azi.slice(5, 7));
  const an = anDinUrl(parametri["an"], anAzi);
  const filtre = filtreDinUrl(filtrePontajSchema, parametri);
  const vizualizare = vizualizareSchema.parse(parametri[PARAM_VIZUALIZARE]);

  /*
    Săptămâna afișată, ancorată de luna din adresă.

    Fără ancoră, cine filtrează foaia pe martie și comută pe „Săptămână" ar
    ateriza în săptămâna curentă, fără explicație. Cu ea, dintr-o lună trecută se
    intră în săptămâna care conține ziua 1 a acelei luni, iar din luna curentă în
    săptămâna de azi.

    `lunieaSaptamanii`, nu `lunieaUrmatoare`: acolo se PLANIFICĂ o săptămână
    viitoare, aici se vede ce s-a lucrat deja.
  */
  const ancora = an === anAzi && filtre.luna === lunaAzi ? azi : ziIso(an, filtre.luna, 1);
  const saptamanaCeruta = parametri[PARAM_SAPTAMANA];
  const saptamanaStart =
    typeof saptamanaCeruta === "string" && esteLuni(saptamanaCeruta)
      ? saptamanaCeruta
      : lunieaSaptamanii(ancora);

  /*
    Puntea dintre vizualizări. `adresaVizualizare` păstrează parametrii existenți,
    dar cele două jumătăți ale paginii se ancorează diferit — una în lună, alta în
    săptămână — iar fără punte comutarea ar sări în altă perioadă decât cea de pe
    ecran. Se completează doar cheia care lipsește; primitiva rămâne neatinsă.
  */
  const parametriComutator: ParametriAdresa =
    vizualizare === "saptamana"
      ? {
          ...parametri,
          an: saptamanaStart.slice(0, 4),
          luna: String(Number(saptamanaStart.slice(5, 7))),
        }
      : { ...parametri, [PARAM_SAPTAMANA]: saptamanaStart };

  const antet = (
    <AntetPagina
      titlu="Pontaj"
      descriere={
        vizualizare === "saptamana"
          ? "Săptămâna proprie, pe ore. Trageți peste o zonă dintr-o zi ca să pontați."
          : `Luna ${formatMonthYear(an, filtre.luna)}, pentru toți angajații.`
      }
      // Setările au acum FILĂ, nu buton de antet — `poateConfigura` se duce
      // acolo. Butonul de aici era singurul drum spre ele și stătea lângă titlu,
      // unde nimeni nu caută o navigare. Garda rămâne aceeași
      // (`attendance:update = all`, ca pagina țintă): un buton care se vede și
      // răspunde „nu aveți dreptul" e mai rău decât unul care lipsește.
      file={<NavPontaj poateAproba={poateAproba} poateConfigura={poateConfigura} />}
    />
  );

  const comutator = (
    <ComutatorVizualizare
      eticheta="Vizualizare pontaj"
      cheieParametru={PARAM_VIZUALIZARE}
      optiuni={OPTIUNI_VIZUALIZARE}
      curenta={vizualizare}
      implicita={VIZUALIZARE_IMPLICITA}
      parametri={parametriComutator}
      cale="/pontaj"
    />
  );

  if (vizualizare === "saptamana") {
    return (
      <div className="space-y-6">
        {antet}
        {comutator}
        <Suspense
          key={`saptamana-${saptamanaStart}`}
          fallback={<Schelet forma="tabel" coloane={8} />}
        >
          <SectiuneSaptamana
            organizationId={tenant.organizationId}
            userId={user.id}
            saptamanaStart={saptamanaStart}
            poateEdita={poateEdita}
            poateAproba={poateAproba}
            poateDeschide={poateDeschide}
            parametri={parametri}
            azi={azi}
          />
        </Suspense>
      </div>
    );
  }

  /*
    Trei citiri independente, un val.
    `zileLucratoareLuna` nu are nevoie de `perioada`: doar înmulțirea de mai jos
    e păzită de `perioada === null`. Iar sub capotă cheamă `zileNelucratoare`,
    memoizat de la reparația din `queries/leave.ts`, deci secțiunea streamată de
    mai jos nu-l mai plătește a doua oară.
  */
  const [perioada, listaDepartamente, zileLucratoare] = await Promise.all([
    citestePerioada(tenant.organizationId, an, filtre.luna),
    scope === "own" ? [] : departamente(tenant.organizationId),
    zileLucratoareLuna(tenant.organizationId, an, filtre.luna),
  ]);

  // Chiar depinde de `perioada`: îi ia `data_inceput`. Rămâne al doilea val.
  const setari =
    perioada === null ? null : await setariPontaj(tenant.organizationId, perioada.data_inceput);

  /*
    Parametrii după care se derivă orele dintr-un interval — ACEIAȘI ca la ziua
    individuală din portal, la planul săptămânal și la pontarea rapidă.

    `configZiDin`, nu șase valori de rezervă scrise aici: erau a cincea copie a
    acelorași implicite, iar comentariul funcției spune de ce copiile diverg
    exact acolo unde diferența se vede pe fluturașul de salariu, nu în teste.
  */
  const config = configZiDin(setari);
  // „Ore așteptate” pentru lună — bază de raportare, NU calculul de salariu
  // (acela rămâne în `salarizare`, care poate citi aceleași cifre mai târziu).
  const oreAsteptateLuna = perioada === null ? 0 : config.orePeZi * zileLucratoare;

  return (
    <div className="space-y-6">
      {antet}
      {comutator}

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
          <LunaIntreaga
            organizationId={tenant.organizationId}
            scope={scope}
            an={an}
            filtre={filtre}
            vizualizare={vizualizare}
            dataInceput={perioada.data_inceput}
            dataSfarsit={perioada.data_sfarsit}
            statusPerioada={perioada.status}
            blocataLa={perioada.blocata_la}
            utilizatorEticheta={user.fullName ?? user.email}
            poateEdita={poateEdita}
            poateAproba={poateAproba}
            config={config}
            limite={limiteleFirmei(setari)}
            oreAsteptateLuna={oreAsteptateLuna}
            parametri={parametri}
            azi={azi}
          />
        </Suspense>
      )}
    </div>
  );
}
