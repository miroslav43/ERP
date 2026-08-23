// src/app/(app)/diurna/[id]/decont/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  baremeleTarilor,
  calculeazaDiurnaDeplasare,
  cheltuielile,
  citesteDeplasare,
  etapele,
  politicaLaData,
} from "@/lib/queries/per-diem";

import {
  ETICHETE_MIJLOC_TRANSPORT,
  ETICHETE_STATUS_DEPLASARE,
  ETICHETE_TIP_CHELTUIALA,
} from "../../etichete";
import { ButonTipar } from "./buton-tipar";

export const metadata: Metadata = { title: "Decont deplasare" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Pagină printabilă — layout propriu, ascuns de meniu la tipărire.
 *
 * Nu putem elimina din markup bara laterală și antetul aplicației: ele
 * trăiesc în `(app)/layout.tsx`, comun tuturor modulelor și în afara
 * fișierelor acestei faze. Le ascundem la tipărire pe selector de element
 * semantic (`aside`, `header` — cele folosite de `Sidebar`/`Topbar`), din
 * `<style>`-ul de mai jos, care se aplică STRICT sub `@media print`.
 */
export default async function PaginaDecont({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const deplasare = await citesteDeplasare(tenant.organizationId, id);
  if (deplasare === null) notFound();

  const [etapeTrip, cheltuieliTrip, angajati] = await Promise.all([
    etapele(deplasare.id),
    cheltuielile(deplasare.id),
    angajatiDupaId(tenant.organizationId, [deplasare.employee_id]),
  ]);
  const angajat = angajati.get(deplasare.employee_id);

  const politica = await politicaLaData(tenant.organizationId, deplasare.plecare_la.slice(0, 10));
  const idTariImplicate = [
    ...new Set(
      [
        deplasare.country_id,
        politica?.country_id_intern ?? null,
        ...etapeTrip.flatMap((e) => [e.from_country_id, e.to_country_id]),
      ].filter((v): v is string => v !== null),
    ),
  ];
  const baremuri = await baremeleTarilor(idTariImplicate);

  const calcul =
    politica === null
      ? null
      : calculeazaDiurnaDeplasare(
          {
            countryId: deplasare.country_id,
            plecareLa: deplasare.plecare_la,
            sosireLa: deplasare.sosire_la,
            plecareEfectivaLa: deplasare.plecare_efectiva_la,
            sosireEfectivaLa: deplasare.sosire_efectiva_la,
            cursDiurna: deplasare.curs_diurna,
          },
          etapeTrip.map((e) => ({
            ordine: e.ordine,
            fromCountryId: e.from_country_id,
            toCountryId: e.to_country_id,
            sosireLa: e.sosire_la,
          })),
          politica,
          baremuri,
        );

  const diurnaLei = calcul?.rezultat.valoareLei ?? null;
  const cheltuieliAprobateLei = cheltuieliTrip
    .filter((c) => c.aprobata)
    .reduce((sum, c) => sum + c.suma_lei, 0);
  const totalDecont =
    diurnaLei === null ? null : diurnaLei + cheltuieliAprobateLei - deplasare.avans_acordat;

  return (
    <div className={cn(LATIMI.formular, "space-y-6 print:max-w-none")}>
      {/* Nu putem elimina din markup bara laterală și antetul aplicației —
          trăiesc în `(app)/layout.tsx`, comun tuturor modulelor. Le ascundem
          la tipărire pe selectorul de element semantic pe care îl folosesc
          `Sidebar` (`aside`) și `Topbar` (`header`), STRICT sub `@media print`.
          Antetul PROPRIU al decontului e tot un `<header>`, deci se exceptează
          pe nume — altfel documentul tipărit ar rămâne fără titlu. */}
      <style>{`
        @media print {
          aside, header:not(.antet-decont) { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <Link href={`/diurna/${deplasare.id}`} className="text-corp underline underline-offset-2">
          ← Înapoi la fișa deplasării
        </Link>
        <ButonTipar />
      </div>

      <AntetPagina
        className="antet-decont border-foreground/60 gap-1 border-b pb-4"
        titlu="Decont de deplasare"
        descriere={`Nr. document: ${deplasare.numar_document ?? "(fără număr)"} · Stare: ${ETICHETE_STATUS_DEPLASARE[deplasare.status]}`}
        file={
          <div className="text-muted-foreground text-corp space-y-1">
            <p>
              {angajat === undefined ? "" : `${angajat.full_name ?? "—"} (${angajat.marca}) · `}
              {deplasare.scop}
            </p>
            <p>
              {formatDateTime(new Date(deplasare.plecare_la))} –{" "}
              {formatDateTime(new Date(deplasare.sosire_la))}
              {deplasare.localitate === null ? "" : ` · ${deplasare.localitate}`} ·{" "}
              {ETICHETE_MIJLOC_TRANSPORT[deplasare.mijloc_transport]}
            </p>
          </div>
        }
      />

      <section aria-labelledby="titlu-diurna">
        <h2 id="titlu-diurna" className="text-sectiune mb-2 font-medium">
          Diurnă
        </h2>
        {politica === null ? (
          <p className="text-muted-foreground text-corp">
            Nu există o politică de diurnă valabilă la data plecării.
          </p>
        ) : calcul === null ? null : (
          <p className="text-corp">
            {calcul.rezultat.zileTotal} zile ={" "}
            {diurnaLei === null ? "sumă necunoscută (curs sau barem lipsă)" : formatLei(diurnaLei)}
          </p>
        )}
      </section>

      <section aria-labelledby="titlu-cheltuieli">
        <h2 id="titlu-cheltuieli" className="text-sectiune mb-2 font-medium">
          Cheltuieli aprobate
        </h2>
        {cheltuieliTrip.filter((c) => c.aprobata).length === 0 ? (
          <p className="text-muted-foreground text-corp">Nicio cheltuială aprobată.</p>
        ) : (
          <table className="text-corp w-full">
            <thead>
              <tr className="border-foreground/60 border-b text-left">
                <th className="py-1 font-medium">Tip</th>
                <th className="py-1 font-medium">Data</th>
                <th className="py-1 text-right font-medium">Lei</th>
              </tr>
            </thead>
            <tbody>
              {cheltuieliTrip
                .filter((c) => c.aprobata)
                .map((c) => (
                  <tr key={c.id} className="border-border border-b">
                    <td className="py-1">
                      {ETICHETE_TIP_CHELTUIALA[c.tip]}
                      {c.descriere === null ? "" : ` · ${c.descriere}`}
                    </td>
                    <td className="py-1">{formatDate(c.data_cheltuielii)}</td>
                    <td className="py-1 text-right tabular-nums">{formatLei(c.suma_lei)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="titlu-total" className="border-foreground/60 border-t pt-4">
        <h2 id="titlu-total" className="text-sectiune mb-2 font-medium">
          Total decont
        </h2>
        <dl className="text-corp space-y-1">
          <div className="flex justify-between">
            <dt>Diurnă</dt>
            <dd>{diurnaLei === null ? "—" : formatLei(diurnaLei)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Cheltuieli aprobate</dt>
            <dd>{formatLei(cheltuieliAprobateLei)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Avans acordat</dt>
            <dd>− {formatLei(deplasare.avans_acordat)}</dd>
          </div>
          <div className="border-foreground/60 flex justify-between border-t pt-1 font-semibold">
            <dt>Total de decontat</dt>
            <dd>{totalDecont === null ? "necunoscut" : formatLei(totalDecont)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
