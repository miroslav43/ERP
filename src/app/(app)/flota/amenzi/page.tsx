import { FileX2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { FileModul } from "@/components/ui/file-modul";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_FLOTA } from "@/config/file-module";
import {
  ETICHETE_STADIU_AMENDA,
  NOTA_RECUPERARE,
  STADII_AMENDA,
  verdictTermen,
} from "@/domain/fleet/amenzi";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { angajatiDupaId, vehiculeDupaId } from "@/lib/queries/fleet";
import {
  filtruStadiuAmendaDinParametru,
  listeazaAmenzi,
  rezumatAmenzi,
  vehiculePentruAmenzi,
  type RandAmenda,
} from "@/lib/queries/flota-amenzi";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { DialogAmenda } from "./dialog-amenda";
import { TON_STADIU_AMENDA } from "./etichete";

export const metadata: Metadata = { title: "Amenzi" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE = [25, 50, 100] as const;

function text(valoare: string | string[] | undefined): string | undefined {
  return typeof valoare === "string" ? valoare : undefined;
}

/**
 * Amenzile primite pe vehiculele firmei (0203, F11): cele mai noi întâi (după
 * momentul faptei), cu termenul numărat în zile și stadiul fiecăreia; filtrul
 * „De răspuns” le izolează pe cele al căror răspuns n-a plecat încă.
 *
 * Poarta e `vehicle_fines:read = all`, EXACT poarta politicii
 * `vehicle_fines_select`. Cheia e seedată doar pentru `org_admin` și
 * `super_admin`: decizia 3 a planului (HR doar permisele șoferilor) rămâne în
 * picioare, iar o firmă poate acorda cheia lui HR printr-o suprascriere.
 */
export default async function PaginaAmenzi({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni, parametri] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    searchParams,
  ]);

  if (!can(permisiuni, "vehicle_fines:read", "all")) {
    return (
      <AccesRestrictionat mesaj="Amenzile primite pe vehicule le văd cei care le administrează. Cereți administratorului organizației dreptul de a le consulta." />
    );
  }

  const poateCrea = can(permisiuni, "vehicle_fines:create", "all");
  const azi = todayInBucharest();
  const stadiu = filtruStadiuAmendaDinParametru(text(parametri["stadiu"]));
  const vehiculParam = text(parametri["vehicul"]);
  const vehicul = vehiculParam !== undefined && TIPAR_UUID.test(vehiculParam) ? vehiculParam : null;
  const limitaCeruta = Number(text(parametri["limita"]));
  const limita = LIMITE.find((l) => l === limitaCeruta) ?? LIMITE[0];
  const cursor = text(parametri["cursor"]) ?? null;

  const [lista, rezumat, optiuniVehicule] = await Promise.all([
    listeazaAmenzi(tenant.organizationId, { stadiu, vehicul, cursor, limita }),
    rezumatAmenzi(tenant.organizationId, azi),
    poateCrea ? vehiculePentruAmenzi(tenant.organizationId) : Promise.resolve([]),
  ]);
  const { randuri } = lista;

  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    if (stadiu !== null) p.set("stadiu", stadiu);
    if (vehicul !== null) p.set("vehicul", vehicul);
    if (limita !== LIMITE[0]) p.set("limita", String(limita));
    schimba(p);
    return p.size === 0 ? "/flota/amenzi" : `/flota/amenzi?${p.toString()}`;
  }

  // Numele șoferului și numărul vehiculului se citesc SEPARAT, nu prin embed: un
  // embed refuzat de RLS vine NULL fără nicio eroare.
  const [vehicule, soferi] = await Promise.all([
    vehiculeDupaId(
      tenant.organizationId,
      randuri.map((a) => a.vehicle_id),
    ),
    angajatiDupaId(
      tenant.organizationId,
      randuri.map((a) => a.sofer_desemnat_id).filter((id): id is string => id !== null),
    ),
  ]);

  const coloane: readonly Coloana<RandAmenda>[] = [
    {
      cheie: "fapta",
      antet: "Proces-verbal",
      peTelefon: "titlu",
      celula: (a) => (
        <>
          <span className="font-medium">{a.numar_pv}</span>
          <span className="text-muted-foreground text-nota block">{a.fapta}</span>
        </>
      ),
    },
    {
      cheie: "vehicul",
      antet: "Vehicul",
      peTelefon: "meta",
      celula: (a) => vehicule.get(a.vehicle_id)?.nr_inmatriculare ?? "—",
    },
    {
      cheie: "momentul",
      antet: "Fapta",
      peTelefon: "meta",
      celula: (a) => formatDateTime(a.constatata_la),
    },
    {
      cheie: "termen",
      antet: "Termen de răspuns",
      peTelefon: "meta",
      celula: (a) => {
        const v = verdictTermen(a.termen_raspuns, a.stadiu, azi, a.raspuns_trimis_la);
        if (v.stare === "nu_se_aplica") return "—";
        return (
          <>
            {a.termen_raspuns === null ? null : formatDate(a.termen_raspuns)}
            <span
              className={
                v.ton === "pericol"
                  ? "text-danger text-nota block font-medium"
                  : "text-muted-foreground text-nota block"
              }
            >
              {v.eticheta}
            </span>
          </>
        );
      },
    },
    {
      cheie: "sofer",
      antet: "Șofer desemnat",
      peTelefon: "meta",
      celula: (a) =>
        a.sofer_desemnat_id === null
          ? "—"
          : (soferi.get(a.sofer_desemnat_id)?.full_name ?? "Fișă indisponibilă"),
    },
    {
      cheie: "stadiu",
      antet: "Stadiu",
      peTelefon: "insigna",
      celula: (a) => (
        <Badge ton={TON_STADIU_AMENDA[a.stadiu]}>{ETICHETE_STADIU_AMENDA[a.stadiu]}</Badge>
      ),
    },
  ];

  const filtre: readonly Readonly<{ eticheta: string; valoare: string | null }>[] = [
    { eticheta: "Toate", valoare: null },
    { eticheta: "De răspuns", valoare: "de_raspuns" },
    ...STADII_AMENDA.map((s) => ({ eticheta: ETICHETE_STADIU_AMENDA[s], valoare: s })),
  ];

  const areFiltre = stadiu !== null || vehicul !== null;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Amenzi"
        descriere="Amenzile primite pe vehiculele firmei: termenul de răspuns către autoritate, șoferul desemnat și stadiul fiecăreia."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
        {...(poateCrea
          ? {
              actiuni: (
                <DialogAmenda
                  key={text(parametri["amenda"]) ?? "inchisa"}
                  fel="noua"
                  azi={azi}
                  vehicule={optiuniVehicule}
                  vehiculImplicit={vehicul}
                  deschisInitial={text(parametri["amenda"]) === "noua"}
                />
              ),
            }
          : {})}
      />

      {rezumat.cuTermenDepasit > 0 ? (
        <Callout
          fel="atentie"
          titlu={
            rezumat.cuTermenDepasit === 1
              ? "O amendă cu termenul de răspuns depășit"
              : `${String(rezumat.cuTermenDepasit)} amenzi cu termenul de răspuns depășit`
          }
        >
          <p>
            Necomunicarea la timp a datelor șoferului către autoritate e contravenție (OUG 195/2002
            art. 105 pct. 10 pentru persoanele juridice). Desemnați șoferul și trimiteți răspunsul.
          </p>
        </Callout>
      ) : null}

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
            {f.valoare === "de_raspuns" ? ` (${String(rezumat.deRaspuns)})` : ""}
          </Link>
        ))}
      </nav>

      {randuri.length === 0 ? (
        <StareGoala
          fel={areFiltre ? "filtrata" : "initiala"}
          pictograma={FileX2}
          titlu={areFiltre ? "Nicio amendă pentru filtrele alese" : "Nicio amendă înregistrată"}
          descriere={
            areFiltre
              ? "Alegeți alt stadiu sau ștergeți filtrele ca să vedeți toate amenzile."
              : "Când firma primește un proces-verbal sau o solicitare de identificare a șoferului, înregistrați-o aici ca să nu se piardă termenul de răspuns."
          }
          {...(areFiltre
            ? { actiune: { eticheta: "Șterge filtrele", href: "/flota/amenzi" } }
            : poateCrea
              ? {
                  actiune: {
                    eticheta: "Înregistrează prima amendă",
                    href: "/flota/amenzi?amenda=noua",
                  },
                }
              : {})}
        />
      ) : (
        <>
          <Tabel
            caption="Amenzile primite pe vehiculele firmei, cu termenul de răspuns, șoferul desemnat și stadiul."
            coloane={coloane}
            randuri={randuri}
            cheieRand={(a) => a.id}
            href={(a) => `/flota/amenzi/${a.id}`}
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
