// src/app/(app)/pontaj/perioade/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { anDinUrl } from "@/lib/rute/parametri";
import { listeazaPerioade } from "@/lib/queries/attendance";

import { NavPontaj } from "../nav-pontaj";
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
    <div className="border-border rounded-panou overflow-x-auto border">
      <table className="text-corp w-full">
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
        <tbody className="divide-border divide-y">
          {LUNI_ETICHETE.map((eticheta, index) => {
            const luna = index + 1;
            const perioada = dupaLuna.get(luna) ?? null;
            return (
              <RandTabel
                key={luna}
                href={perioada === null ? null : `/pontaj/perioade/${perioada.id}`}
              >
                <td className="px-4 py-3 font-medium">{eticheta}</td>
                <td className="text-muted-foreground px-4 py-3">
                  {perioada === null
                    ? "—"
                    : `${formatDate(perioada.data_inceput)} – ${formatDate(perioada.data_sfarsit)}`}
                </td>
                <td className="px-4 py-3">
                  {perioada === null ? (
                    <span className="text-muted-foreground text-nota">Neschisă</span>
                  ) : (
                    <Badge ton={TONURI_STATUS_PERIOADA[perioada.status]}>
                      {ETICHETE_STATUS_PERIOADA[perioada.status]}
                    </Badge>
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
              </RandTabel>
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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
        file={<NavPontaj poateAproba={poateAproba} />}
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
