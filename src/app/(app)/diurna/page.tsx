// src/app/(app)/diurna/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plane, PlaneTakeoff, Settings } from "lucide-react";

import type { BaremTara } from "@/domain/per-diem/sume";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { RandTabel } from "@/components/data/rand-tabel";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  baremeleTarilor,
  calculeazaDiurnaDeplasare,
  calculeSalvate,
  listeazaDeplasari,
  politicaLaData,
  type CalculSalvat,
  type PoliticaRand,
  type RandDeplasare,
} from "@/lib/queries/per-diem";
import { filtreDeplasariSchema } from "@/schemas/per-diem";

import { CLASE_STATUS_DEPLASARE, ETICHETE_STATUS_DEPLASARE } from "./etichete";
import { FiltreDeplasari } from "./filtre-deplasari";
import { NavDiurna } from "./nav-diurna";

export const metadata: Metadata = { title: "Deplasări" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Rezumatul de sumă afișat pe un rând din listă.
 *
 * Preferă rândul din `per_diem_calculations` dacă există (îl scrie doar
 * `app.recalculeaza_diurna`, neapelabilă din client — practic mereu gol).
 * Altfel calculează în TS, cu ZERO etape reale: lista arată o estimare pe
 * ȚARA PROPRIE a deplasării, nu traseul exact — legile reale se văd pe fișa
 * deplasării, unde costul unei interogări suplimentare per rând se justifică.
 * Marcajul „(estimare)” face explicită diferența.
 */
function sumarDeplasare(
  rand: RandDeplasare,
  politiciDupaData: ReadonlyMap<string, PoliticaRand | null>,
  baremuri: readonly BaremTara[],
  salvat: CalculSalvat | undefined,
) {
  if (salvat !== undefined) {
    return {
      text: `${String(salvat.zile_total)} zile${salvat.valoare_lei === null ? "" : ` · ${formatLei(salvat.valoare_lei)}`}`,
      estimare: false,
    };
  }

  const politica = politiciDupaData.get(rand.plecare_la.slice(0, 10)) ?? null;
  if (politica === null) return { text: "fără politică valabilă", estimare: false };

  const { rezultat } = calculeazaDiurnaDeplasare(
    {
      countryId: rand.country_id,
      plecareLa: rand.plecare_la,
      sosireLa: rand.sosire_la,
      plecareEfectivaLa: rand.plecare_efectiva_la,
      sosireEfectivaLa: rand.sosire_efectiva_la,
      cursDiurna: rand.curs_diurna,
    },
    [],
    politica,
    baremuri,
  );

  return {
    text: `${String(rezultat.zileTotal)} zile${rezultat.valoareLei === null ? "" : ` · ${formatLei(rezultat.valoareLei)}`}`,
    estimare: true,
  };
}

async function TabelDeplasari({
  organizationId,
  parametri,
  arataAngajat,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly arataAngajat: boolean;
}) {
  const filtre = filtreDinUrl(filtreDeplasariSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaDeplasari(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null;
    return (
      <EmptyState
        icon={Plane}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio deplasare înregistrată"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate deplasările."
            : "Adăugați prima deplasare în interes de serviciu ca să urmăriți diurna și decontul."
        }
      />
    );
  }

  const idDeplasari = randuri.map((r) => r.id);
  const idTari = [
    ...new Set(randuri.map((r) => r.country_id).filter((id): id is string => id !== null)),
  ];
  const dateDistincte = [...new Set(randuri.map((r) => r.plecare_la.slice(0, 10)))];

  const [salvate, baremuri, politiciListe, angajati] = await Promise.all([
    calculeSalvate(idDeplasari),
    baremeleTarilor(idTari),
    Promise.all(
      dateDistincte.map(
        async (data) => [data, await politicaLaData(organizationId, data)] as const,
      ),
    ),
    arataAngajat
      ? angajatiDupaId(
          organizationId,
          randuri.map((r) => r.employee_id),
        )
      : Promise.resolve(new Map<string, never>()),
  ]);
  const politiciDupaData = new Map(politiciListe);

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Deplasările în interes de serviciu, cu diurna estimată.
          </caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Scop
              </th>
              {arataAngajat ? (
                <th scope="col" className="px-4 py-3 font-medium">
                  Angajat
                </th>
              ) : null}
              <th scope="col" className="px-4 py-3 font-medium">
                Perioada
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Diurnă
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((r) => {
              const angajat = angajati.get(r.employee_id);
              return (
                <RandTabel key={r.id} href={`/diurna/${r.id}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/diurna/${r.id}`} className="underline-offset-2 hover:underline">
                      {r.scop}
                    </Link>
                    {r.localitate === null ? null : (
                      <span className="text-muted-foreground"> · {r.localitate}</span>
                    )}
                  </td>
                  {arataAngajat ? (
                    <td className="px-4 py-3">
                      {angajat === undefined
                        ? "—"
                        : `${angajat.full_name ?? "—"} (${angajat.marca})`}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    {formatDateTime(new Date(r.plecare_la))} –{" "}
                    {formatDateTime(new Date(r.sosire_la))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_DEPLASARE[r.status]}`}
                    >
                      {ETICHETE_STATUS_DEPLASARE[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {(() => {
                      const sumar = sumarDeplasare(
                        r,
                        politiciDupaData,
                        baremuri,
                        salvate.get(r.id),
                      );
                      return (
                        <>
                          {sumar.text}
                          {sumar.estimare ? (
                            <span className="text-muted-foreground ml-1 text-xs">(estimare)</span>
                          ) : null}
                        </>
                      );
                    })()}
                  </td>
                </RandTabel>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/diurna?${cautare.toString()}`}
            className="border-foreground/60 hover:bg-surface rounded-md border px-4 py-2 text-sm"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaDiurna({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const scope = scopeFor(permisiuni, "per_diem:read");
  const poateAproba = can(permisiuni, "per_diem:approve", "team");
  const poateAdauga = can(permisiuni, "per_diem:create", "own");
  const poateConfiguraPolitica = can(permisiuni, "per_diem:update", "all");

  const azi = todayInBucharest();
  const politicaCurenta = await politicaLaData(tenant.organizationId, azi);

  if (politicaCurenta === null) {
    return (
      <main className="space-y-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold">Deplasări</h1>
        </header>
        <NavDiurna poateAproba={poateAproba} />
        <EmptyState
          icon={Settings}
          title="Politica de diurnă nu este configurată"
          description={
            poateConfiguraPolitica
              ? "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Configurați pragurile și baremul firmei."
              : "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Cereți administratorului organizației să configureze politica firmei."
          }
          {...(poateConfiguraPolitica
            ? { action: { label: "Configurează politica", href: "/diurna/politica" } }
            : {})}
        />
      </main>
    );
  }

  const parametri = await searchParams;

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Deplasări</h1>
          <p className="text-muted-foreground text-sm">
            {scope === "own"
              ? "Deplasările dumneavoastră în interes de serviciu, cu diurna estimată."
              : "Deplasările la care aveți acces, cu diurna estimată."}
          </p>
        </div>
        {poateAdauga ? (
          <Link
            href="/diurna/noua"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
          >
            <PlaneTakeoff aria-hidden="true" className="size-4" />
            Deplasare nouă
          </Link>
        ) : null}
      </header>

      <NavDiurna poateAproba={poateAproba} />
      <FiltreDeplasari />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={5} />}>
        <TabelDeplasari
          organizationId={tenant.organizationId}
          parametri={parametri}
          arataAngajat={scope === "team" || scope === "all"}
        />
      </Suspense>
    </main>
  );
}
