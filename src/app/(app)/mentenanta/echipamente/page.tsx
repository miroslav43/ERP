// src/app/(app)/mentenanta/echipamente/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Download, QrCode, Wrench, WrenchIcon } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import {
  categoriiEchipamente,
  citesteEchipament,
  listeazaEchipamente,
  opririDeschise,
  optiuniAngajati,
  optiuniDepartamente,
  optiuniEchipamente,
} from "@/lib/queries/maintenance";
import { filtreEchipamenteSchema } from "@/schemas/maintenance";

import { ETICHETE_STATUS_ECHIPAMENT, TONURI_STATUS_ECHIPAMENT } from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { optiuniPuncteLucru } from "./actions";
import { DialogEchipamentNou } from "./dialog-echipament-nou";
import { FiltreEchipamenteForm } from "./filtre-echipamente";

export const metadata: Metadata = { title: "Echipamente" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Adresa fostei rute `/mentenanta/echipamente/nou`, acum caseta de pe listă. */
const ADRESA_ECHIPAMENT_NOU = "/mentenanta/echipamente?echipament=nou";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const CHEI_FILTRE = [
  "cauta",
  "status",
  "categorie",
  "punct_lucru",
  "iscir",
  "responsabil",
  "cursor",
] as const;

/** Parametrii curenți, ca șir de interogare — pentru export și pentru etichete. */
function sirParametri(parametri: Record<string, string | string[] | undefined>): string {
  const p = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
  }
  return p.toString();
}

async function TabelEchipamente({
  organizationId,
  parametri,
  poateAdauga,
  azi,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly poateAdauga: boolean;
  readonly azi: string;
}) {
  const filtre = filtreDinUrl(filtreEchipamenteSchema, parametri);
  const [{ randuri, urmatorulCursor, total, sortare }, opriri] = await Promise.all([
    listeazaEchipamente(organizationId, filtre),
    opririDeschise(organizationId),
  ]);

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams(sirParametri(parametri));
    schimba(p);
    return p.size === 0 ? "/mentenanta/echipamente" : `/mentenanta/echipamente?${p.toString()}`;
  }

  if (randuri.length === 0) {
    const areFiltre = CHEI_FILTRE.some((c) => c !== "cursor" && filtre[c] !== null);
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={
          areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun echipament înregistrat"
        }
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți tot parcul de echipamente."
            : "Adăugați primul echipament ca să puteți urmări mentenanța și autorizațiile ISCIR."
        }
        {...(areFiltre
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                href: adresa((p) => {
                  for (const c of CHEI_FILTRE) p.delete(c);
                }),
              },
            }
          : poateAdauga
            ? { actiune: { eticheta: "Adaugă echipament", href: ADRESA_ECHIPAMENT_NOU } }
            : {})}
      />
    );
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "cod",
      antet: "Cod",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (e) => <span className="font-medium">{e.cod}</span>,
    },
    {
      cheie: "denumire",
      antet: "Denumire",
      sortabil: true,
      peTelefon: "titlu",
      celula: (e) => e.denumire,
    },
    {
      cheie: "categorie",
      antet: "Categorie",
      peTelefon: "meta",
      celula: (e) => e.categorie ?? "—",
    },
    {
      cheie: "locatie",
      antet: "Locație",
      peTelefon: "meta",
      celula: (e) => e.locatie ?? "—",
    },
    {
      cheie: "iscir",
      antet: "ISCIR",
      latime: "ingusta",
      peTelefon: "ascuns",
      celula: (e) =>
        e.este_iscir ? (
          <WrenchIcon aria-label="Sub incidența ISCIR" className="text-foreground size-4" />
        ) : (
          "—"
        ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (e) => {
        const oprire = opriri.get(e.id);
        return (
          <span className="flex flex-wrap gap-1">
            <Badge ton={TONURI_STATUS_ECHIPAMENT[e.status]}>
              {ETICHETE_STATUS_ECHIPAMENT[e.status]}
            </Badge>
            {oprire !== undefined ? (
              <Badge ton="pericol" cuAvertisment>
                Oprit
              </Badge>
            ) : null}
            {e.garantie_expira !== null && e.garantie_expira >= azi ? (
              <Badge ton="neutru">Garanție până la {formatDate(e.garantie_expira)}</Badge>
            ) : null}
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Echipamentele organizației."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(e) => e.id}
        href={(e) => `/mentenanta/echipamente/${e.id}`}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul nu supraviețuiește unei schimbări de sortare: ar continua
            // de la un rând care, în noua ordine, nu mai e acolo unde era.
            p.delete("cursor");
          })
        }
        gol={null}
      />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa((p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </div>
  );
}

export default async function PaginaEchipamente({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta echipamentele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  // Aceeași validare ca a tabelului, refăcută aici fiindcă e pură: bara de
  // filtre are nevoie de valorile CURENTE ca să-și scrie pastilele, iar din
  // parametrii bruți ar putea scrie o pastilă cu o valoare inventată din URL.
  const filtre = filtreDinUrl(filtreEchipamenteSchema, parametri);
  const poateAdauga = can(permisiuni, "maintenance:update", "team");
  const poateExporta = can(permisiuni, "maintenance:export", "team");
  const poateSetari = can(permisiuni, "maintenance:update", "all");

  // Ținute în afara lui `filtreEchipamenteSchema`: nu sunt filtre ale listei, ci
  // adresa fostei rute `/mentenanta/echipamente/nou` (`?echipament=nou`) și
  // fișa după care se copiază câmpurile („Adaugă unul la fel", `?model=<id>`).
  const deschideCaseta = parametri["echipament"] === "nou";
  const modelBrut = typeof parametri["model"] === "string" ? parametri["model"] : null;
  const modelId = modelBrut !== null && UUID.test(modelBrut) ? modelBrut : null;

  // Selectoarele barei de filtre (toți cititorii) și ale casetei (cine adaugă).
  // Punctele de lucru vin prin acțiune cu client admin: politica lor cere
  // `departments:read`, pe care un responsabil de mentenanță poate să nu-l aibă.
  const [categorii, angajati, puncteRezultat] = await Promise.all([
    categoriiEchipamente(tenant.organizationId),
    optiuniAngajati(tenant.organizationId),
    poateAdauga ? optiuniPuncteLucru({}) : Promise.resolve(null),
  ]);
  const puncteLucru = puncteRezultat !== null && puncteRezultat.ok ? puncteRezultat.data : [];

  const [departamente, features, model, parinti] = poateAdauga
    ? await Promise.all([
        optiuniDepartamente(tenant.organizationId),
        getEnabledFeatures(tenant.organizationId),
        modelId === null
          ? Promise.resolve(null)
          : citesteEchipament(tenant.organizationId, modelId),
        optiuniEchipamente(tenant.organizationId),
      ])
    : [[], new Set<string>(), null, []];

  const interogare = sirParametri(parametri);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Echipamente"
        descriere="Parcul de echipamente al organizației, cu starea, garanția și acoperirea ISCIR."
        {...(poateAdauga
          ? {
              actiuni: (
                /*
                  `key` legat de parametri, nu de conținut: o navigare spre
                  `?echipament=nou` rămâne pe ACEEAȘI rută, deci React n-ar remonta
                  componenta și `deschisInitial` n-ar mai fi citit a doua oară.
                */
                <DialogEchipamentNou
                  key={deschideCaseta ? `echipament-nou:${modelId ?? ""}` : "lista"}
                  deschisInitial={deschideCaseta}
                  angajati={angajati}
                  departamente={departamente}
                  puncteLucru={puncteLucru}
                  parinti={parinti}
                  categorii={categorii}
                  ssmActiv={features.has("ssm")}
                  poateDerogare={can(permisiuni, "maintenance:update", "all")}
                  {...(model === null ? {} : { model })}
                />
              ),
            }
          : {})}
        file={<NavMentenanta poateSetari={poateSetari} />}
      />

      <FiltreEchipamenteForm
        filtre={filtre}
        categorii={categorii}
        puncteLucru={puncteLucru}
        responsabili={angajati}
      />

      {/* Exportul și etichetele lucrează pe LISTA FILTRATĂ: aceleași chei de URL. */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/mentenanta/echipamente/etichete${interogare === "" ? "" : `?${interogare}`}`}
          className={buton({ varianta: "tertiar" })}
        >
          <QrCode aria-hidden="true" className="size-4" />
          Tipărește etichetele QR
        </Link>
        {poateExporta ? (
          <a
            href={`/api/export/mentenanta/echipamente${interogare === "" ? "" : `?${interogare}`}`}
            className={buton({ varianta: "tertiar" })}
          >
            <Download aria-hidden="true" className="size-4" />
            Export CSV
          </a>
        ) : null}
      </div>

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelEchipamente
          organizationId={tenant.organizationId}
          parametri={parametri}
          poateAdauga={poateAdauga}
          azi={todayInBucharest()}
        />
      </Suspense>
    </div>
  );
}
