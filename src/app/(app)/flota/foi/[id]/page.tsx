// src/app/(app)/flota/foi/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  alimentarileFoii,
  angajatiDupaId,
  citesteFoaie,
  vehiculeDupaId,
} from "@/lib/queries/fleet";

import { ETICHETE_STATUS_FOAIE, TONURI_STATUS_FOAIE } from "../../etichete";
import { ActiuniFoaie } from "./actiuni-foaie";

export const metadata: Metadata = { title: "Foaie de parcurs" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaFoaie({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "trip_sheets:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta foile de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const foaie = await citesteFoaie(tenant.organizationId, id);
  if (foaie === null) notFound();

  const [alimentari, vehicule, soferi] = await Promise.all([
    alimentarileFoii(foaie.id),
    vehiculeDupaId(tenant.organizationId, [foaie.vehicle_id]),
    angajatiDupaId(tenant.organizationId, foaie.employee_id === null ? [] : [foaie.employee_id]),
  ]);

  const vehicul = vehicule.get(foaie.vehicle_id);
  const sofer = foaie.employee_id === null ? undefined : soferi.get(foaie.employee_id);
  const poateScrie = can(permisiuni, "trip_sheets:update", "own");

  // Titlul și subtitlul se compun ca text: `AntetPagina` cere `string`, iar
  // conținutul rămâne cuvânt cu cuvânt cel de dinainte.
  const titlu = `${vehicul?.nr_inmatriculare ?? "Vehicul indisponibil"}${
    foaie.numar === null ? "" : ` · ${foaie.numar}`
  }`;
  const descriere = `${formatDateTime(new Date(foaie.plecare_la))}${
    foaie.sosire_la === null ? "" : ` – ${formatDateTime(new Date(foaie.sosire_la))}`
  }${sofer === undefined ? "" : ` · ${sofer.full_name ?? sofer.marca}`}`;

  const litriTotali = alimentari.reduce((s, a) => s + a.litri, 0);
  const costTotal = alimentari.reduce((s, a) => s + a.cost, 0);
  // Consumul real se calculează doar când există și kilometri, și litri.
  // Împărțirea la zero ar da „Infinity" pe ecran — o cifră fără înțeles.
  const consumReal =
    foaie.km_parcursi !== null && foaie.km_parcursi > 0 && litriTotali > 0
      ? (litriTotali / foaie.km_parcursi) * 100
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/flota/foi" className="underline-offset-2 hover:underline">
            Foi de parcurs
          </Link>
        </p>
        <AntetPagina
          titlu={titlu}
          descriere={descriere}
          actiuni={
            <Badge ton={TONURI_STATUS_FOAIE[foaie.status]} className="shrink-0">
              {ETICHETE_STATUS_FOAIE[foaie.status]}
            </Badge>
          }
        />
      </div>

      {foaie.status === "respins" ? (
        <div
          role="alert"
          className="border-danger/40 bg-danger/8 text-corp rounded-panou border p-4"
        >
          <p className="font-medium">Foaia a fost respinsă</p>
          <p className="mt-1">
            {(foaie as { motiv_respingere?: string | null }).motiv_respingere ??
              "Nu a fost consemnat niciun motiv."}
          </p>
        </div>
      ) : null}

      <section
        aria-label="Kilometraj și consum"
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-4"
      >
        <Camp
          eticheta="Plecare"
          valoare={`${foaie.km_plecare?.toLocaleString("ro-RO") ?? "—"} km`}
        />
        <Camp
          eticheta="Sosire"
          valoare={foaie.km_sosire === null ? "—" : `${foaie.km_sosire.toLocaleString("ro-RO")} km`}
        />
        <Camp
          eticheta="Parcurs"
          valoare={
            foaie.km_parcursi === null
              ? "cursă în desfășurare"
              : `${foaie.km_parcursi.toLocaleString("ro-RO")} km`
          }
        />
        <Camp
          eticheta="Consum real"
          valoare={consumReal === null ? "—" : `${consumReal.toFixed(2)} l/100 km`}
        />
      </section>

      {foaie.traseu === null && foaie.scop === null ? null : (
        <section aria-label="Traseu și scop" className="text-corp space-y-1">
          {foaie.traseu === null ? null : (
            <p>
              <span className="text-muted-foreground">Traseu: </span>
              {foaie.traseu}
            </p>
          )}
          {foaie.scop === null ? null : (
            <p>
              <span className="text-muted-foreground">Scop: </span>
              {foaie.scop}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="alimentari" className="space-y-3">
        <h2 id="alimentari" className="text-sectiune font-semibold">
          Alimentări
        </h2>
        {alimentari.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Nicio alimentare înregistrată pe această cursă.
          </p>
        ) : (
          <div className="border-border rounded-panou overflow-x-auto border">
            <table className="text-corp w-full">
              <thead className="bg-surface text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Stație
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Litri
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Cost
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Preț/litru
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {alimentari.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateTime(new Date(a.alimentat_la))}
                    </td>
                    <td className="px-4 py-3">{a.statie ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{a.litri}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatLei(a.cost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {a.pret_litru === null ? "—" : formatLei(a.pret_litru)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface font-medium">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{litriTotali.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatLei(costTotal)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {poateScrie ? (
        <ActiuniFoaie
          id={foaie.id}
          status={foaie.status}
          kmPlecare={foaie.km_plecare ?? 0}
          plecareLa={foaie.plecare_la}
          sosireLa={foaie.sosire_la}
        />
      ) : null}
    </div>
  );
}

function Camp({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-nota">{eticheta}</dt>
      <dd className="text-corp font-medium">{valoare}</dd>
    </div>
  );
}
