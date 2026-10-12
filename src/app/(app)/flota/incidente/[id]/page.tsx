import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { FileModul } from "@/components/ui/file-modul";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { FILE_FLOTA } from "@/config/file-module";
import {
  ETICHETE_STADIU_INCIDENT,
  ETICHETE_TIP_INCIDENT,
  NOTA_RECUPERARE,
  costNet,
  incidentInchis,
  textSugestie,
} from "@/domain/fleet/amenzi";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { angajatiDupaId, vehiculeDupaId } from "@/lib/queries/fleet";
import {
  cercetareSsmDupaId,
  cercetariSsm,
  citesteIncident,
  soferiPentruDesemnare,
  soferSugerat,
} from "@/lib/queries/flota-amenzi";
import { idDinRuta } from "@/lib/rute/parametri";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { TON_STADIU_INCIDENT } from "../../amenzi/etichete";
import { ButonStergeIncident, DialogStadiuIncident } from "../actiuni-incident";
import { DialogIncident } from "../dialog-incident";

export const metadata: Metadata = { title: "Incident" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Fișa unui incident (0206): faptele, costurile, legătura cu cercetarea SSM
 * (doar pentru cine o poate citi) și stadiul. Poarta e `vehicle_incidents:read
 * = all`. Un incident închis e înghețat: nu mai are butoane de scriere.
 */
export default async function PaginaIncident({ params }: ProprietatiPagina) {
  const { id: idBrut } = await params;
  const id = idDinRuta(idBrut);

  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  if (!can(permisiuni, "vehicle_incidents:read", "all")) {
    return (
      <AccesRestrictionat mesaj="Incidentele și daunele vehiculelor le văd cei care le administrează. Cereți administratorului organizației dreptul de a le consulta." />
    );
  }

  const incident = await citesteIncident(tenant.organizationId, id);
  if (incident === null) notFound();

  const poateScrie = can(permisiuni, "vehicle_incidents:update", "all");
  const inchis = incidentInchis(incident.stadiu);
  const poateModifica = poateScrie && !inchis;

  const [vehicule, soferi, optiuniSoferi, cercetari, cercetare, sugestie] = await Promise.all([
    vehiculeDupaId(tenant.organizationId, [incident.vehicle_id]),
    angajatiDupaId(tenant.organizationId, incident.sofer_id === null ? [] : [incident.sofer_id]),
    poateModifica ? soferiPentruDesemnare(tenant.organizationId) : Promise.resolve([]),
    // Selectorul de cercetări se citește prin RLS-ul SSM: cine n-are acces
    // primește listă goală, iar legătura existentă apare doar ca „indisponibilă”.
    poateModifica ? cercetariSsm(tenant.organizationId) : Promise.resolve([]),
    incident.work_accident_id === null
      ? Promise.resolve(null)
      : cercetareSsmDupaId(tenant.organizationId, incident.work_accident_id),
    poateModifica && incident.sofer_id === null
      ? soferSugerat(tenant.organizationId, incident.vehicle_id, incident.produs_la)
      : Promise.resolve(null),
  ]);

  const vehicul = vehicule.get(incident.vehicle_id);
  const sofer = incident.sofer_id === null ? null : (soferi.get(incident.sofer_id) ?? null);
  const net = costNet(incident.cost_final, incident.despagubire);
  const numeSugerat =
    sugestie === null
      ? null
      : (optiuniSoferi.find((s) => s.id === sugestie.employee_id)?.full_name ?? null);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu={`${ETICHETE_TIP_INCIDENT[incident.tip]} — ${vehicul?.nr_inmatriculare ?? "vehicul indisponibil"}`}
        descriere={`${incident.descriere} (${formatDateTime(incident.produs_la)})`}
        firimituri={[
          { eticheta: "Incidente și daune", href: "/flota/incidente" },
          { eticheta: ETICHETE_TIP_INCIDENT[incident.tip] },
        ]}
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
        {...(poateModifica
          ? {
              actiuni: (
                <DialogIncident
                  fel="corectura"
                  incident={incident}
                  soferi={optiuniSoferi}
                  cercetari={cercetari}
                  cercetareLegata={cercetare}
                  sugestieSoferId={sugestie?.employee_id ?? null}
                />
              ),
            }
          : {})}
      />

      {inchis ? (
        <Callout fel="informativ" titlu="Incident închis">
          <p>
            Dosarul s-a încheiat
            {incident.inchis_la === null ? "" : ` la ${formatDateTime(incident.inchis_la)}`} și nu
            se mai modifică.
          </p>
        </Callout>
      ) : null}

      <section aria-labelledby="titlu-date" className="space-y-3">
        <h2 id="titlu-date" className="text-sectiune font-semibold">
          Datele incidentului
        </h2>
        <ListaDefinitii
          textNecompletat="Necompletat"
          coloane={3}
          definitii={[
            {
              eticheta: "Stadiu",
              valoare: (
                <Badge ton={TON_STADIU_INCIDENT[incident.stadiu]}>
                  {ETICHETE_STADIU_INCIDENT[incident.stadiu]}
                </Badge>
              ),
            },
            {
              eticheta: "Vehicul",
              valoare:
                vehicul === undefined ? null : (
                  <Link
                    href={`/flota/${vehicul.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {vehicul.nr_inmatriculare}
                  </Link>
                ),
            },
            { eticheta: "Momentul", valoare: formatDateTime(incident.produs_la) },
            { eticheta: "Locul", valoare: incident.locul },
            {
              eticheta: "Șoferul de atunci",
              valoare:
                incident.sofer_id === null ? null : (sofer?.full_name ?? "Fișă indisponibilă"),
            },
            {
              eticheta: "Cercetarea SSM",
              valoare:
                incident.work_accident_id === null
                  ? null
                  : cercetare === null
                    ? "Legată, dar indisponibilă pentru contul dumneavoastră"
                    : `${cercetare.numar_intern ?? "fără număr"} — ${cercetare.data_producerii}, ${cercetare.locul}`,
            },
            {
              eticheta: "Cost estimat",
              valoare: incident.cost_estimat === null ? null : formatLei(incident.cost_estimat),
            },
            {
              eticheta: "Cost final",
              valoare: incident.cost_final === null ? null : formatLei(incident.cost_final),
            },
            {
              eticheta: "Despăgubire primită",
              valoare: incident.despagubire === null ? null : formatLei(incident.despagubire),
            },
            { eticheta: "Rămas firmei", valoare: net === null ? null : formatLei(net) },
            { eticheta: "Asigurătorul", valoare: incident.asigurator },
            { eticheta: "Dosar de daună", valoare: incident.dosar_numar, identificator: true },
            { eticheta: "Observații", valoare: incident.observatii, lat: true },
          ]}
        />
        {sugestie !== null ? (
          <p className="text-corp max-w-prose">
            Sugestie pentru șoferul de atunci:{" "}
            {textSugestie(sugestie.sursa, numeSugerat ?? "Un angajat al firmei")} Îl găsiți
            precompletat în „Corectează detaliile”.
          </p>
        ) : null}
      </section>

      {poateModifica ? (
        <section aria-labelledby="titlu-stadiu" className="space-y-3">
          <h2 id="titlu-stadiu" className="text-sectiune font-semibold">
            Evoluția dosarului
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <DialogStadiuIncident
              incidentId={incident.id}
              stadiu={incident.stadiu}
              asigurator={incident.asigurator}
              dosarNumar={incident.dosar_numar}
              despagubire={incident.despagubire}
            />
            {incident.stadiu === "raportat" ? (
              <ButonStergeIncident incidentId={incident.id} />
            ) : null}
          </div>
        </section>
      ) : null}

      <Callout fel="informativ" titlu="Recuperarea de la șofer">
        <p>{NOTA_RECUPERARE}</p>
      </Callout>
    </div>
  );
}
