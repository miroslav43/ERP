// src/app/(app)/flota/aprobari/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { abatereConsum, abatereNotabila, consumLa100Km } from "@/domain/fleet/consum";
import {
  angajatiDupaId,
  anomaliiPeFoi,
  combustibilPeFoi,
  listeazaFoi,
  vehiculeDupaId,
} from "@/lib/queries/fleet";

import { formatConsum } from "../etichete";
import { NavFlota } from "../nav-flota";
import { DecizieFoaie } from "./decizie-foaie";

export const metadata: Metadata = { title: "Foi de aprobat" };

/** Câte foi trimise se aduc deodată. Peste atât, coada se anunță ca tăiată. */
const PLAFON_COADA = 100;

/**
 * O cifră cu semn, în format românesc: „+3 000”, „−250”.
 * Semnul e explicit fiindcă o diferență de kilometraj poate fi și negativă
 * (regres), iar un „+” scris de mână în JSX ar fi mințit exact acolo.
 */
function cuSemn(valoare: number): string {
  const semn = valoare < 0 ? "−" : "+";
  return `${semn}${Math.abs(valoare).toLocaleString("ro-RO")}`;
}

async function ListaDeAprobat({ organizationId }: { readonly organizationId: string }) {
  // Foile de parcurs NU generează sarcini în `approval_tasks`: triggerul de acolo
  // creează sarcini doar pentru `entity_type = 'leave_request'`. Aprobarea se
  // face direct pe rând, iar RLS decide cine vede ce.
  const { randuri, total, urmatorulCursor } = await listeazaFoi(organizationId, {
    status: "trimis",
    vehicul: null,
    cursor: null,
    limita: PLAFON_COADA,
  });

  if (randuri.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={CheckCircle2}
        titlu="Nimic de aprobat"
        descriere="Toate foile de parcurs trimise au fost deja decise."
      />
    );
  }

  /*
   * ── DE CE SE CITESC PATRU LUCRURI, NU DOUĂ ────────────────────────────────
   * Cardul de decizie arăta numărul de înmatriculare, numele șoferului, ora și
   * atât. O foaie de parcurs e document cu regim fiscal: aprobatorul semna
   * consumul de combustibil fără să vadă niciun litru, niciun kilometraj de
   * plecare și niciun steag de anomalie — deși toate erau deja în bază, iar
   * `km_plecare`/`km_sosire` chiar în rândul citit.
   *
   * Combustibilul și anomaliile se aduc PE LOT, într-o citire fiecare: o sută de
   * apeluri per rând ar fi transformat coada într-o pagină care se încarcă în
   * secunde.
   */
  const [soferi, vehicule, combustibil, anomalii] = await Promise.all([
    angajatiDupaId(
      organizationId,
      randuri.map((f) => f.employee_id).filter((id): id is string => id !== null),
    ),
    vehiculeDupaId(
      organizationId,
      randuri.map((f) => f.vehicle_id),
    ),
    combustibilPeFoi(randuri.map((f) => f.id)),
    anomaliiPeFoi(
      organizationId,
      randuri.map((f) => f.id),
    ),
  ]);

  const cuAnomalie = randuri.filter((f) => (anomalii.get(f.id) ?? []).length > 0).length;

  return (
    <div className="space-y-4">
      {/*
        Cele două cifre NU se mai lipesc în aceeași propoziție, fiindcă nu sunt
        măsurate pe aceeași mulțime: `total` e numărul pe toată organizația,
        `cuAnomalie` e numărat peste `randuri`, adică peste pagina afișată.
        „137 foi de aprobat · 3 cu anomalie" se citea ca „3 din 137", când 3 era
        de fapt din primele 100 — exact contradicția antet↔listă pe care runda
        asta o repara în alte module.
      */}
      <p className="text-muted-foreground text-corp">{textNumaratFoi(total)} de aprobat</p>
      {cuAnomalie === 0 ? null : (
        <p className="text-warning text-corp">
          {urmatorulCursor === null
            ? `Dintre ele, ${textNumaratFoi(cuAnomalie)} cu anomalie de kilometraj.`
            : `Pe pagina afișată, ${textNumaratFoi(cuAnomalie)} cu anomalie de kilometraj.`}
        </p>
      )}

      {urmatorulCursor === null ? null : (
        // Coada era tăiată la o sută fără ca nimic să o spună: a 101-a foaie
        // pur și simplu nu exista pe ecran.
        <Callout fel="atentie" titlu="Coada e afișată parțial">
          Se arată primele {randuri.length.toLocaleString("ro-RO")} foi trimise, din{" "}
          {total.toLocaleString("ro-RO")}. Restul apar pe măsură ce le decideți pe acestea.
        </Callout>
      )}

      {combustibil.trunchiat ? (
        <Callout fel="atentie" titlu="Alimentările nu sunt toate numărate">
          Citirea alimentărilor a atins plafonul, deci litrii și costul de mai jos pot fi mai mici
          decât cei reali. Decideți foile în tranșe mai mici.
        </Callout>
      ) : null}

      <ul className="space-y-3">
        {randuri.map((f) => {
          const sofer = f.employee_id === null ? undefined : soferi.get(f.employee_id);
          const vehicul = vehicule.get(f.vehicle_id);
          const alimentat = combustibil.perFoaie.get(f.id);
          const aleFoii = anomalii.get(f.id) ?? [];

          const consumReal = consumLa100Km(alimentat?.litri ?? 0, f.km_parcursi);
          const abatere = abatereConsum(consumReal, vehicul?.consum_mediu_declarat ?? null);

          return (
            <li key={f.id} className="border-border rounded-panou space-y-3 border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    <Link
                      href={`/flota/foi/${f.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {vehicul?.nr_inmatriculare ?? "Vehicul indisponibil"}
                    </Link>
                    {/* `full_name` e calculat și poate lipsi: fără ocolire se randa
                        „ · (1234)” — o paranteză fără nimeni în față. */}
                    {sofer === undefined ? null : (
                      <span className="text-muted-foreground">
                        {` · ${sofer.full_name ?? `Angajat ${sofer.marca}`} (${sofer.marca})`}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-corp">
                    {formatDateTime(new Date(f.plecare_la))}
                    {f.sosire_la === null ? null : ` – ${formatDateTime(new Date(f.sosire_la))}`}
                  </p>
                </div>
                <DecizieFoaie id={f.id} />
              </div>

              {aleFoii.map((a) => (
                // Anomalia trăia doar în `useState`-ul șoferului care a produs-o,
                // iar `router.refresh()` o ștergea. Aici e cifra care schimbă
                // decizia: o foaie cu un salt de 3 000 km neexplicat arăta în
                // coadă exact ca una curată.
                <Callout
                  key={a.id}
                  fel="atentie"
                  titlu={`Anomalie de kilometraj: ${cuSemn(a.diferenta ?? a.km_declarat - a.km_asteptat)} km`}
                  actiune={
                    <Link href="/flota/anomalii" className="text-corp underline underline-offset-2">
                      Vezi anomaliile
                    </Link>
                  }
                >
                  Așteptat {a.km_asteptat.toLocaleString("ro-RO")} km, declarat{" "}
                  {a.km_declarat.toLocaleString("ro-RO")} km.
                  {a.explicatie === null ? null : ` ${a.explicatie}`}
                  {a.confirmat_la === null ? " Nimeni nu a explicat-o încă." : ""}
                </Callout>
              ))}

              <ListaDefinitii
                coloane={4}
                textNecompletat="Neînregistrat"
                definitii={[
                  {
                    eticheta: "Kilometraj",
                    valoare:
                      f.km_plecare === null
                        ? null
                        : `${f.km_plecare.toLocaleString("ro-RO")} → ${
                            f.km_sosire === null ? "…" : f.km_sosire.toLocaleString("ro-RO")
                          } km`,
                  },
                  {
                    eticheta: "Parcurși",
                    valoare:
                      f.km_parcursi === null ? null : `${f.km_parcursi.toLocaleString("ro-RO")} km`,
                  },
                  {
                    eticheta: "Combustibil",
                    // Zero alimentări NU e o valoare lipsă: e o foaie care nu
                    // justifică niciun litru, iar asta e o informație pentru
                    // cel care semnează.
                    valoare:
                      alimentat === undefined
                        ? "fără alimentare"
                        : `${alimentat.litri.toLocaleString("ro-RO", {
                            maximumFractionDigits: 2,
                          })} l · ${formatLei(alimentat.cost)}`,
                  },
                  {
                    eticheta: "Consum real",
                    // Fără nicio alimentare cifra nu LIPSEȘTE, ci nu se poate
                    // calcula — iar „Neînregistrat” l-ar fi trimis pe aprobator
                    // să caute un câmp necompletat care nu există.
                    valoare:
                      consumReal === null && alimentat === undefined ? (
                        "nu se poate calcula fără alimentări"
                      ) : consumReal === null ? null : (
                        <>
                          {formatConsum(consumReal)}
                          {abatere === null ? null : (
                            <span
                              className={
                                abatereNotabila(abatere)
                                  ? "text-danger ml-1 font-medium"
                                  : "text-muted-foreground ml-1"
                              }
                            >
                              ({cuSemn(Math.round(abatere))}% față de declarat)
                            </span>
                          )}
                        </>
                      ),
                  },
                  ...(f.traseu === null
                    ? []
                    : [{ eticheta: "Traseu", valoare: f.traseu, lat: true }]),
                ]}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Acordul românesc al numeralului pentru „foaie/foi", cu regula lui „de”:
 * se pune peste 19, hotărât de ULTIMELE DOUĂ cifre — 101 nu-l ia, 120 îl ia.
 *
 * A treia apariție a aceleiași reguli în depozit (după `diurna/etichete.ts` și
 * `mentenanta/etichete.ts`), ceea ce e semnalul că locul ei e un modul de
 * format comun. Scris aici deocamdată, ca reparația să rămână atribuibilă
 * rundei; mutarea e o decizie, nu o corectură.
 */
function textNumaratFoi(numar: number): string {
  const ultimeleDoua = numar % 100;
  const cuDe = ultimeleDoua === 0 || ultimeleDoua > 19;
  const substantiv = numar === 1 ? "foaie" : "foi";
  return `${numar.toLocaleString("ro-RO")} ${cuDe ? "de " : ""}${substantiv}`;
}

export default async function PaginaAprobari() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "trip_sheets:approve", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a aproba foi de parcurs. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Foi de aprobat"
        descriere="Foaia de parcurs justifică fiscal consumul de combustibil, de aceea nu vă puteți aproba propria foaie — nici măcar cu drepturi depline."
        file={
          <NavFlota
            poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
            poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
            poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
          />
        }
      />

      <Suspense fallback={<Schelet forma="lista" />}>
        <ListaDeAprobat organizationId={tenant.organizationId} />
      </Suspense>
    </div>
  );
}
