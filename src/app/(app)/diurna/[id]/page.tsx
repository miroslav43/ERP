// src/app/(app)/diurna/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  baremeleTarilor,
  cheltuielile,
  citesteDeplasare,
  etapele,
  politicaLaData,
  tari,
} from "@/lib/queries/per-diem";

import {
  CLASE_STATUS_DEPLASARE,
  ETICHETE_MIJLOC_TRANSPORT,
  ETICHETE_STATUS_DEPLASARE,
  ETICHETE_TIP_CHELTUIALA,
} from "../etichete";
import { ActiuniDeplasare } from "./actiuni-deplasare";
import { Etape } from "./etape";
import { FormularCheltuiala } from "./formular-cheltuiala";
import { FormularEtapa } from "./formular-etapa";

export const metadata: Metadata = { title: "Fișa deplasării" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaDeplasare({ params }: ProprietatiPagina) {
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

  const [etapeTrip, cheltuieliTrip, listaTari] = await Promise.all([
    etapele(deplasare.id),
    cheltuielile(deplasare.id),
    tari(),
  ]);

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
  const hartaTari = new Map(listaTari.map((t) => [t.id, t]));

  const arataAngajat = can(permisiuni, "per_diem:read", "team");
  const angajati = arataAngajat
    ? await angajatiDupaId(tenant.organizationId, [deplasare.employee_id])
    : new Map<string, never>();
  const angajat = angajati.get(deplasare.employee_id);

  const editabila = deplasare.status === "ciorna" || deplasare.status === "respinsa";
  const poateTrimite = can(permisiuni, "per_diem:update", "own") && editabila;
  const poateSterge = can(permisiuni, "per_diem:delete", "own") && deplasare.status === "ciorna";
  const poateDeconta =
    can(permisiuni, "per_diem:approve", "team") && deplasare.status === "aprobata";
  const poateAdaugaEtapa = can(permisiuni, "per_diem:update", "own") && editabila;
  const poateAdaugaCheltuiala = can(permisiuni, "per_diem:update", "own");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            <Link href="/diurna" className="underline-offset-2 hover:underline">
              Deplasări
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{deplasare.scop}</h1>
          <p className="text-muted-foreground text-sm">
            {angajat === undefined ? "" : `${angajat.full_name ?? "—"} (${angajat.marca}) · `}
            {formatDateTime(new Date(deplasare.plecare_la))} –{" "}
            {formatDateTime(new Date(deplasare.sosire_la))}
            {deplasare.localitate === null ? "" : ` · ${deplasare.localitate}`}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${CLASE_STATUS_DEPLASARE[deplasare.status]}`}
        >
          {ETICHETE_STATUS_DEPLASARE[deplasare.status]}
        </span>
      </header>

      <section aria-labelledby="titlu-rezumat" className="border-border rounded-lg border p-4">
        <h2 id="titlu-rezumat" className="mb-4 text-lg font-medium">
          Rezumat
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Camp
            eticheta="Mijloc de transport"
            valoare={ETICHETE_MIJLOC_TRANSPORT[deplasare.mijloc_transport]}
          />
          <Camp
            eticheta="Avans acordat"
            valoare={
              deplasare.avans_acordat > 0
                ? `${formatLei(deplasare.avans_acordat)}${deplasare.moneda_avans !== null && deplasare.moneda_avans !== "RON" ? ` (${deplasare.moneda_avans})` : ""}`
                : "—"
            }
          />
          <Camp
            eticheta="Curs diurnă"
            valoare={deplasare.curs_diurna === null ? "—" : String(deplasare.curs_diurna)}
          />
          <Camp
            eticheta="Kilometri parcurși"
            valoare={
              deplasare.km_parcursi === null
                ? "—"
                : `${deplasare.km_parcursi.toLocaleString("ro-RO")} km`
            }
          />
          {deplasare.detasare_transnationala ? (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Detașare transnațională
              </dt>
              <dd className="mt-0.5 text-sm">
                Stat gazdă:{" "}
                {deplasare.stat_gazda_country_id === null
                  ? "—"
                  : (hartaTari.get(deplasare.stat_gazda_country_id)?.denumire ??
                    deplasare.stat_gazda_country_id)}
                {deplasare.salariu_minim_stat_gazda === null
                  ? ""
                  : ` · Salariu minim: ${String(deplasare.salariu_minim_stat_gazda)} ${deplasare.moneda_salariu_minim ?? ""}`}
              </dd>
            </div>
          ) : null}
          {deplasare.observatii === null ? null : (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">Observații</dt>
              <dd className="mt-0.5 text-sm">{deplasare.observatii}</dd>
            </div>
          )}
        </dl>
      </section>

      <ActiuniDeplasare
        id={deplasare.id}
        poateTrimite={poateTrimite}
        poateSterge={poateSterge}
        poateDeconta={poateDeconta}
      />

      <section aria-labelledby="titlu-traseu" className="space-y-3">
        <h2 id="titlu-traseu" className="text-lg font-medium">
          Traseu și calculul diurnei
        </h2>
        <Etape
          deplasare={deplasare}
          etape={etapeTrip}
          politica={politica}
          baremuri={baremuri}
          tari={hartaTari}
        />
        {poateAdaugaEtapa ? (
          <FormularEtapa tripId={deplasare.id} tari={listaTari} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {editabila
              ? ""
              : "Traseul nu mai poate fi modificat — deplasarea a ieșit din starea editabilă."}
          </p>
        )}
      </section>

      <section aria-labelledby="titlu-cheltuieli" className="space-y-3">
        <h2 id="titlu-cheltuieli" className="text-lg font-medium">
          Cheltuieli
        </h2>
        {cheltuieliTrip.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nicio cheltuială înregistrată încă.</p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Tip
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Sumă
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Lei
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Stare
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {cheltuieliTrip.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2">
                      {ETICHETE_TIP_CHELTUIALA[c.tip]}
                      {c.descriere === null ? "" : ` · ${c.descriere}`}
                    </td>
                    <td className="px-3 py-2">{c.data_cheltuielii}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.suma} {c.moneda}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatLei(c.suma_lei)}</td>
                    <td className="px-3 py-2">
                      {c.aprobata ? (
                        <span className="bg-surface text-foreground rounded px-2 py-0.5 text-xs font-medium">
                          Aprobată
                        </span>
                      ) : c.motiv_respingere !== null ? (
                        <span className="bg-danger/8 text-danger rounded px-2 py-0.5 text-xs font-medium">
                          Respinsă
                        </span>
                      ) : (
                        <span className="bg-surface text-foreground rounded px-2 py-0.5 text-xs font-medium">
                          În așteptare
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {poateAdaugaCheltuiala ? <FormularCheltuiala tripId={deplasare.id} /> : null}
      </section>

      <p className="text-sm">
        <Link href={`/diurna/${deplasare.id}/decont`} className="underline underline-offset-2">
          Deschide decontul printabil
        </Link>
      </p>
    </main>
  );
}

function Camp({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{eticheta}</dt>
      <dd className="mt-0.5 text-sm">{valoare}</dd>
    </div>
  );
}
