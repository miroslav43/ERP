// src/app/(app)/pontaj/perioade/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { anDinUrl } from "@/lib/rute/parametri";
import { listeazaPerioade, type PerioadaPontaj } from "@/lib/queries/attendance";

import { NavPontaj } from "../nav-pontaj";
import { fileDePontaj } from "../file-pontaj";
import { TONURI_STATUS_PERIOADA, ETICHETE_STATUS_PERIOADA } from "../etichete";
import { ActiuniPerioada } from "./actiuni-perioada";

export const metadata: Metadata = { title: "Perioade de pontaj" };

const LUNI_ETICHETE = [
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
] as const;

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface RandPerioada {
  readonly luna: number;
  readonly eticheta: string;
  readonly perioada: PerioadaPontaj | null;
}

async function TabelPerioade({
  organizationId,
  an,
  poateDeschide,
  poateBloca,
}: {
  readonly organizationId: string;
  readonly an: number;
  readonly poateDeschide: boolean;
  readonly poateBloca: boolean;
}) {
  const perioade = await listeazaPerioade(organizationId, an);
  const dupaLuna = new Map(perioade.map((p) => [p.luna, p]));

  const randuri: readonly RandPerioada[] = LUNI_ETICHETE.map((eticheta, index) => ({
    luna: index + 1,
    eticheta,
    perioada: dupaLuna.get(index + 1) ?? null,
  }));

  /**
   * Linkul stă în celula de titlu, nu pe rând: o lună nedeschisă n-are unde
   * duce, iar `Tabel` nu poate avea un `href` care lipsește doar pe unele
   * rânduri. În plus, așa destinația e accesibilă și de la tastatură — rândul
   * apăsabil de dinainte era strict o comoditate de mouse.
   */
  const coloane: readonly Coloana<RandPerioada>[] = [
    {
      cheie: "luna",
      antet: "Luna",
      peTelefon: "titlu",
      celula: (rand) =>
        rand.perioada === null ? (
          <span className="font-medium">{rand.eticheta}</span>
        ) : (
          <Link
            href={`/pontaj/perioade/${rand.perioada.id}`}
            className="font-medium underline-offset-2 hover:underline"
          >
            {rand.eticheta}
          </Link>
        ),
    },
    {
      cheie: "interval",
      antet: "Interval",
      peTelefon: "meta",
      celula: (rand) => (
        <span className="text-muted-foreground">
          {rand.perioada === null
            ? "—"
            : `${formatDate(rand.perioada.data_inceput)} – ${formatDate(rand.perioada.data_sfarsit)}`}
        </span>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (rand) =>
        rand.perioada === null ? (
          // „Neschisă” era o greșeală de tastare pentru „Nedeschisă”, afișată pe
          // fiecare lună neîncepută — adică pe majoritatea celor 12 rânduri.
          <Badge ton="ciorna">Nedeschisă</Badge>
        ) : (
          <Badge ton={TONURI_STATUS_PERIOADA[rand.perioada.status]}>
            {ETICHETE_STATUS_PERIOADA[rand.perioada.status]}
          </Badge>
        ),
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      antetAscuns: true,
      latime: "ingusta",
      // „insignă”, nu „meta”: `ActiuniPerioada` randează un `<div>`, iar rândul
      // mărunt al cardului e un `<p>` — browserul l-ar închide devreme și
      // hidratarea ar cădea.
      peTelefon: "insigna",
      celula: (rand) => (
        <ActiuniPerioada
          an={an}
          luna={rand.luna}
          periodId={rand.perioada?.id ?? null}
          status={rand.perioada?.status ?? null}
          poateDeschide={poateDeschide}
          poateBloca={poateBloca}
        />
      ),
    },
  ];

  return (
    <Tabel
      caption={`Perioadele de pontaj ale anului ${String(an)}.`}
      coloane={coloane}
      randuri={randuri}
      cheieRand={(rand) => String(rand.luna)}
      gol={null}
    />
  );
}

export default async function PaginaPerioadePontaj({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "attendance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "attendance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta perioadele de pontaj. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  // `poateAproba` nu se mai calculează aici: fila „Aprobare" depinde și de
  // alegerea firmei de a avea un pas de aprobare (0118), iar condiția compusă
  // stă într-un singur loc — `file-pontaj.ts`.
  const fileNav = await fileDePontaj(tenant.organizationId, permisiuni);
  const poateDeschide = can(permisiuni, "attendance:create", "all");
  const poateBloca = can(permisiuni, "attendance:approve", "all");

  const parametri = await searchParams;
  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Perioade de pontaj"
        descriere={`Deschiderea și blocarea lunilor de pontaj ale anului ${String(an)}.`}
        actiuni={
          <nav aria-label="Anul perioadelor" className="text-corp flex items-center gap-3">
            <Link
              href={`/pontaj/perioade?an=${String(an - 1)}`}
              className="underline underline-offset-2"
            >
              {an - 1}
            </Link>
            <span className="font-semibold">{an}</span>
            <Link
              href={`/pontaj/perioade?an=${String(an + 1)}`}
              className="underline underline-offset-2"
            >
              {an + 1}
            </Link>
          </nav>
        }
        file={<NavPontaj {...fileNav} />}
      />

      <Suspense key={String(an)} fallback={<Schelet forma="tabel" coloane={4} />}>
        <TabelPerioade
          organizationId={tenant.organizationId}
          an={an}
          poateDeschide={poateDeschide}
          poateBloca={poateBloca}
        />
      </Suspense>
    </div>
  );
}
