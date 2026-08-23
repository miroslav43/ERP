// src/app/(app)/flota/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteVehicul, documenteleVehiculului, tipuriDocument } from "@/lib/queries/fleet";

import {
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_VEHICUL,
  stareScadenta,
  TONURI_SCADENTA,
  TONURI_STATUS_VEHICUL,
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/flota" className="underline-offset-2 hover:underline">
            Parc auto
          </Link>
        </p>
        <AntetPagina
          titlu={vehicul.nr_inmatriculare}
          descriere={`${vehicul.marca} ${vehicul.model} · ${ETICHETE_CATEGORIE[vehicul.categorie]} · ${ETICHETE_COMBUSTIBIL[vehicul.tip_combustibil]}`}
          actiuni={
            <Badge ton={TONURI_STATUS_VEHICUL[vehicul.status]} className="shrink-0">
              {ETICHETE_STATUS_VEHICUL[vehicul.status]}
            </Badge>
          }
        />
      </div>

      <section
        aria-label="Date de identificare"
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2 lg:grid-cols-4"
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
          valoare={vehicul.valoare_achizitie === null ? "—" : formatLei(vehicul.valoare_achizitie)}
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
        <h2 id="documente" className="text-sectiune font-semibold">
          Documente
        </h2>
        <div className="border-border rounded-panou overflow-x-auto border">
          <table className="text-corp w-full">
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
            <tbody className="divide-border divide-y">
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
                        <span className="text-muted-foreground text-nota ml-1">(obligatoriu)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{doc?.numar ?? "—"}</td>
                    <td className="px-4 py-3">
                      {doc?.expira_la === undefined || doc.expira_la === null
                        ? "—"
                        : formatDate(doc.expira_la)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge ton={TONURI_SCADENTA[stare]} cuAvertisment={stare === "expirat"}>
                        {ETICHETE_SCADENTA[stare]}
                      </Badge>
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
          <p className="text-muted-foreground text-corp">
            Documentele se adaugă de către cei care administrează parcul auto.
          </p>
        )}
      </section>
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
