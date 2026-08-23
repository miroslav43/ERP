// src/app/(app)/diurna/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plane, PlaneTakeoff, Settings } from "lucide-react";

import type { BaremTara } from "@/domain/per-diem/sume";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
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

import { ETICHETE_STATUS_DEPLASARE, TONURI_STATUS_DEPLASARE } from "./etichete";
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
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Plane}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio deplasare înregistrată"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate deplasările."
            : "Adăugați prima deplasare în interes de serviciu ca să urmăriți diurna și decontul."
        }
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/diurna" } } : {})}
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
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
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
                    <Badge ton={TONURI_STATUS_DEPLASARE[r.status]}>
                      {ETICHETE_STATUS_DEPLASARE[r.status]}
                    </Badge>
                  </td>
                  <td className="text-corp px-4 py-3">
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
                            <span className="text-muted-foreground text-nota ml-1">(estimare)</span>
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
          <Link href={`/diurna?${cautare.toString()}`} className={buton({ varianta: "secundar" })}>
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
      <div className="space-y-6">
        <AntetPagina titlu="Deplasări" file={<NavDiurna poateAproba={poateAproba} />} />
        <StareGoala
          fel="initiala"
          pictograma={Settings}
          titlu="Politica de diurnă nu este configurată"
          descriere={
            poateConfiguraPolitica
              ? "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Configurați pragurile și baremul firmei."
              : "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Cereți administratorului organizației să configureze politica firmei."
          }
          {...(poateConfiguraPolitica
            ? { actiune: { eticheta: "Configurează politica", href: "/diurna/politica" } }
            : {})}
        />
      </div>
    );
  }

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Deplasări"
        descriere={
          scope === "own"
            ? "Deplasările dumneavoastră în interes de serviciu, cu diurna estimată."
            : "Deplasările la care aveți acces, cu diurna estimată."
        }
        {...(poateAdauga
          ? {
              actiuni: (
                <Link href="/diurna/noua" className={buton({ varianta: "primar" })}>
                  <PlaneTakeoff aria-hidden="true" className="size-4" />
                  Deplasare nouă
                </Link>
              ),
            }
          : {})}
        file={<NavDiurna poateAproba={poateAproba} />}
      />

      <FiltreDeplasari />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelDeplasari
          organizationId={tenant.organizationId}
          parametri={parametri}
          arataAngajat={scope === "team" || scope === "all"}
        />
      </Suspense>
    </div>
  );
}
