// src/app/(app)/pontaj/perioade/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { anDinUrl } from "@/lib/rute/parametri";
import { listeazaPerioade } from "@/lib/queries/attendance";

import { NavPontaj } from "../nav-pontaj";
import { CLASE_STATUS_PERIOADA, ETICHETE_STATUS_PERIOADA } from "../etichete";
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

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Perioadele de pontaj ale anului {an}.</caption>
        <thead className="bg-surface text-left">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Luna
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Interval
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Stare
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Acțiuni
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {LUNI_ETICHETE.map((eticheta, index) => {
            const luna = index + 1;
            const perioada = dupaLuna.get(luna) ?? null;
            return (
              <tr key={luna} className="hover:bg-surface">
                <td className="px-4 py-3 font-medium">{eticheta}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {perioada === null
                    ? "—"
                    : `${formatDate(perioada.data_inceput)} – ${formatDate(perioada.data_sfarsit)}`}
                </td>
                <td className="px-4 py-3">
                  {perioada === null ? (
                    <span className="text-xs text-muted-foreground">Neschisă</span>
                  ) : (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_PERIOADA[perioada.status]}`}
                    >
                      {ETICHETE_STATUS_PERIOADA[perioada.status]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ActiuniPerioada
                    an={an}
                    luna={luna}
                    periodId={perioada?.id ?? null}
                    status={perioada?.status ?? null}
                    poateDeschide={poateDeschide}
                    poateBloca={poateBloca}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaginaPerioadePontaj({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "attendance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta perioadele de pontaj. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateAproba = can(permisiuni, "attendance:approve", "team");
  const poateDeschide = can(permisiuni, "attendance:create", "all");
  const poateBloca = can(permisiuni, "attendance:approve", "all");

  const parametri = await searchParams;
  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Perioade de pontaj</h1>
          <p className="text-sm text-muted-foreground">
            Deschiderea și blocarea lunilor de pontaj ale anului {String(an)}.
          </p>
        </div>
        <nav aria-label="Anul perioadelor" className="flex items-center gap-3 text-sm">
          <Link href={`/pontaj/perioade?an=${String(an - 1)}`} className="underline underline-offset-2">
            {an - 1}
          </Link>
          <span className="font-semibold">{an}</span>
          <Link href={`/pontaj/perioade?an=${String(an + 1)}`} className="underline underline-offset-2">
            {an + 1}
          </Link>
        </nav>
      </header>

      <NavPontaj poateAproba={poateAproba} />

      <Suspense key={String(an)} fallback={<SkeletonTable cols={4} />}>
        <TabelPerioade
          organizationId={tenant.organizationId}
          an={an}
          poateDeschide={poateDeschide}
          poateBloca={poateBloca}
        />
      </Suspense>
    </main>
  );
}
