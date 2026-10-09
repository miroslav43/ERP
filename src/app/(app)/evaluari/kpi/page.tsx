// src/app/(app)/evaluari/kpi/page.tsx

/**
 * Lista lunilor de KPI ale echipei.
 *
 * ── DE CE LUNA E PREFILTRATĂ, NU LIBERĂ ───────────────────────────────────
 * KPI-ul se completează lunar, iar întrebarea managerului e mereu „unde stau cu
 * luna asta", nu „arată-mi tot". O listă nefiltrată ar fi pus laolaltă
 * douăsprezece luni × toți subordonații, deci n-ar fi răspuns la nicio
 * întrebare. Luna curentă e implicită; celelalte se aleg din selector.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { Gauge } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Nivel } from "@/components/ui/nivel";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { idFisaProprie } from "@/lib/queries/employees";
import { angajatiPentruKpi, listeazaLuniKpi, type RandKpi } from "@/lib/queries/kpi";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { DeschideLuna } from "./deschide-luna";
import { ETICHETE_STATUS_KPI, TONURI_STATUS_KPI, numeLuna, tonKpi } from "./etichete";
import { SelectorPerioada } from "./selector-perioada";
import { FileModul } from "@/components/ui/file-modul";
import { fileEvaluari } from "@/config/file-module";
import { PastileFiltre } from "@/components/ui/pastile-filtre";
import { angajatiDupaId } from "@/lib/queries/checklist";
import Link from "next/link";

export const metadata: Metadata = { title: "KPI lunar" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un parametru de URL e text străin: orice nu e număr în interval cade pe implicit. */
function intreg(brut: string | string[] | undefined, min: number, max: number): number | null {
  const text = Array.isArray(brut) ? brut[0] : brut;
  if (text === undefined) return null;
  const n = Number.parseInt(text, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

async function ListaLuni({
  organizationId,
  an,
  luna,
  cursor,
  angajat,
  status,
}: {
  readonly organizationId: string;
  readonly an: number;
  readonly luna: number;
  readonly cursor: string | null;
  /** `?angajat=`: toate lunile unui om, indiferent de an și lună. */
  readonly angajat: string | null;
  /** `?status=`: doar lunile în lucru sau doar cele închise. */
  readonly status: "draft" | "finalizat" | null;
}) {
  const { randuri, urmatorulCursor, total } = await listeazaLuniKpi(organizationId, {
    an: angajat === null ? an : null,
    luna: angajat === null ? luna : null,
    status,
    employee_id: angajat,
    sort: null,
    cursor,
    limita: 25,
  });

  const coloane: readonly Coloana<RandKpi>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (r) => <span className="font-medium">{r.angajat ?? "—"}</span>,
    },
    {
      cheie: "marca",
      antet: "Marca",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (r) => <span className="tabular-nums">{r.marca ?? "—"}</span>,
    },
    {
      cheie: "scor",
      antet: "Scor",
      numeric: true,
      celula: (r) =>
        r.scor_procent === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Nivel
            valoare={r.scor_procent}
            din={100}
            eticheta={`Scorul lunii pentru ${r.angajat ?? "angajat"}`}
            text={`${String(r.scor_procent)} % din țintă`}
            ton={tonKpi(r.scor_procent)}
            marime="subtire"
          />
        ),
    },
    {
      cheie: "completate",
      antet: "Completate",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => (
        <span className="tabular-nums">
          {r.completate} din {r.nrLinii}
        </span>
      ),
    },
    {
      cheie: "status",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (r) => (
        <Badge ton={TONURI_STATUS_KPI[r.status]}>{ETICHETE_STATUS_KPI[r.status]}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Tabel
        caption={
          angajat === null
            ? `Lunile de KPI din ${numeLuna(an, luna)}`
            : "Lunile de KPI ale angajatului"
        }
        coloane={coloane}
        randuri={randuri}
        cheieRand={(r) => r.id}
        href={(r) => `/evaluari/kpi/${r.id}`}
        gol={
          <StareGoala
            fel="filtrata"
            pictograma={Gauge}
            titlu={
              angajat === null
                ? `Nicio lună deschisă în ${numeLuna(an, luna)}`
                : "Nicio lună de KPI pentru acest angajat"
            }
            descriere="Deschideți luna pentru un subordonat direct, din butonul de sus. Liniile se preiau din setul funcției lui."
            actiune={{ eticheta: "Seturile de indicatori", href: "/evaluari/kpi/seturi" }}
          />
        }
      />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={25}
        construiesteHref={({ cursor: c, limita }) => {
          const p = new URLSearchParams({ an: String(an), luna: String(luna) });
          if (angajat !== null) p.set("angajat", angajat);
          p.set("limita", String(limita));
          if (c !== null) p.set("cursor", c);
          return `/evaluari/kpi?${p.toString()}`;
        }}
      />
    </div>
  );
}

export default async function PaginaKpi({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "kpi"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "evaluations:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evaluările." />;
  }

  const parametri = await searchParams;
  const acum = new Date();
  const an = intreg(parametri["an"], 2000, 2100) ?? acum.getFullYear();
  const luna = intreg(parametri["luna"], 1, 12) ?? acum.getMonth() + 1;
  const cursorBrut = parametri["cursor"];
  const cursor = typeof cursorBrut === "string" ? cursorBrut : null;
  // Filtrul de intrare din fișa angajatului sau din luna lui: un UUID, altfel nimic.
  const angajatBrut = parametri["angajat"];
  const angajatFiltrat =
    typeof angajatBrut === "string" && UUID_RE.test(angajatBrut) ? angajatBrut : null;
  // Filtrul de stare, din fișa angajatului sau din notificări; altceva = toate.
  const statusBrut = parametri["status"];
  const statusFiltrat = statusBrut === "draft" || statusBrut === "finalizat" ? statusBrut : null;
  const numeAngajatFiltrat =
    angajatFiltrat === null
      ? null
      : ((await angajatiDupaId(tenant.organizationId, [angajatFiltrat])).get(angajatFiltrat)
          ?.full_name ?? null);

  const poateEvalua = can(permisiuni, "evaluations:create", "team");
  // Scope `all` (hr, org_admin) vede toată firma; managerul, doar subordonații
  // lui DIRECȚI — fiindcă doar pentru ei îl lasă baza să scrie.
  const areTotul = can(permisiuni, "evaluations:create", "all");
  const propriaFisa = areTotul ? null : await idFisaProprie(tenant.organizationId, user.id);
  const angajati = poateEvalua ? await angajatiPentruKpi(tenant.organizationId, propriaFisa) : [];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="KPI lunar"
        descriere="Indicatorii lunari ai echipei, cu ținta pusă pe funcție și ajustată pe om. Angajatul își vede luna în lucru din portal."
        file={
          <FileModul
            eticheta="Secțiunile modulului de evaluări"
            file={fileEvaluari()}
            tenant={tenant}
          />
        }
        actiuni={
          <span className="flex flex-wrap items-center gap-3">
            {/* Pagina seturilor era orfană: nimic din modul nu ducea la ea. */}
            <Link
              href="/evaluari/kpi/seturi"
              className="text-nota underline-offset-2 hover:underline"
            >
              Seturile de indicatori
            </Link>
            {poateEvalua ? <DeschideLuna angajati={angajati} an={an} luna={luna} /> : null}
          </span>
        }
      />

      <SelectorPerioada an={an} luna={luna} />

      <PastileFiltre
        active={[
          ...(angajatFiltrat === null
            ? []
            : [{ cheie: "angajat", eticheta: `Angajat: ${numeAngajatFiltrat ?? "ales"}` }]),
          ...(statusFiltrat === null
            ? []
            : [
                {
                  cheie: "status",
                  eticheta: statusFiltrat === "draft" ? "Stare: în lucru" : "Stare: închise",
                },
              ]),
        ]}
      />

      <Suspense
        key={`${String(an)}-${String(luna)}-${cursor ?? ""}`}
        fallback={<Schelet forma="tabel" randuri={8} coloane={5} />}
      >
        <ListaLuni
          organizationId={tenant.organizationId}
          an={an}
          luna={luna}
          cursor={cursor}
          angajat={angajatFiltrat}
          status={statusFiltrat}
        />
      </Suspense>
    </div>
  );
}
