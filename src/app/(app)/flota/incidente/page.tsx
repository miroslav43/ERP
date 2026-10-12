import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { FileModul } from "@/components/ui/file-modul";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_FLOTA } from "@/config/file-module";
import {
  ETICHETE_STADIU_INCIDENT,
  ETICHETE_TIP_INCIDENT,
  NOTA_RECUPERARE,
  STADII_INCIDENT,
  costNet,
} from "@/domain/fleet/amenzi";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { angajatiDupaId, vehiculeDupaId } from "@/lib/queries/fleet";
import {
  filtruStadiuIncidentDinParametru,
  listeazaIncidente,
  soferiPentruDesemnare,
  vehiculePentruAmenzi,
  type RandIncident,
} from "@/lib/queries/flota-amenzi";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { TON_STADIU_INCIDENT } from "../amenzi/etichete";
import { DialogIncident } from "./dialog-incident";

export const metadata: Metadata = { title: "Incidente și daune" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE = [25, 50, 100] as const;

function text(valoare: string | string[] | undefined): string | undefined {
  return typeof valoare === "string" ? valoare : undefined;
}

/**
 * Incidentele și dauna vehiculelor (0206, F11): stadiile, costul și
 * despăgubirea. Poarta e `vehicle_incidents:read = all`, EXACT poarta politicii
 * `vehicle_incidents_select` (seedată doar pentru `org_admin`).
 */
export default async function PaginaIncidente({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni, parametri] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    searchParams,
  ]);

  if (!can(permisiuni, "vehicle_incidents:read", "all")) {
    return (
      <AccesRestrictionat mesaj="Incidentele și daunele vehiculelor le văd cei care le administrează. Cereți administratorului organizației dreptul de a le consulta." />
    );
  }

  const poateCrea = can(permisiuni, "vehicle_incidents:create", "all");
  const stadiu = filtruStadiuIncidentDinParametru(text(parametri["stadiu"]));
  const vehiculParam = text(parametri["vehicul"]);
  const vehicul = vehiculParam !== undefined && TIPAR_UUID.test(vehiculParam) ? vehiculParam : null;
  const limitaCeruta = Number(text(parametri["limita"]));
  const limita = LIMITE.find((l) => l === limitaCeruta) ?? LIMITE[0];
  const cursor = text(parametri["cursor"]) ?? null;

  const [lista, optiuniVehicule, optiuniSoferi] = await Promise.all([
    listeazaIncidente(tenant.organizationId, { stadiu, vehicul, cursor, limita }),
    poateCrea ? vehiculePentruAmenzi(tenant.organizationId) : Promise.resolve([]),
    poateCrea ? soferiPentruDesemnare(tenant.organizationId) : Promise.resolve([]),
  ]);
  const { randuri } = lista;

  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    if (stadiu !== null) p.set("stadiu", stadiu);
    if (vehicul !== null) p.set("vehicul", vehicul);
    if (limita !== LIMITE[0]) p.set("limita", String(limita));
    schimba(p);
    return p.size === 0 ? "/flota/incidente" : `/flota/incidente?${p.toString()}`;
  }

  const [vehicule, soferi] = await Promise.all([
    vehiculeDupaId(
      tenant.organizationId,
      randuri.map((i) => i.vehicle_id),
    ),
    angajatiDupaId(
      tenant.organizationId,
      randuri.map((i) => i.sofer_id).filter((id): id is string => id !== null),
    ),
  ]);

  const coloane: readonly Coloana<RandIncident>[] = [
    {
      cheie: "incident",
      antet: "Incident",
      peTelefon: "titlu",
      celula: (i) => (
        <>
          <span className="font-medium">{ETICHETE_TIP_INCIDENT[i.tip]}</span>
          <span className="text-muted-foreground text-nota block">{i.descriere}</span>
        </>
      ),
    },
    {
      cheie: "vehicul",
      antet: "Vehicul",
      peTelefon: "meta",
      celula: (i) => vehicule.get(i.vehicle_id)?.nr_inmatriculare ?? "—",
    },
    {
      cheie: "momentul",
      antet: "Când",
      peTelefon: "meta",
      celula: (i) => formatDateTime(i.produs_la),
    },
    {
      cheie: "sofer",
      antet: "Șofer",
      peTelefon: "ascuns",
      celula: (i) =>
        i.sofer_id === null ? "—" : (soferi.get(i.sofer_id)?.full_name ?? "Fișă indisponibilă"),
    },
    {
      cheie: "cost",
      antet: "Cost",
      numeric: true,
      peTelefon: "meta",
      celula: (i) => {
        const final = i.cost_final;
        if (final !== null) return formatLei(final);
        return i.cost_estimat === null ? "—" : `~ ${formatLei(i.cost_estimat)}`;
      },
    },
    {
      cheie: "net",
      antet: "Rămas firmei",
      numeric: true,
      peTelefon: "ascuns",
      celula: (i) => {
        const net = costNet(i.cost_final, i.despagubire);
        return net === null ? "—" : formatLei(net);
      },
    },
    {
      cheie: "stadiu",
      antet: "Stadiu",
      peTelefon: "insigna",
      celula: (i) => (
        <Badge ton={TON_STADIU_INCIDENT[i.stadiu]}>{ETICHETE_STADIU_INCIDENT[i.stadiu]}</Badge>
      ),
    },
  ];

  const filtre: readonly Readonly<{ eticheta: string; valoare: string | null }>[] = [
    { eticheta: "Toate", valoare: null },
    { eticheta: "Deschise", valoare: "deschise" },
    ...STADII_INCIDENT.map((s) => ({ eticheta: ETICHETE_STADIU_INCIDENT[s], valoare: s })),
  ];
  const areFiltre = stadiu !== null || vehicul !== null;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Incidente și daune"
        descriere="Accidente, avarii, furturi și vandalism: stadiul fiecărui dosar de daună, costul și despăgubirea primită."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
        {...(poateCrea
          ? {
              actiuni: (
                <DialogIncident
                  key={text(parametri["incident"]) ?? "inchis"}
                  fel="nou"
                  vehicule={optiuniVehicule}
                  vehiculImplicit={vehicul}
                  soferi={optiuniSoferi}
                  deschisInitial={text(parametri["incident"]) === "nou"}
                />
              ),
            }
          : {})}
      />

      <nav aria-label="Filtrează după stadiu" className="flex flex-wrap items-center gap-2">
        {filtre.map((f) => (
          <Link
            key={f.valoare ?? "toate"}
            href={adresa((p) => {
              if (f.valoare === null) p.delete("stadiu");
              else p.set("stadiu", f.valoare);
              p.delete("cursor");
            })}
            aria-current={f.valoare === stadiu ? "page" : undefined}
            className={buton({ varianta: f.valoare === stadiu ? "primar" : "secundar" })}
          >
            {f.eticheta}
          </Link>
        ))}
      </nav>

      {randuri.length === 0 ? (
        <StareGoala
          fel={areFiltre ? "filtrata" : "initiala"}
          pictograma={TriangleAlert}
          titlu={
            areFiltre ? "Niciun incident pentru filtrele alese" : "Niciun incident înregistrat"
          }
          descriere={
            areFiltre
              ? "Alegeți alt stadiu sau ștergeți filtrele ca să vedeți toate incidentele."
              : "Raportați aici accidentele, avariile și furturile, ca dosarul de daună să nu se piardă între asigurător și service."
          }
          {...(areFiltre
            ? { actiune: { eticheta: "Șterge filtrele", href: "/flota/incidente" } }
            : poateCrea
              ? {
                  actiune: {
                    eticheta: "Raportează primul incident",
                    href: "/flota/incidente?incident=nou",
                  },
                }
              : {})}
        />
      ) : (
        <>
          <Tabel
            caption="Incidentele vehiculelor, cu stadiul, costul și costul rămas firmei după despăgubire."
            coloane={coloane}
            randuri={randuri}
            cheieRand={(i) => i.id}
            href={(i) => `/flota/incidente/${i.id}`}
            gol={null}
          />
          <Paginare
            afisate={randuri.length}
            total={lista.total}
            cursorUrmator={lista.urmatorulCursor}
            limita={limita}
            construiesteHref={({ cursor: c, limita: l }) =>
              adresa((p) => {
                p.set("limita", String(l));
                if (c === null) p.delete("cursor");
                else p.set("cursor", c);
              })
            }
          />
        </>
      )}

      <p className="text-muted-foreground text-nota max-w-prose">{NOTA_RECUPERARE}</p>
    </div>
  );
}
