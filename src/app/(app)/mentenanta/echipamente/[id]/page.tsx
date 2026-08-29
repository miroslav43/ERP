// src/app/(app)/mentenanta/echipamente/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature, getEnabledFeatures } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiAutorizati,
  angajatiDupaId,
  autorizatiiIscir,
  citesteEchipament,
  contoareEchipament,
  interventii,
  planuriEchipament,
  sesizari,
} from "@/lib/queries/maintenance";
import {
  stareScadentaData,
  stareScadentaPlan,
  TREPTE_MENTENANTA,
} from "@/domain/maintenance/scadente";
import { Scadenta } from "@/components/ui/scadenta";

import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_STARE_SCADENTA,
  ETICHETE_STATUS_ECHIPAMENT,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_TIP_CONTOR,
  ETICHETE_TIP_MENTENANTA,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_REZULTAT_INTERVENTIE,
  TONURI_STATUS_ECHIPAMENT,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
  formatContor,
  formatPeriodicitate,
} from "../../etichete";
import { ButonEditeazaEchipament } from "./buton-editeaza-echipament";
import { FormularContor } from "./formular-contor";
import { FormularInterventie } from "./formular-interventie";
import { FormularIscir } from "./formular-iscir";
import { FormularPlan } from "./formular-plan";

export const metadata: Metadata = { title: "Fișa echipamentului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

interface Optiune {
  readonly id: string;
  readonly nume: string;
}

export default async function PaginaEchipament({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta echipamentele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const echipament = await citesteEchipament(tenant.organizationId, id);
  if (echipament === null) notFound();

  const azi = todayInBucharest();
  const poateScrie = can(permisiuni, "maintenance:update", "team");

  const [contoare, planuri, interventiiEchipament, sesizariEchipament, autorizatii, features] =
    await Promise.all([
      contoareEchipament(echipament.id),
      planuriEchipament(echipament.id),
      interventii(tenant.organizationId, {
        tip: null,
        rezultat: null,
        echipament: echipament.id,
        cursor: null,
        limita: 50,
      }),
      sesizari(tenant.organizationId, {
        status: null,
        urgenta: null,
        echipament: echipament.id,
        cursor: null,
        limita: 50,
      }),
      autorizatiiIscir(tenant.organizationId, echipament.id),
      getEnabledFeatures(tenant.organizationId),
    ]);

  const db = await createServerSupabase();
  const [{ data: angajatiOrg }, { data: departamenteOrg }] = await Promise.all([
    db
      .from("employees")
      .select("id, full_name")
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    db
      .from("departments")
      .select("id, denumire")
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .order("denumire", { ascending: true }),
  ]);

  const angajatiGenerali: readonly Optiune[] = (angajatiOrg ?? []).map((a) => ({
    id: a.id,
    nume: a.full_name ?? "—",
  }));
  const departamente: readonly Optiune[] = (departamenteOrg ?? []).map((d) => ({
    id: d.id,
    nume: d.denumire,
  }));
  const departament =
    echipament.department_id === null
      ? null
      : (departamente.find((d) => d.id === echipament.department_id) ?? null);

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

  // Ultima citire cunoscută pe fiecare tip de contor — pentru semaforul
  // planurilor cu periodicitate pe contor. `contoare` e deja ordonat descrescător.
  const ultimaCitirePeTip = new Map<string, number>();
  for (const citire of contoare) {
    if (!ultimaCitirePeTip.has(citire.tip)) ultimaCitirePeTip.set(citire.tip, citire.citire);
  }

  const planuriActive = planuri.filter((p) => p.activ);

  /*
   * Fără sortare pe niciunul dintre cele două tabele: ambele citiri sunt
   * secțiuni ale unei fișe — contoarele se citesc întregi, iar intervențiile cu
   * o limită fixă de 50. Un antet care pare sortabil și nu face nimic e mai rău
   * decât unul care nu pare.
   */
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
      // „1284” fără unitate și fără separator de mii nu se compară pe verticală,
      // iar pe cardul de sub 768px coloana „Tip” nici nu mai stă alături.
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
      celula: (citire) => numeleAngajatului(citire.citit_de_employee_id),
    },
    {
      cheie: "observatii",
      antet: "Observații",
      peTelefon: "meta",
      celula: (citire) => citire.observatii ?? "—",
    },
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
        interventie.executant_extern ?? numeleAngajatului(interventie.executant_employee_id),
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
        </p>
        <AntetPagina
          titlu={echipament.cod}
          descriere={echipament.denumire}
          actiuni={
            <Badge ton={TONURI_STATUS_ECHIPAMENT[echipament.status]}>
              {ETICHETE_STATUS_ECHIPAMENT[echipament.status]}
            </Badge>
          }
        />
      </div>

      <section aria-labelledby="identificare" className="space-y-3">
        <h2 id="identificare" className="text-sectiune font-semibold">
          Identificare
        </h2>
        <dl className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Camp eticheta="Serie" valoare={echipament.serie ?? "—"} />
          <Camp eticheta="Producător" valoare={echipament.producator ?? "—"} />
          <Camp eticheta="Model" valoare={echipament.model ?? "—"} />
          <Camp eticheta="An fabricație" valoare={echipament.an_fabricatie?.toString() ?? "—"} />
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
          <Camp eticheta="Sub incidența ISCIR" valoare={echipament.este_iscir ? "Da" : "Nu"} />
          {echipament.este_iscir ? (
            <Camp
              eticheta="Tip autorizare necesară"
              valoare={echipament.tip_autorizare_necesara ?? "—"}
            />
          ) : null}
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

        {poateScrie ? (
          <div>
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
              }}
              angajati={angajatiPentruResponsabil}
              departamente={departamente}
              ssmActiv={features.has("ssm")}
              poateDerogare={can(permisiuni, "maintenance:update", "all")}
            />
          </div>
        ) : null}
      </section>

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
        {poateScrie ? (
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
                      {plan.denumire}
                      {!plan.activ ? (
                        <span className="text-muted-foreground text-nota ml-2">(inactiv)</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-nota">
                      {ETICHETE_TIP_MENTENANTA[plan.tip]} · Responsabil:{" "}
                      {numeleAngajatului(plan.responsabil_employee_id)}
                    </p>
                    <p className="text-muted-foreground text-nota">{formatPeriodicitate(plan)}</p>
                    {/* `FormularPlan` își poartă singur butonul de declanșare
                        de când e casetă: `ButonEditeazaPlan`, învelișul care
                        ținea starea „deschis/închis" pentru fiecare plan din
                        listă, n-a mai avut ce face și a fost șters. */}
                    {poateScrie ? (
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
        {poateScrie ? (
          <FormularPlan equipmentId={echipament.id} angajati={angajatiGenerali} />
        ) : null}
      </section>

      <section aria-labelledby="interventii" className="space-y-3">
        <h2 id="interventii" className="text-sectiune font-semibold">
          Istoricul intervențiilor
        </h2>
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
        {poateScrie ? (
          <FormularInterventie
            equipmentId={echipament.id}
            planuri={planuriActive.map((p) => ({ id: p.id, nume: p.denumire }))}
            angajati={angajatiGenerali}
          />
        ) : null}
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
              /*
               * `scadenta_verificare_tehnica` și `conditii` erau SELECTATE de
               * `autorizatiiIscir` și nu ajungeau pe ecran. Verificarea tehnică
               * periodică e o scadență legală distinctă de valabilitatea
               * autorizației: o autorizație valabilă până în 2028 cu verificarea
               * expirată luna trecută scoate utilajul din legalitate la fel de
               * sigur ca una expirată.
               */
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
                    // Suspendarea era un fragment de text de 12px lipit după
                    // emitent, pentru starea care spune că utilajul nu are voie
                    // să funcționeze. Rândul întreg o poartă acum.
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
        {poateScrie ? <FormularIscir equipmentId={echipament.id} /> : null}
      </section>

      <section aria-labelledby="sesizari-legate" className="space-y-3">
        <h2 id="sesizari-legate" className="text-sectiune font-semibold">
          Sesizări legate
        </h2>
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
