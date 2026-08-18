// src/app/(app)/flota/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  citesteVehicul,
  documenteleVehiculului,
  tipuriDocument,
} from "@/lib/queries/fleet";

import {
  CLASE_SCADENTA,
  CLASE_STATUS_VEHICUL,
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_VEHICUL,
  stareScadenta,
} from "../etichete";
import { FormularDocument } from "./formular-document";

export const metadata: Metadata = { title: "Fișa vehiculului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaVehicul({ params }: ProprietatiPagina) {
  // Un segment care nu e UUID nu poate desemna niciun rând: 404, nu 22P02.
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "vehicles:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta parcul auto. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const vehicul = await citesteVehicul(tenant.organizationId, id);
  if (vehicul === null) notFound();

  const [documente, tipuri] = await Promise.all([
    documenteleVehiculului(vehicul.id),
    tipuriDocument(),
  ]);
  const azi = todayInBucharest();
  const poateScrie = can(permisiuni, "vehicles:create", "all");

  const curente = documente.filter((d) => d.este_curent);
  const dupaTip = new Map(curente.map((d) => [d.document_type_id, d]));

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/flota" className="underline-offset-2 hover:underline">
              Parc auto
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{vehicul.nr_inmatriculare}</h1>
          <p className="text-sm text-muted-foreground">
            {vehicul.marca} {vehicul.model} · {ETICHETE_CATEGORIE[vehicul.categorie]} ·{" "}
            {ETICHETE_COMBUSTIBIL[vehicul.tip_combustibil]}
          </p>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${CLASE_STATUS_VEHICUL[vehicul.status]}`}
        >
          {ETICHETE_STATUS_VEHICUL[vehicul.status]}
        </span>
      </header>

      <section
        aria-label="Date de identificare"
        className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Camp eticheta="Kilometraj" valoare={`${vehicul.km_curent.toLocaleString("ro-RO")} km`} />
        <Camp eticheta="VIN" valoare={vehicul.vin ?? "—"} />
        <Camp eticheta="An fabricație" valoare={vehicul.an_fabricatie?.toString() ?? "—"} />
        <Camp
          eticheta="Consum declarat"
          valoare={
            vehicul.consum_mediu_declarat === null
              ? "—"
              : `${vehicul.consum_mediu_declarat} l/100 km`
          }
        />
        <Camp
          eticheta="Data achiziției"
          valoare={vehicul.data_achizitie === null ? "—" : formatDate(vehicul.data_achizitie)}
        />
        <Camp
          eticheta="Valoare"
          valoare={
            vehicul.valoare_achizitie === null ? "—" : formatLei(vehicul.valoare_achizitie)
          }
        />
        <Camp eticheta="Culoare" valoare={vehicul.culoare ?? "—"} />
        <Camp
          eticheta="Prag salt kilometraj"
          valoare={
            vehicul.prag_salt_km === null
              ? "implicit"
              : `${vehicul.prag_salt_km.toLocaleString("ro-RO")} km`
          }
        />
      </section>

      <section aria-labelledby="documente" className="space-y-3">
        <h2 id="documente" className="text-lg font-semibold">
          Documente
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Tip
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Număr
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Expiră
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Stare
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Se listează TIPURILE, nu documentele: un tip obligatoriu fără
                  document trebuie să apară ca „Lipsește", roșu. Altfel absența
                  unui RCA arată identic cu absența unei rubrici. */}
              {tipuri.map((tip) => {
                const doc = dupaTip.get(tip.id);
                const stare = stareScadenta(doc?.expira_la ?? null, azi);
                if (doc === undefined && !tip.obligatoriu) return null;
                return (
                  <tr key={tip.id}>
                    <td className="px-4 py-3">
                      {tip.denumire}
                      {tip.obligatoriu ? (
                        <span className="ml-1 text-xs text-muted-foreground">(obligatoriu)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{doc?.numar ?? "—"}</td>
                    <td className="px-4 py-3">
                      {doc?.expira_la === undefined || doc.expira_la === null
                        ? "—"
                        : formatDate(doc.expira_la)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_SCADENTA[stare]}`}
                      >
                        {ETICHETE_SCADENTA[stare]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {poateScrie ? (
          <FormularDocument vehiculId={vehicul.id} tipuri={tipuri} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Documentele se adaugă de către cei care administrează parcul auto.
          </p>
        )}
      </section>
    </main>
  );
}

function Camp({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{eticheta}</dt>
      <dd className="text-sm font-medium">{valoare}</dd>
    </div>
  );
}
