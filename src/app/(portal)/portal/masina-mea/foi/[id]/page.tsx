// src/app/(portal)/portal/masina-mea/foi/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { consumLa100Km } from "@/domain/fleet/consum";
import { alimentarileFoii, anomaliiPeFoi, citesteFoaie, vehiculeDupaId } from "@/lib/queries/fleet";
import { fisaMea } from "@/lib/queries/portal";
import {
  ETICHETE_STATUS_FOAIE,
  formatConsum,
  TONURI_STATUS_FOAIE,
} from "@/app/(app)/flota/etichete";
import { ActiuniFoaie } from "@/app/(app)/flota/foi/[id]/actiuni-foaie";

import { FaraFisa } from "../../../fara-fisa";

export const metadata: Metadata = { title: "Foaie de parcurs" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Foaia șoferului, în portal: cifrele, alimentările, închiderea și
 * redeschiderea după respingere. Corespondentul lui `/flota/foi/[id]`, fără
 * decizie (nimeni nu-și aprobă propria foaie) și fără legături spre fișele pe
 * care angajatul nu le poate deschide.
 *
 * Foaia altcuiva dă 404, nu „acces restricționat”, chiar dacă rolul ar avea
 * `trip_sheets:read` mai larg: portalul e „ale mele”, iar filtrul pe fișă e
 * explicit (antetul din `src/lib/queries/portal.ts`).
 */
export default async function PaginaFoaiaMea({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant, user } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "trip_sheets:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta foile de parcurs." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const foaie = await citesteFoaie(tenant.organizationId, id);
  if (foaie === null || foaie.employee_id !== stare.fisa.id) notFound();

  const [alimentari, vehicule, anomalii] = await Promise.all([
    alimentarileFoii(foaie.id),
    vehiculeDupaId(tenant.organizationId, [foaie.vehicle_id]),
    anomaliiPeFoi(tenant.organizationId, [foaie.id]),
  ]);
  const vehicul = vehicule.get(foaie.vehicle_id);
  const poateScrie = can(permisiuni, "trip_sheets:update", "own");

  const litriTotali = alimentari.reduce((s, a) => s + a.litri, 0);
  const costTotal = alimentari.reduce((s, a) => s + a.cost, 0);
  const consumReal = consumLa100Km(litriTotali, foaie.km_parcursi);
  const aleFoii = anomalii.get(foaie.id) ?? [];

  const coloaneAlimentari: readonly Coloana<(typeof alimentari)[number]>[] = [
    {
      cheie: "data",
      antet: "Data",
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (a) => formatDateTime(new Date(a.alimentat_la)),
    },
    {
      cheie: "statie",
      antet: "Stație",
      peTelefon: "meta",
      celula: (a) => (
        <>
          {a.statie ?? "—"}
          {a.plin ? <span className="text-muted-foreground"> · plin</span> : null}
        </>
      ),
    },
    {
      cheie: "litri",
      antet: "Litri",
      numeric: true,
      peTelefon: "meta",
      celula: (a) => a.litri,
    },
    {
      cheie: "cost",
      antet: "Cost",
      numeric: true,
      peTelefon: "meta",
      celula: (a) => formatLei(a.cost),
    },
  ];

  return (
    <div className={`${LATIMI.detaliu} space-y-6 p-4`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/portal/masina-mea" className="underline-offset-2 hover:underline">
            Mașina mea
          </Link>
        </p>
        <AntetPagina
          titlu={`${vehicul?.nr_inmatriculare ?? "Vehicul indisponibil"}${
            foaie.numar === null ? "" : ` · ${foaie.numar}`
          }`}
          descriere={`${formatDateTime(new Date(foaie.plecare_la))}${
            foaie.sosire_la === null ? "" : ` – ${formatDateTime(new Date(foaie.sosire_la))}`
          }`}
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
          <p className="mt-1">{foaie.motiv_respingere ?? "Nu a fost consemnat niciun motiv."}</p>
          <p className="text-muted-foreground mt-1">
            Redeschideți-o, corectați-o și trimiteți-o din nou spre aprobare.
          </p>
        </div>
      ) : null}

      {aleFoii.map((a) => {
        const diferenta = a.diferenta ?? a.km_declarat - a.km_asteptat;
        const semn = diferenta < 0 ? "−" : "+";
        return (
          <Callout
            key={a.id}
            fel="atentie"
            titlu={`Anomalie de kilometraj: ${semn}${Math.abs(diferenta).toLocaleString("ro-RO")} km`}
          >
            Ultimul kilometraj cunoscut al vehiculului era {a.km_asteptat.toLocaleString("ro-RO")}{" "}
            km, iar foaia declară {a.km_declarat.toLocaleString("ro-RO")} km.
            {a.confirmat_la === null
              ? " Diferența nu blochează foaia; responsabilul de flotă o va verifica."
              : ` Explicată: ${a.nota ?? "fără notă"}.`}
          </Callout>
        );
      })}

      <section aria-label="Kilometraj și consum" className="border-border rounded-panou border p-4">
        <ListaDefinitii
          coloane={4}
          textNecompletat="Neînregistrat"
          definitii={[
            {
              eticheta: "Plecare",
              valoare:
                foaie.km_plecare === null ? null : `${foaie.km_plecare.toLocaleString("ro-RO")} km`,
            },
            {
              eticheta: "Sosire",
              valoare:
                foaie.km_sosire === null ? null : `${foaie.km_sosire.toLocaleString("ro-RO")} km`,
            },
            {
              eticheta: "Parcurs",
              valoare:
                foaie.km_parcursi === null
                  ? "cursă în desfășurare"
                  : `${foaie.km_parcursi.toLocaleString("ro-RO")} km`,
            },
            {
              eticheta: "Consum",
              valoare: consumReal === null ? null : formatConsum(consumReal),
            },
          ]}
        />
      </section>

      {foaie.traseu === null && foaie.scop === null && foaie.observatii === null ? null : (
        <section aria-label="Traseu, scop și observații" className="text-corp space-y-1">
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
          {foaie.observatii === null ? null : (
            <p>
              <span className="text-muted-foreground">Observații: </span>
              {foaie.observatii}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="alimentari" className="space-y-3">
        <h2 id="alimentari" className="text-sectiune font-semibold">
          Alimentări
        </h2>
        <Tabel
          caption="Alimentările înregistrate pe această cursă."
          coloane={coloaneAlimentari}
          randuri={alimentari}
          cheieRand={(a) => a.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio alimentare înregistrată pe această cursă.
            </p>
          }
          subsol={
            <tr>
              <td className="px-4 py-3" colSpan={2}>
                Total
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{litriTotali.toFixed(2)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatLei(costTotal)}</td>
            </tr>
          }
        />
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
