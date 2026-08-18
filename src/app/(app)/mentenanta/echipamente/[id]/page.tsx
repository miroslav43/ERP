// src/app/(app)/mentenanta/echipamente/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
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
import { stareScadentaData, stareScadentaPlan } from "@/domain/maintenance/scadente";

import {
  CLASE_REZULTAT_INTERVENTIE,
  CLASE_STARE_SCADENTA,
  CLASE_STATUS_ECHIPAMENT,
  CLASE_STATUS_SESIZARE,
  CLASE_URGENTA_SESIZARE,
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_STARE_SCADENTA,
  ETICHETE_STATUS_ECHIPAMENT,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_TIP_CONTOR,
  ETICHETE_TIP_MENTENANTA,
  ETICHETE_URGENTA_SESIZARE,
} from "../../etichete";
import { FormularEchipament } from "../formular-echipament";
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

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

  return (
    <main className="space-y-8 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/mentenanta/echipamente" className="underline-offset-2 hover:underline">
              Echipamente
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{echipament.cod}</h1>
          <p className="text-sm text-muted-foreground">{echipament.denumire}</p>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${CLASE_STATUS_ECHIPAMENT[echipament.status]}`}
        >
          {ETICHETE_STATUS_ECHIPAMENT[echipament.status]}
        </span>
      </header>

      <section aria-labelledby="identificare" className="space-y-3">
        <h2 id="identificare" className="text-lg font-semibold">
          Identificare
        </h2>
        <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Camp eticheta="Serie" valoare={echipament.serie ?? "—"} />
          <Camp eticheta="Producător" valoare={echipament.producator ?? "—"} />
          <Camp eticheta="Model" valoare={echipament.model ?? "—"} />
          <Camp eticheta="An fabricație" valoare={echipament.an_fabricatie?.toString() ?? "—"} />
          <Camp eticheta="Locație" valoare={echipament.locatie ?? "—"} />
          <Camp eticheta="Departament" valoare={departament?.nume ?? "—"} />
          <Camp eticheta="Responsabil" valoare={numeleAngajatului(echipament.responsabil_employee_id)} />
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
            valoare={echipament.valoare_achizitie === null ? "—" : formatLei(echipament.valoare_achizitie)}
          />
          <Camp eticheta="Sub incidența ISCIR" valoare={echipament.este_iscir ? "Da" : "Nu"} />
          {echipament.este_iscir ? (
            <Camp eticheta="Tip autorizare necesară" valoare={echipament.tip_autorizare_necesara ?? "—"} />
          ) : null}
          {echipament.derogare_motiv !== null ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-xs text-muted-foreground">Derogare ISCIR acordată</dt>
              <dd className="text-sm font-medium">{echipament.derogare_motiv}</dd>
              <dd className="text-xs text-muted-foreground">
                {echipament.derogare_acordata_la === null
                  ? ""
                  : `la ${formatDateTime(echipament.derogare_acordata_la)}`}
              </dd>
            </div>
          ) : null}
        </dl>

        {poateScrie ? (
          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Editează datele echipamentului
            </summary>
            <div className="mt-4">
              <FormularEchipament
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
          </details>
        ) : null}
      </section>

      <section aria-labelledby="contoare" className="space-y-3">
        <h2 id="contoare" className="text-lg font-semibold">
          Contoare
        </h2>
        {contoare.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nicio citire de contor. Prima citire fixează punctul de pornire pentru planurile pe
            contor.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tip
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Citire
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Citit de
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Observații
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contoare.map((citire) => (
                  <tr key={citire.id}>
                    <td className="px-4 py-3">
                      {ETICHETE_TIP_CONTOR[citire.tip]}
                      {citire.resetare_contor ? (
                        <span className="ml-1 text-xs text-foreground">(resetare)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{citire.citire}</td>
                    <td className="px-4 py-3">{formatDate(citire.data_citirii)}</td>
                    <td className="px-4 py-3">{numeleAngajatului(citire.citit_de_employee_id)}</td>
                    <td className="px-4 py-3">{citire.observatii ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {poateScrie ? <FormularContor equipmentId={echipament.id} angajati={angajatiGenerali} /> : null}
      </section>

      <section aria-labelledby="planuri" className="space-y-3">
        <h2 id="planuri" className="text-lg font-semibold">
          Planuri de mentenanță
        </h2>
        {planuri.length === 0 ? (
          <p className="text-sm text-muted-foreground">
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
                    plan.tip_contor === null ? null : (ultimaCitirePeTip.get(plan.tip_contor) ?? null),
                },
                azi,
              );
              return (
                <li
                  key={plan.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {plan.denumire}
                      {!plan.activ ? <span className="ml-2 text-xs text-muted-foreground">(inactiv)</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ETICHETE_TIP_MENTENANTA[plan.tip]} · Responsabil: {numeleAngajatului(plan.responsabil_employee_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {plan.periodicitate_zile !== null ? `La ${plan.periodicitate_zile} zile` : ""}
                      {plan.periodicitate_zile !== null && plan.periodicitate_contor !== null ? " · " : ""}
                      {plan.periodicitate_contor !== null && plan.tip_contor !== null
                        ? `La ${plan.periodicitate_contor} ${ETICHETE_TIP_CONTOR[plan.tip_contor]}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STARE_SCADENTA[stare]}`}>
                      {ETICHETE_STARE_SCADENTA[stare]}
                    </span>
                    {plan.urmatoarea_scadenta !== null ? (
                      <span className="text-xs text-muted-foreground">{formatDate(plan.urmatoarea_scadenta)}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {poateScrie ? <FormularPlan equipmentId={echipament.id} angajati={angajatiGenerali} /> : null}
      </section>

      <section aria-labelledby="interventii" className="space-y-3">
        <h2 id="interventii" className="text-lg font-semibold">
          Istoricul intervențiilor
        </h2>
        {interventiiEchipament.randuri.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nicio intervenție înregistrată pentru acest echipament.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tip
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Descriere
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Executant
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Cost total
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Rezultat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {interventiiEchipament.randuri.map((interventie) => (
                  <tr key={interventie.id}>
                    <td className="px-4 py-3">{formatDate(interventie.data)}</td>
                    <td className="px-4 py-3">{ETICHETE_TIP_MENTENANTA[interventie.tip]}</td>
                    <td className="px-4 py-3">{interventie.descriere}</td>
                    <td className="px-4 py-3">
                      {interventie.executant_extern ?? numeleAngajatului(interventie.executant_employee_id)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatLei(interventie.cost_total ?? interventie.cost_piese + interventie.cost_manopera)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_REZULTAT_INTERVENTIE[interventie.rezultat]}`}
                      >
                        {ETICHETE_REZULTAT_INTERVENTIE[interventie.rezultat]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {poateScrie ? (
          <FormularInterventie
            equipmentId={echipament.id}
            planuri={planuriActive.map((p) => ({ id: p.id, nume: p.denumire }))}
            angajati={angajatiGenerali}
          />
        ) : null}
      </section>

      <section aria-labelledby="iscir" className="space-y-3">
        <h2 id="iscir" className="text-lg font-semibold">
          Autorizații ISCIR
        </h2>
        {autorizatii.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nicio autorizație ISCIR înregistrată pentru acest echipament.
          </p>
        ) : (
          <ul className="space-y-2">
            {autorizatii.map((autorizatie) => {
              const stare = stareScadentaData(autorizatie.valabil_pana, azi);
              return (
                <li
                  key={autorizatie.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {autorizatie.tip} · {autorizatie.numar}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emitent: {autorizatie.emitent}
                      {autorizatie.suspendata_la !== null ? " · Suspendată" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STARE_SCADENTA[stare]}`}>
                      {ETICHETE_STARE_SCADENTA[stare]}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(autorizatie.valabil_pana)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {poateScrie ? <FormularIscir equipmentId={echipament.id} /> : null}
      </section>

      <section aria-labelledby="sesizari-legate" className="space-y-3">
        <h2 id="sesizari-legate" className="text-lg font-semibold">
          Sesizări legate
        </h2>
        {sesizariEchipament.randuri.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nicio sesizare înregistrată pentru acest echipament.
          </p>
        ) : (
          <ul className="space-y-2">
            {sesizariEchipament.randuri.map((sesizare) => (
              <li
                key={sesizare.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div>
                  <Link
                    href={`/mentenanta/sesizari/${sesizare.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {sesizare.descriere}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Raportată de {numeleAngajatului(sesizare.raportat_de_employee_id)} la{" "}
                    {formatDateTime(sesizare.raportat_la)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_URGENTA_SESIZARE[sesizare.urgenta]}`}
                  >
                    {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_SESIZARE[sesizare.status]}`}
                  >
                    {ETICHETE_STATUS_SESIZARE[sesizare.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
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
