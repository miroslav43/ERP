// src/app/(app)/diurna/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatAmount, formatLei } from "@/lib/format/money";
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
  ETICHETE_MIJLOC_TRANSPORT,
  ETICHETE_STATUS_DEPLASARE,
  ETICHETE_TIP_CHELTUIALA,
  TONURI_STATUS_DEPLASARE,
} from "../etichete";
import { ActiuniCheltuiala } from "./actiuni-cheltuiala";
import { ActiuniDeplasare } from "./actiuni-deplasare";
import { Etape } from "./etape";
import { FormularCheltuiala } from "./formular-cheltuiala";
import { FormularEtapa } from "./formular-etapa";

export const metadata: Metadata = { title: "Fișa deplasării" };

/**
 * Cursul NU trece prin `formatAmount`: acela rotunjește la doi zecimali, iar
 * `curs_diurna` e `numeric(14,6)`. Un curs BNR de 4,9765 afișat „4,98” schimbă
 * suma în lei cu ~0,07% — invizibil pe o zi, vizibil pe un decont de mie.
 */
const formatorCurs = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaDeplasare({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "per_diem"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const deplasare = await citesteDeplasare(tenant.organizationId, id);
  if (deplasare === null) notFound();

  const arataAngajat = can(permisiuni, "per_diem:read", "team");

  /*
    `politicaLaData` și `angajatiDupaId` erau două valuri separate, după acest
    `Promise.all` — dar amândouă au nevoie doar de `deplasare`, care e deja
    citită. Singura dependență REALĂ e `baremeleTarilor`, care nu poate pleca
    până nu se știu țările implicate (din etape ȘI din politică).
  */
  const [etapeTrip, cheltuieliTrip, listaTari, politica, angajati] = await Promise.all([
    etapele(deplasare.id),
    cheltuielile(deplasare.id),
    tari(),
    politicaLaData(tenant.organizationId, deplasare.plecare_la.slice(0, 10)),
    arataAngajat
      ? angajatiDupaId(tenant.organizationId, [deplasare.employee_id])
      : new Map<string, never>(),
  ]);

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

  const angajat = angajati.get(deplasare.employee_id);

  const editabila = deplasare.status === "ciorna" || deplasare.status === "respinsa";
  const inchisa = deplasare.status === "decontata" || deplasare.status === "anulata";
  const poateScrie = can(permisiuni, "per_diem:update", "own");
  const poateTrimite = poateScrie && editabila;
  const poateCorecta = poateScrie && editabila;
  const poateSterge = can(permisiuni, "per_diem:delete", "own") && deplasare.status === "ciorna";
  const poateAproba = can(permisiuni, "per_diem:approve", "team");
  const poateDeconta = poateAproba && deplasare.status === "aprobata";
  const poateAdaugaEtapa = poateScrie && editabila;
  // Cheltuielile sosesc DUPĂ deplasare, deci nu se leagă de „editabilă”. Din
  // „decontată” și „anulată” însă nu se mai iese (trigger P0001): un rând
  // adăugat acolo n-ar mai putea fi nici aprobat, nici decontat.
  const poateAdaugaCheltuiala = poateScrie && !inchisa;
  /**
   * Decizia pe cheltuială cere ambele drepturi, nu doar `approve`: politica
   * `trip_expenses_update` are `per_diem:approve` în USING, dar `per_diem:update`
   * în WITH CHECK. Un `manager` (seed: `per_diem = team {read, approve}`, fără
   * `update`) trece de USING și cade pe WITH CHECK — zero rânduri, fără eroare.
   * Butonul nu se arată cui baza îl va refuza tăcut; explicația apare în locul lui.
   */
  const poateDecideCheltuiala = poateAproba && poateScrie;
  const aprobaDarNuPoateScrie = poateAproba && !poateScrie;

  const arataActiuniCheltuiala = poateDecideCheltuiala || (poateScrie && !inchisa);

  const coloaneCheltuieli: readonly Coloana<(typeof cheltuieliTrip)[number]>[] = [
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "titlu",
      celula: (c) => (
        <>
          <span>
            {ETICHETE_TIP_CHELTUIALA[c.tip]}
            {c.descriere === null ? "" : ` · ${c.descriere}`}
          </span>
          {/* Motivul respingerii era CITIT din bază (`cheltuielile`, în
              queries/per-diem.ts) și nu se randa nicăieri: angajatul vedea
              cuvântul „Respinsă” și niciun cuvânt despre de ce. */}
          {c.motiv_respingere === null ? null : (
            <span className="text-muted-foreground text-nota block">
              Motivul respingerii: {c.motiv_respingere}
            </span>
          )}
        </>
      ),
    },
    {
      cheie: "data",
      antet: "Data",
      peTelefon: "meta",
      celula: (c) => formatDate(c.data_cheltuielii),
    },
    {
      cheie: "suma",
      antet: "Sumă",
      numeric: true,
      peTelefon: "meta",
      // `numeric` sosește din PostgREST ca ȘIR: `String(c.suma)` dădea
      // „1200.5 EUR” lângă un `formatLei` în convenție românească, în același
      // tabel.
      celula: (c) => formatAmount(c.suma, c.moneda),
    },
    {
      cheie: "lei",
      antet: "Lei",
      numeric: true,
      peTelefon: "meta",
      celula: (c) => formatLei(c.suma_lei),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (c) =>
        c.aprobata ? (
          <Badge ton="succes">Aprobată</Badge>
        ) : c.motiv_respingere !== null ? (
          <Badge ton="pericol">Respinsă</Badge>
        ) : (
          <Badge ton="atentie">În așteptare</Badge>
        ),
    },
    ...(arataActiuniCheltuiala
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta" as const,
            peTelefon: "meta" as const,
            celula: (c: (typeof cheltuieliTrip)[number]) => (
              <ActiuniCheltuiala
                id={c.id}
                aprobata={c.aprobata}
                descriere={`${ETICHETE_TIP_CHELTUIALA[c.tip]}${c.descriere === null ? "" : ` · ${c.descriere}`}`}
                sumaLei={formatLei(c.suma_lei)}
                poateDecide={poateDecideCheltuiala}
                poateSterge={poateScrie && !inchisa}
              />
            ),
          },
        ]
      : []),
  ];

  // Aceleași cuvinte ca înainte, doar strânse într-un șir: `descriere` e text,
  // nu JSX. Ordinea și separatorii rămân identici.
  const descriereDeplasare = `${
    angajat === undefined ? "" : `${angajat.full_name ?? "—"} (${angajat.marca}) · `
  }${formatDateTime(new Date(deplasare.plecare_la))} – ${formatDateTime(
    new Date(deplasare.sosire_la),
  )}${deplasare.localitate === null ? "" : ` · ${deplasare.localitate}`}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/diurna" className="underline-offset-2 hover:underline">
            Deplasări
          </Link>
        </p>
        <AntetPagina
          titlu={deplasare.scop}
          descriere={descriereDeplasare}
          actiuni={
            <div className="flex flex-wrap items-center gap-2">
              <Badge ton={TONURI_STATUS_DEPLASARE[deplasare.status]}>
                {ETICHETE_STATUS_DEPLASARE[deplasare.status]}
              </Badge>
              {/* Punctul de intrare care lipsea: acțiunea de corectare există
                  acum în `actions.ts`, iar fără linkul ăsta ar fi rămas o
                  acțiune pe care niciun ecran n-o cheamă. */}
              {poateCorecta ? (
                <Link
                  href={`/diurna/${deplasare.id}/editeaza`}
                  className={buton({ varianta: "secundar" })}
                >
                  Corectează
                </Link>
              ) : null}
              <Link
                href={`/diurna/${deplasare.id}/decont`}
                className={buton({ varianta: "secundar" })}
              >
                Decontul
              </Link>
            </div>
          }
        />
      </div>

      <section aria-labelledby="titlu-rezumat" className="border-border rounded-panou border p-4">
        <h2 id="titlu-rezumat" className="text-sectiune mb-4 font-medium">
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
            valoare={
              deplasare.curs_diurna === null
                ? "—"
                : formatorCurs.format(Number(deplasare.curs_diurna))
            }
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
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Detașare transnațională
              </dt>
              <dd className="text-corp mt-0.5">
                Stat gazdă:{" "}
                {deplasare.stat_gazda_country_id === null
                  ? "—"
                  : (hartaTari.get(deplasare.stat_gazda_country_id)?.denumire ??
                    deplasare.stat_gazda_country_id)}
                {deplasare.salariu_minim_stat_gazda === null
                  ? ""
                  : ` · Salariu minim: ${formatAmount(
                      deplasare.salariu_minim_stat_gazda,
                      deplasare.moneda_salariu_minim ?? undefined,
                    )}`}
              </dd>
            </div>
          ) : null}
          {deplasare.observatii === null ? null : (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Observații
              </dt>
              <dd className="text-corp mt-0.5">{deplasare.observatii}</dd>
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
        <h2 id="titlu-traseu" className="text-sectiune font-medium">
          Traseu și calculul diurnei
        </h2>
        <Etape
          deplasare={deplasare}
          etape={etapeTrip}
          politica={politica}
          baremuri={baremuri}
          tari={hartaTari}
          poateSterge={poateAdaugaEtapa}
        />
        {poateAdaugaEtapa ? (
          <FormularEtapa tripId={deplasare.id} tari={listaTari} />
        ) : (
          /* Ramura asta randa un `<p>` GOL când deplasarea era editabilă dar
             cititorul n-avea drept de scriere: un paragraf care ocupa loc și
             nu spunea nimic. Cele două cauze sunt diferite și se scriu ca atare. */
          <p className="text-muted-foreground text-corp">
            {editabila
              ? "Nu aveți dreptul de a modifica traseul acestei deplasări."
              : "Traseul nu mai poate fi modificat — deplasarea a ieșit din starea editabilă."}
          </p>
        )}
      </section>

      <section aria-labelledby="titlu-cheltuieli" className="space-y-3">
        <h2 id="titlu-cheltuieli" className="text-sectiune font-medium">
          Cheltuieli
        </h2>
        <Tabel
          caption="Cheltuielile înregistrate pe deplasare, cu starea aprobării."
          coloane={coloaneCheltuieli}
          randuri={cheltuieliTrip}
          cheieRand={(c) => c.id}
          densitate="compact"
          gol={
            <p className="text-muted-foreground text-corp">Nicio cheltuială înregistrată încă.</p>
          }
        />
        {aprobaDarNuPoateScrie ? (
          <Callout fel="atentie" titlu="Nu puteți decide asupra cheltuielilor">
            Aprobarea unei cheltuieli cere, pe lângă dreptul de aprobare, și dreptul de modificare a
            deplasărilor — așa e scrisă politica din bază. Rugați un administrator al organizației
            să decidă, altfel decontul rămâne fără suma cheltuielilor.
          </Callout>
        ) : null}
        {poateAdaugaCheltuiala ? <FormularCheltuiala tripId={deplasare.id} /> : null}
        {!poateAdaugaCheltuiala && poateScrie ? (
          <p className="text-muted-foreground text-corp">
            Deplasarea e {ETICHETE_STATUS_DEPLASARE[deplasare.status].toLocaleLowerCase("ro-RO")} —
            nu se mai pot adăuga cheltuieli.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Camp({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-nota tracking-wide uppercase">{eticheta}</dt>
      <dd className="text-corp mt-0.5">{valoare}</dd>
    </div>
  );
}
