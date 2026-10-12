// src/app/(app)/mentenanta/echipamente/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { QrCode } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature, getEnabledFeatures } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiAutorizati,
  angajatiDupaId,
  atasamente,
  autorizatiiIscir,
  categoriiEchipamente,
  citesteEchipament,
  contoareEchipament,
  copiiEchipament,
  echipamenteDupaId,
  interventii,
  opririEchipament,
  optiuniAngajati,
  optiuniDepartamente,
  numelePunctuluiDeLucru,
  optiuniEchipamente,
  planuriEchipament,
  sesizari,
  urlSemnate,
} from "@/lib/queries/maintenance";
import {
  stareScadentaData,
  stareScadentaPlan,
  TREPTE_MENTENANTA,
} from "@/domain/maintenance/scadente";
import { Scadenta } from "@/components/ui/scadenta";

import { formatDurataMinute, minuteIntre } from "../../durata";
import {
  ETICHETE_MARCAJ_CE,
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_STARE_SCADENTA,
  ETICHETE_STATUS_ECHIPAMENT,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_TIP_CONTOR,
  ETICHETE_TIP_MENTENANTA,
  ETICHETE_TIP_OPRIRE,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_REZULTAT_INTERVENTIE,
  TONURI_STATUS_ECHIPAMENT,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
  formatContor,
  formatPeriodicitate,
} from "../../etichete";
import { optiuniPuncteLucru } from "../actions";
import { ActiuniCitire } from "./actiuni-citire";
import { ButonEditeazaEchipament } from "./buton-editeaza-echipament";
import { ButonSchimbaStarea } from "./buton-schimba-starea";
import { ButonStergeEchipament } from "./buton-sterge-echipament";
import { DocumenteEchipament } from "./documente-echipament";
import { FormularContor } from "./formular-contor";
import { FormularInterventie } from "./formular-interventie";
import { FormularIscir } from "./formular-iscir";
import { FormularPlan } from "./formular-plan";
import { IncarcareDocument } from "./incarcare-document";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisaDinHarta } from "@/lib/navigare/fisa";
import { poateDeschide } from "@/config/porti-ruta";
import { IstoricModificari } from "@/components/audit/istoric-modificari";

export const metadata: Metadata = { title: "Fișa echipamentului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaEchipament({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

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

  const echipament = await citesteEchipament(tenant.organizationId, id);
  if (echipament === null) notFound();

  const azi = todayInBucharest();
  const acum = new Date().toISOString();
  const poateScrie = can(permisiuni, "maintenance:update", "team");
  const poateSterge = can(permisiuni, "maintenance:delete", "all");

  const [
    contoare,
    planuri,
    interventiiEchipament,
    sesizariEchipament,
    autorizatii,
    features,
    componente,
    documente,
    opriri,
    parinte,
  ] = await Promise.all([
    contoareEchipament(tenant.organizationId, echipament.id),
    planuriEchipament(tenant.organizationId, echipament.id),
    interventii(tenant.organizationId, {
      tip: null,
      rezultat: null,
      echipament: echipament.id,
      plan: null,
      cursor: null,
      limita: 50,
    }),
    sesizari(tenant.organizationId, {
      status: null,
      urgenta: null,
      echipament: echipament.id,
      atribuit: null,
      deschise: null,
      cursor: null,
      limita: 50,
    }),
    autorizatiiIscir(tenant.organizationId, echipament.id),
    getEnabledFeatures(tenant.organizationId),
    copiiEchipament(tenant.organizationId, echipament.id),
    atasamente(tenant.organizationId, "equipment", echipament.id),
    opririEchipament(tenant.organizationId, echipament.id, 20),
    echipament.parent_equipment_id === null
      ? Promise.resolve(new Map())
      : echipamenteDupaId(tenant.organizationId, [echipament.parent_equipment_id]),
  ]);

  // Selectoarele formularelor: funcții de citire cu limită explicită, nu
  // interogări inline — o listă tăiată tăcut la 1000 arată exact ca una întreagă.
  const [angajatiGenerali, departamente, categorii, parinti, puncteRezultat, urluri, numePunct] =
    await Promise.all([
      optiuniAngajati(tenant.organizationId),
      optiuniDepartamente(tenant.organizationId),
      categoriiEchipamente(tenant.organizationId),
      poateScrie ? optiuniEchipamente(tenant.organizationId, echipament.id) : Promise.resolve([]),
      poateScrie ? optiuniPuncteLucru({}) : Promise.resolve(null),
      urlSemnate(documente),
      // Numele punctului pentru cititorii fără drept de scriere: lista de
      // opțiuni cere `maintenance:update`, deci managerul vedea „Setat".
      echipament.punct_lucru_id !== null && !poateScrie
        ? numelePunctuluiDeLucru(tenant.organizationId, echipament.punct_lucru_id)
        : Promise.resolve(null),
    ]);
  const puncteLucru = puncteRezultat !== null && puncteRezultat.ok ? puncteRezultat.data : [];
  const departament =
    echipament.department_id === null
      ? null
      : (departamente.find((d) => d.id === echipament.department_id) ?? null);
  const punctLucru =
    echipament.punct_lucru_id === null
      ? null
      : (puncteLucru.find((p) => p.id === echipament.punct_lucru_id) ??
        (numePunct === null ? null : { id: echipament.punct_lucru_id, nume: numePunct }));
  const randParinte =
    echipament.parent_equipment_id === null ? null : parinte.get(echipament.parent_equipment_id);

  // Pentru echipamentele ISCIR cu tip de autorizare cunoscut, selectorul de
  // responsabil se alimentează cu angajații EFECTIV autorizați — nu lista
  // generală — ca să nu se poată alege, din interfață, cineva pe care garda
  // `equipment_iscir_guard` îl va respinge oricum.
  let angajatiPentruResponsabil = angajatiGenerali;
  if (echipament.este_iscir && features.has("ssm") && echipament.tip_autorizare_necesara !== null) {
    const autorizati = await angajatiAutorizati(
      tenant.organizationId,
      echipament.tip_autorizare_necesara,
    );
    const idAutorizati = [...new Set(autorizati.map((a) => a.employee_id))];
    const numeAutorizati = await angajatiDupaId(tenant.organizationId, idAutorizati);
    angajatiPentruResponsabil = idAutorizati.map((idAngajat) => ({
      id: idAngajat,
      nume: numeAutorizati.get(idAngajat)?.full_name ?? idAngajat,
    }));
  }

  const idAngajatiNecesari = [
    echipament.responsabil_employee_id,
    ...planuri.map((p) => p.responsabil_employee_id),
    ...interventiiEchipament.randuri.map((i) => i.executant_employee_id),
    ...contoare.map((c) => c.citit_de_employee_id),
    ...sesizariEchipament.randuri.map((s) => s.raportat_de_employee_id),
  ].filter((v): v is string => v !== null);
  const numeAngajati = await angajatiDupaId(tenant.organizationId, idAngajatiNecesari);
  const numeleAngajatului = (idAngajat: string | null) =>
    idAngajat === null ? "—" : (numeAngajati.get(idAngajat)?.full_name ?? "—");
  // Numele legat de fișă, doar când rândul a venit prin RLS și fișa se deschide.
  const angajatLegat = (idAngajat: string | null) => (
    <LinkEntitate href={hrefFisaDinHarta(idAngajat, numeAngajati, permisiuni)}>
      {numeleAngajatului(idAngajat)}
    </LinkEntitate>
  );

  // Ultima citire cunoscută pe fiecare tip de contor — pentru semaforul
  // planurilor cu periodicitate pe contor. `contoare` e deja ordonat descrescător.
  const ultimaCitirePeTip = new Map<string, number>();
  for (const citire of contoare) {
    if (!ultimaCitirePeTip.has(citire.tip)) ultimaCitirePeTip.set(citire.tip, citire.citire);
  }

  const planuriActive = planuri.filter((p) => p.activ);
  const oprireDeschisa = opriri.find((o) => o.sfarsit === null) ?? null;
  const inGarantie = echipament.garantie_expira !== null && echipament.garantie_expira >= azi;
  const casat = echipament.status === "casat";

  const coloaneContoare: readonly Coloana<(typeof contoare)[number]>[] = [
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "titlu",
      celula: (citire) => (
        <>
          {ETICHETE_TIP_CONTOR[citire.tip]}
          {citire.resetare_contor ? (
            <span className="text-foreground text-nota ml-1">(resetare)</span>
          ) : null}
        </>
      ),
    },
    {
      cheie: "citire",
      antet: "Citire",
      numeric: true,
      peTelefon: "meta",
      celula: (citire) => formatContor(citire.citire, citire.tip),
    },
    {
      cheie: "data",
      antet: "Data",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (citire) => formatDate(citire.data_citirii),
    },
    {
      cheie: "citit_de",
      antet: "Citit de",
      peTelefon: "meta",
      celula: (citire) => angajatLegat(citire.citit_de_employee_id),
    },
    {
      cheie: "observatii",
      antet: "Observații",
      peTelefon: "meta",
      celula: (citire) => citire.observatii ?? "—",
    },
    ...(poateScrie && !casat
      ? [
          {
            cheie: "actiuni",
            antet: "",
            latime: "ingusta",
            peTelefon: "actiuni",
            celula: (citire) => <ActiuniCitire citire={citire} />,
          } satisfies Coloana<(typeof contoare)[number]>,
        ]
      : []),
  ];

  const coloaneInterventii: readonly Coloana<(typeof interventiiEchipament.randuri)[number]>[] = [
    {
      cheie: "data",
      antet: "Data",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (interventie) => formatDate(interventie.data),
    },
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "meta",
      celula: (interventie) => ETICHETE_TIP_MENTENANTA[interventie.tip],
    },
    {
      cheie: "descriere",
      antet: "Descriere",
      peTelefon: "titlu",
      celula: (interventie) => interventie.descriere,
    },
    {
      cheie: "executant",
      antet: "Executant",
      peTelefon: "meta",
      celula: (interventie) =>
        interventie.executant_extern ?? angajatLegat(interventie.executant_employee_id),
    },
    {
      cheie: "cost",
      antet: "Cost total",
      numeric: true,
      peTelefon: "meta",
      celula: (interventie) =>
        formatLei(interventie.cost_total ?? interventie.cost_piese + interventie.cost_manopera),
    },
    {
      cheie: "rezultat",
      antet: "Rezultat",
      peTelefon: "insigna",
      celula: (interventie) => (
        <Badge ton={TONURI_REZULTAT_INTERVENTIE[interventie.rezultat]}>
          {ETICHETE_REZULTAT_INTERVENTIE[interventie.rezultat]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-muted-foreground text-corp">
          <Link href="/mentenanta/echipamente" className="underline-offset-2 hover:underline">
            Echipamente
          </Link>
          {randParinte === null || randParinte === undefined ? null : (
            <>
              {" / "}
              <Link
                href={`/mentenanta/echipamente/${randParinte.id}`}
                className="underline-offset-2 hover:underline"
              >
                {randParinte.cod}
              </Link>
            </>
          )}
        </p>
        <AntetPagina
          titlu={echipament.cod}
          descriere={`${echipament.denumire}${echipament.categorie === null ? "" : ` · ${echipament.categorie}`}`}
          actiuni={
            <span className="flex flex-wrap items-center justify-end gap-1">
              {/* Lista de sesizări acceptă precompletarea; de aici lipsea drumul. */}
              {can(permisiuni, "maintenance:create", "own") ? (
                <Link
                  href={`/mentenanta/sesizari?sesizare=noua&echipament=${echipament.id}`}
                  className={buton({ varianta: "secundar" })}
                >
                  Sesizare nouă
                </Link>
              ) : null}
              <Badge ton={TONURI_STATUS_ECHIPAMENT[echipament.status]}>
                {ETICHETE_STATUS_ECHIPAMENT[echipament.status]}
              </Badge>
              {oprireDeschisa !== null ? (
                <Badge ton="pericol" cuAvertisment>
                  Oprit de {formatDurataMinute(minuteIntre(oprireDeschisa.inceput, null, acum))}
                </Badge>
              ) : null}
              {inGarantie ? (
                <Badge ton="neutru">
                  În garanție până la{" "}
                  {echipament.garantie_expira === null
                    ? ""
                    : formatDate(echipament.garantie_expira)}
                </Badge>
              ) : null}
            </span>
          }
        />
      </div>

      {casat ? (
        <Callout fel="neutru" titlu="Echipament casat">
          Casat la {echipament.casat_la === null ? "—" : formatDate(echipament.casat_la)}
          {echipament.motiv_casare === null ? "." : `: ${echipament.motiv_casare}`} Planurile sunt
          inactive, iar autorizațiile au ieșit din scadențe. Fișa rămâne pentru istoric.
        </Callout>
      ) : null}

      {/* Linkul doar spre o sesizare pe care RLS o întoarce: oprirea se vede la
          scope `team`, sesizarea nu, când raportorul e din afara echipei. */}
      {oprireDeschisa !== null &&
      oprireDeschisa.fault_report_id !== null &&
      sesizariEchipament.randuri.some((s) => s.id === oprireDeschisa.fault_report_id) ? (
        <Callout fel="atentie" titlu="Utilajul nu funcționează">
          Oprit din {formatDateTime(oprireDeschisa.inceput)} (
          {ETICHETE_TIP_OPRIRE[oprireDeschisa.tip]}
          ).{" "}
          <Link
            href={`/mentenanta/sesizari/${oprireDeschisa.fault_report_id}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            Deschideți sesizarea
          </Link>{" "}
          ca să vedeți ce s-a făcut și cine lucrează la ea.
        </Callout>
      ) : null}

      <section aria-labelledby="identificare" className="space-y-3">
        <h2 id="identificare" className="text-sectiune font-semibold">
          Identificare
        </h2>
        <dl className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Camp eticheta="Categorie" valoare={echipament.categorie ?? "—"} />
          <Camp eticheta="Serie" valoare={echipament.serie ?? "—"} />
          <Camp eticheta="Producător" valoare={echipament.producator ?? "—"} />
          <Camp eticheta="Model" valoare={echipament.model ?? "—"} />
          <Camp eticheta="An fabricație" valoare={echipament.an_fabricatie?.toString() ?? "—"} />
          <Camp eticheta="Marcaj CE" valoare={ETICHETE_MARCAJ_CE[echipament.marcaj_ce]} />
          {punctLucru !== null &&
          poateDeschide("/puncte-lucru", { features, permissions: permisiuni }) ? (
            <div>
              <dt className="text-muted-foreground text-nota">Punct de lucru</dt>
              <dd className="text-corp font-medium">
                <Link
                  href={`/puncte-lucru?punct=${punctLucru.id}#punct-${punctLucru.id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {punctLucru.nume}
                </Link>
                {/* Celelalte echipamente ale locației: lista are deja filtrul `?punct_lucru=`. */}
                <Link
                  href={`/mentenanta/echipamente?punct_lucru=${punctLucru.id}`}
                  className="text-muted-foreground text-nota ml-2 font-normal underline-offset-2 hover:underline"
                >
                  echipamentele locației
                </Link>
              </dd>
            </div>
          ) : (
            <Camp
              eticheta="Punct de lucru"
              valoare={punctLucru?.nume ?? (echipament.punct_lucru_id === null ? "—" : "Setat")}
            />
          )}
          <Camp eticheta="Locație" valoare={echipament.locatie ?? "—"} />
          <Camp eticheta="Departament" valoare={departament?.nume ?? "—"} />
          <Camp
            eticheta="Responsabil"
            valoare={numeleAngajatului(echipament.responsabil_employee_id)}
          />
          <Camp
            eticheta="Data punerii în funcțiune"
            valoare={
              echipament.data_punerii_in_functiune === null
                ? "—"
                : formatDate(echipament.data_punerii_in_functiune)
            }
          />
          <Camp
            eticheta="Valoare achiziție"
            valoare={
              echipament.valoare_achizitie === null ? "—" : formatLei(echipament.valoare_achizitie)
            }
          />
          <Camp
            eticheta="Garanție"
            valoare={
              echipament.garantie_expira === null
                ? "—"
                : `${inGarantie ? "până la" : "expirată la"} ${formatDate(echipament.garantie_expira)}`
            }
          />
          <Camp eticheta="Service în garanție" valoare={echipament.service_garantie ?? "—"} />
          <Camp eticheta="Risc specific" valoare={echipament.risc_specific ? "Da" : "Nu"} />
          <Camp
            eticheta="Folosit în afara sediului"
            valoare={echipament.folosit_in_afara_sediului ? "Da" : "Nu"}
          />
          <Camp eticheta="Sub incidența ISCIR" valoare={echipament.este_iscir ? "Da" : "Nu"} />
          {echipament.este_iscir ? (
            poateDeschide("/ssm/autorizatii", { features, permissions: permisiuni }) &&
            echipament.tip_autorizare_necesara !== null ? (
              <div>
                <dt className="text-muted-foreground text-nota">Tip autorizare necesară</dt>
                <dd className="text-corp font-medium">
                  <Link href="/ssm/autorizatii" className="underline-offset-2 hover:underline">
                    {echipament.tip_autorizare_necesara}
                  </Link>
                </dd>
              </div>
            ) : (
              <Camp
                eticheta="Tip autorizare necesară"
                valoare={echipament.tip_autorizare_necesara ?? "—"}
              />
            )
          ) : null}
          {echipament.observatii === null ? null : (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-muted-foreground text-nota">Observații</dt>
              <dd className="text-corp whitespace-pre-wrap">{echipament.observatii}</dd>
            </div>
          )}
          {echipament.derogare_motiv !== null ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-muted-foreground text-nota">Derogare ISCIR acordată</dt>
              <dd className="text-corp font-medium">{echipament.derogare_motiv}</dd>
              <dd className="text-muted-foreground text-nota">
                {echipament.derogare_acordata_la === null
                  ? ""
                  : `la ${formatDateTime(echipament.derogare_acordata_la)}`}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          {poateScrie ? (
            <>
              <ButonEditeazaEchipament
                echipament={{
                  id: echipament.id,
                  cod: echipament.cod,
                  denumire: echipament.denumire,
                  serie: echipament.serie,
                  producator: echipament.producator,
                  model: echipament.model,
                  an_fabricatie: echipament.an_fabricatie,
                  locatie: echipament.locatie,
                  department_id: echipament.department_id,
                  responsabil_employee_id: echipament.responsabil_employee_id,
                  status: echipament.status,
                  este_iscir: echipament.este_iscir,
                  tip_autorizare_necesara: echipament.tip_autorizare_necesara,
                  valoare_achizitie: echipament.valoare_achizitie,
                  data_punerii_in_functiune: echipament.data_punerii_in_functiune,
                  derogare_motiv: echipament.derogare_motiv,
                  categorie: echipament.categorie,
                  punct_lucru_id: echipament.punct_lucru_id,
                  garantie_expira: echipament.garantie_expira,
                  service_garantie: echipament.service_garantie,
                  parent_equipment_id: echipament.parent_equipment_id,
                  marcaj_ce: echipament.marcaj_ce,
                  risc_specific: echipament.risc_specific,
                  folosit_in_afara_sediului: echipament.folosit_in_afara_sediului,
                  observatii: echipament.observatii,
                }}
                angajati={angajatiPentruResponsabil}
                departamente={departamente}
                puncteLucru={puncteLucru}
                parinti={parinti}
                categorii={categorii}
                ssmActiv={features.has("ssm")}
                poateDerogare={can(permisiuni, "maintenance:update", "all")}
              />
              <ButonSchimbaStarea
                echipamentId={echipament.id}
                statusCurent={echipament.status}
                azi={azi}
              />
              {/* Cinci stivuitoare identice se introduc din cinci clicuri: caseta
                  de pe listă se deschide cu câmpurile acestei fișe, fără cod și
                  fără serie (amândouă unice pe utilaj). */}
              <Link
                href={`/mentenanta/echipamente?echipament=nou&model=${echipament.id}`}
                className={buton({ varianta: "tertiar" })}
              >
                Adaugă unul la fel
              </Link>
            </>
          ) : null}
          <Link
            href={`/mentenanta/echipamente/${echipament.id}/eticheta`}
            className={buton({ varianta: "tertiar" })}
          >
            <QrCode aria-hidden="true" className="size-4" />
            Etichetă QR
          </Link>
          {poateSterge ? (
            <ButonStergeEchipament
              echipamentId={echipament.id}
              cod={echipament.cod}
              planuri={planuri.length}
              citiri={contoare.length}
            />
          ) : null}
        </div>
      </section>

      {componente.length === 0 ? null : (
        <section aria-labelledby="componente" className="space-y-3">
          <h2 id="componente" className="text-sectiune font-semibold">
            Componente
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {componente.map((c) => (
              <li key={c.id} className="border-border rounded-panou border p-3">
                <Link
                  href={`/mentenanta/echipamente/${c.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {c.cod} — {c.denumire}
                </Link>
                <p className="text-muted-foreground text-nota">
                  {ETICHETE_STATUS_ECHIPAMENT[c.status]}
                  {c.categorie === null ? "" : ` · ${c.categorie}`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="contoare" className="space-y-3">
        <h2 id="contoare" className="text-sectiune font-semibold">
          Contoare
        </h2>
        <Tabel
          caption="Citirile de contor ale echipamentului."
          coloane={coloaneContoare}
          randuri={contoare}
          cheieRand={(citire) => citire.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio citire de contor. Prima citire fixează punctul de pornire pentru planurile pe
              contor.
            </p>
          }
        />
        {poateScrie && !casat ? (
          <FormularContor equipmentId={echipament.id} angajati={angajatiGenerali} />
        ) : null}
      </section>

      <section aria-labelledby="planuri" className="space-y-3">
        <h2 id="planuri" className="text-sectiune font-semibold">
          Planuri de mentenanță
        </h2>
        {planuri.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Niciun plan de mentenanță definit pentru acest echipament.
          </p>
        ) : (
          <ul className="space-y-2">
            {planuri.map((plan) => {
              const stare = stareScadentaPlan(
                {
                  urmatoareaScadenta: plan.urmatoarea_scadenta,
                  urmatoareaScadentaContor: plan.urmatoarea_scadenta_contor,
                  periodicitateContor: plan.periodicitate_contor,
                  ultimaCitireContor:
                    plan.tip_contor === null
                      ? null
                      : (ultimaCitirePeTip.get(plan.tip_contor) ?? null),
                },
                azi,
              );
              return (
                <li
                  key={plan.id}
                  className="border-border rounded-panou flex flex-wrap items-start justify-between gap-3 border p-3"
                >
                  <div>
                    <p className="font-medium">
                      <Link
                        href={`/mentenanta/planuri/${plan.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {plan.denumire}
                      </Link>
                      {!plan.activ ? (
                        <span className="text-muted-foreground text-nota ml-2">(inactiv)</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-nota">
                      {ETICHETE_TIP_MENTENANTA[plan.tip]} · Responsabil:{" "}
                      {angajatLegat(plan.responsabil_employee_id)}
                    </p>
                    <p className="text-muted-foreground text-nota">{formatPeriodicitate(plan)}</p>
                    {poateScrie && !casat ? (
                      <div className="mt-2">
                        <FormularPlan
                          equipmentId={echipament.id}
                          angajati={angajatiGenerali}
                          planExistent={plan}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <Scadenta treapta={TREPTE_MENTENANTA[stare]}>
                      {ETICHETE_STARE_SCADENTA[stare]}
                    </Scadenta>
                    {plan.urmatoarea_scadenta !== null ? (
                      <span className="text-muted-foreground text-nota">
                        {formatDate(plan.urmatoarea_scadenta)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {poateScrie && !casat ? (
          <FormularPlan equipmentId={echipament.id} angajati={angajatiGenerali} />
        ) : null}
      </section>

      <section aria-labelledby="interventii" className="space-y-3">
        <h2 id="interventii" className="text-sectiune font-semibold">
          Istoricul intervențiilor
        </h2>

        {/* Istoricul e tăiat la 50: lista filtrată pe utilaj are tot restul. */}

        <p className="text-nota">
          <Link
            href={`/mentenanta/interventii?echipament=${echipament.id}`}
            className="underline-offset-2 hover:underline"
          >
            Vezi toate intervențiile pe acest utilaj
          </Link>
        </p>
        <Tabel
          caption="Intervențiile de mentenanță înregistrate pe acest echipament."
          coloane={coloaneInterventii}
          randuri={interventiiEchipament.randuri}
          cheieRand={(interventie) => interventie.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio intervenție înregistrată pentru acest echipament.
            </p>
          }
        />
        {poateScrie && !casat ? (
          <FormularInterventie
            equipmentId={echipament.id}
            planuri={planuriActive.map((p) => ({ id: p.id, nume: p.denumire }))}
            angajati={angajatiGenerali}
          />
        ) : null}
      </section>

      <section aria-labelledby="opriri" className="space-y-3">
        <h2 id="opriri" className="text-sectiune font-semibold">
          Jurnalul opririlor
        </h2>
        {opriri.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Nicio oprire înregistrată. Sesizările care opresc utilajul și intervențiile cu timp de
            oprire scriu aici singure.
          </p>
        ) : (
          <ul className="border-border divide-border rounded-panou divide-y border">
            {opriri.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="text-corp font-medium">
                    {formatDateTime(o.inceput)}
                    {o.sfarsit === null ? " — în curs" : ` — ${formatDateTime(o.sfarsit)}`}
                  </p>
                  <p className="text-muted-foreground text-nota">
                    {ETICHETE_TIP_OPRIRE[o.tip]}
                    {o.motiv === null ? "" : ` · ${o.motiv}`}
                    {o.fault_report_id === null ||
                    !sesizariEchipament.randuri.some((s) => s.id === o.fault_report_id) ? null : (
                      <>
                        {" · "}
                        <Link
                          href={`/mentenanta/sesizari/${o.fault_report_id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          sesizarea
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <Badge ton={o.sfarsit === null ? "pericol" : "neutru"}>
                  {formatDurataMinute(minuteIntre(o.inceput, o.sfarsit, acum))}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="documente" className="space-y-3">
        <h2 id="documente" className="text-sectiune font-semibold">
          Documente
        </h2>
        <DocumenteEchipament atasamente={documente} urluri={urluri} poateSterge={poateScrie} />
        {poateScrie ? <IncarcareDocument entityType="equipment" entityId={echipament.id} /> : null}
      </section>

      <section aria-labelledby="iscir" className="space-y-3">
        <h2 id="iscir" className="text-sectiune font-semibold">
          Autorizații ISCIR
        </h2>
        {autorizatii.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Nicio autorizație ISCIR înregistrată pentru acest echipament.
          </p>
        ) : (
          <ul className="space-y-2">
            {autorizatii.map((autorizatie) => {
              const stare = stareScadentaData(autorizatie.valabil_pana, azi);
              const stareVerificare = stareScadentaData(
                autorizatie.scadenta_verificare_tehnica,
                azi,
              );
              const suspendataLa = autorizatie.suspendata_la;
              const suspendata = suspendataLa !== null;
              return (
                <li
                  key={autorizatie.id}
                  className={`rounded-panou flex flex-wrap items-start justify-between gap-3 border p-3 ${
                    suspendata ? "border-danger/40 bg-danger/8" : "border-border"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {autorizatie.tip} · {autorizatie.numar}
                    </p>
                    <p className="text-muted-foreground text-nota">
                      Emitent: {autorizatie.emitent}
                    </p>
                    {autorizatie.conditii === null ? null : (
                      <p className="text-foreground text-nota mt-1">
                        Condiții impuse: {autorizatie.conditii}
                      </p>
                    )}
                    {suspendataLa === null ? null : (
                      <p className="text-foreground text-nota mt-1 font-medium">
                        Suspendată la {formatDate(suspendataLa)}. Utilajul nu poate funcționa legal
                        până la ridicarea suspendării.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    {suspendata ? (
                      <Badge ton="pericol" cuAvertisment>
                        Suspendată
                      </Badge>
                    ) : null}
                    <Scadenta treapta={TREPTE_MENTENANTA[stare]}>
                      Autorizație: {ETICHETE_STARE_SCADENTA[stare]}
                    </Scadenta>
                    <span className="text-muted-foreground text-nota">
                      până la {formatDate(autorizatie.valabil_pana)}
                    </span>
                    {autorizatie.scadenta_verificare_tehnica === null ? (
                      <span className="text-muted-foreground text-nota">
                        Fără verificare tehnică programată
                      </span>
                    ) : (
                      <>
                        <Scadenta treapta={TREPTE_MENTENANTA[stareVerificare]}>
                          Verificare tehnică: {ETICHETE_STARE_SCADENTA[stareVerificare]}
                        </Scadenta>
                        <span className="text-muted-foreground text-nota">
                          la {formatDate(autorizatie.scadenta_verificare_tehnica)}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {poateScrie && !casat ? <FormularIscir equipmentId={echipament.id} /> : null}
      </section>

      <section aria-labelledby="sesizari-legate" className="space-y-3">
        <h2 id="sesizari-legate" className="text-sectiune font-semibold">
          Sesizări legate
        </h2>

        <p className="text-nota">
          <Link
            href={`/mentenanta/sesizari?echipament=${echipament.id}`}
            className="underline-offset-2 hover:underline"
          >
            Vezi toate sesizările pe acest utilaj
          </Link>
        </p>
        {sesizariEchipament.randuri.length === 0 ? (
          <p className="text-muted-foreground text-corp">
            Nicio sesizare înregistrată pentru acest echipament.
          </p>
        ) : (
          <ul className="space-y-2">
            {sesizariEchipament.randuri.map((sesizare) => (
              <li
                key={sesizare.id}
                className="border-border rounded-panou flex flex-wrap items-start justify-between gap-3 border p-3"
              >
                <div>
                  <Link
                    href={`/mentenanta/sesizari/${sesizare.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    <span className="text-muted-foreground tabular-nums">{sesizare.numar}</span>{" "}
                    {sesizare.descriere}
                  </Link>
                  <p className="text-muted-foreground text-nota">
                    Raportată de {numeleAngajatului(sesizare.raportat_de_employee_id)} la{" "}
                    {formatDateTime(sesizare.raportat_la)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge ton={TONURI_URGENTA_SESIZARE[sesizare.urgenta]}>
                    {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                  </Badge>
                  <Badge ton={TONURI_STATUS_SESIZARE[sesizare.status]}>
                    {ETICHETE_STATUS_SESIZARE[sesizare.status]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Cine a schimbat obiectul ăsta: jurnalul de audit, filtrat pe rândul lui (doar cu audit:read). */}
      <IstoricModificari tenant={tenant} entityId={echipament.id} />
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
