// src/app/(app)/mentenanta/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, ShieldAlert, Wrench, type LucideIcon } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  angajatiDupaId,
  autorizatiiIscir,
  echipamenteDupaId,
  numarScadenteMentenanta,
  planuriScadente,
  sesizari,
} from "@/lib/queries/maintenance";
import { PRAG_AVERTIZARE_ZILE, stareScadentaData } from "@/domain/maintenance/scadente";
import { URGENTE_SESIZARE } from "@/schemas/maintenance";

import {
  CLASE_STARE_SCADENTA,
  CLASE_STATUS_ECHIPAMENT,
  CLASE_URGENTA_SESIZARE,
  ETICHETE_STARE_SCADENTA,
  ETICHETE_STATUS_ECHIPAMENT,
  ETICHETE_URGENTA_SESIZARE,
} from "./etichete";
import { NavMentenanta } from "./nav-mentenanta";
import { SesizarileMele } from "./sesizarile-mele";

export const metadata: Metadata = { title: "Mentenanță" };

const RANG_URGENTA = new Map(URGENTE_SESIZARE.map((u, index) => [u, index]));

interface EchipamentProblema {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly status: "in_reparatie" | "in_conservare" | "casat";
}

/** Echipamentele care nu sunt „în funcțiune” — inline, doar pentru panoul de organizație. */
async function echipamenteCuProbleme(organizationId: string): Promise<readonly EchipamentProblema[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment")
    .select("id, cod, denumire, status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("status", "in_functiune")
    .order("cod", { ascending: true })
    .limit(8)
    .returns<EchipamentProblema[]>();
  if (error !== null) throw error;
  return data ?? [];
}

async function PanouOrganizatie({ organizationId }: { readonly organizationId: string }) {
  const azi = todayInBucharest();

  const [planuri, sesizariBrute, iscirBrute, echipamenteProblema, numarScadente] =
    await Promise.all([
      planuriScadente(organizationId),
      sesizari(organizationId, { status: null, urgenta: null, echipament: null, cursor: null, limita: 50 }),
      autorizatiiIscir(organizationId),
      echipamenteCuProbleme(organizationId),
      numarScadenteMentenanta(organizationId, PRAG_AVERTIZARE_ZILE),
    ]);

  const planuriScadenteAfisate = planuri
    .filter((p) => {
      const stare = stareScadentaData(p.urmatoarea_scadenta, azi);
      return stare === "in_intarziere" || stare === "scadenta_apropiata";
    })
    .slice(0, 8);

  const sesizariDeschise = sesizariBrute.randuri
    .filter((s) => s.status !== "rezolvat" && s.status !== "respins")
    .sort((a, b) => {
      const diferentaUrgenta = (RANG_URGENTA.get(b.urgenta) ?? 0) - (RANG_URGENTA.get(a.urgenta) ?? 0);
      return diferentaUrgenta !== 0 ? diferentaUrgenta : a.raportat_la.localeCompare(b.raportat_la);
    })
    .slice(0, 8);

  const iscirScadente = iscirBrute
    .filter((autorizatie) => {
      if (autorizatie.suspendata_la !== null) return false;
      const stare = stareScadentaData(autorizatie.valabil_pana, azi);
      return stare === "in_intarziere" || stare === "scadenta_apropiata";
    })
    .slice(0, 8);

  const idEchipamente = [
    ...planuriScadenteAfisate.map((p) => p.equipment_id),
    ...sesizariDeschise.map((s) => s.equipment_id),
    ...iscirScadente.map((a) => a.equipment_id),
  ];
  const [echipamente, responsabili] = await Promise.all([
    echipamenteDupaId(organizationId, idEchipamente),
    angajatiDupaId(
      organizationId,
      planuriScadenteAfisate
        .map((p) => p.responsabil_employee_id)
        .filter((id): id is string => id !== null),
    ),
  ]);

  const numeEchipament = (id: string) => {
    const e = echipamente.get(id);
    return e === undefined ? "Echipament necunoscut" : `${e.cod} — ${e.denumire}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Scadențe în următoarele</p>
        <p className="text-3xl font-semibold tabular-nums">{numarScadente}</p>
        <p className="text-xs text-zinc-500">
          Planuri de mentenanță și autorizații ISCIR scadente sau în întârziere, în {PRAG_AVERTIZARE_ZILE} zile.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panou
          icon={CalendarClock}
          titlu="Planuri de mentenanță scadente"
          gol="Niciun plan activ nu e scadent sau în întârziere."
        >
          {planuriScadenteAfisate.map((plan) => {
            const stare = stareScadentaData(plan.urmatoarea_scadenta, azi);
            return (
              <li key={plan.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <Link
                    href={`/mentenanta/echipamente/${plan.equipment_id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {plan.denumire}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {numeEchipament(plan.equipment_id)}
                    {plan.responsabil_employee_id !== null
                      ? ` · ${responsabili.get(plan.responsabil_employee_id)?.full_name ?? "—"}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STARE_SCADENTA[stare]}`}>
                    {ETICHETE_STARE_SCADENTA[stare]}
                  </span>
                  {plan.urmatoarea_scadenta !== null ? (
                    <span className="text-xs text-zinc-500">{formatDate(plan.urmatoarea_scadenta)}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </Panou>

        <Panou
          icon={Wrench}
          titlu="Sesizări deschise, pe urgență"
          gol="Nicio sesizare deschisă în acest moment."
        >
          {sesizariDeschise.map((sesizare) => (
            <li key={sesizare.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <Link
                  href={`/mentenanta/sesizari/${sesizare.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {numeEchipament(sesizare.equipment_id)}
                </Link>
                <p className="text-xs text-zinc-500">{sesizare.descriere}</p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${CLASE_URGENTA_SESIZARE[sesizare.urgenta]}`}
              >
                {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
              </span>
            </li>
          ))}
        </Panou>

        <Panou
          icon={AlertTriangle}
          titlu="Echipamente care nu sunt în funcțiune"
          gol="Toate echipamentele sunt în funcțiune."
        >
          {echipamenteProblema.map((echipament) => (
            <li key={echipament.id} className="flex items-center justify-between gap-3 py-2">
              <Link
                href={`/mentenanta/echipamente/${echipament.id}`}
                className="font-medium underline-offset-2 hover:underline"
              >
                {echipament.cod} — {echipament.denumire}
              </Link>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${CLASE_STATUS_ECHIPAMENT[echipament.status]}`}
              >
                {ETICHETE_STATUS_ECHIPAMENT[echipament.status]}
              </span>
            </li>
          ))}
        </Panou>

        <Panou
          icon={ShieldAlert}
          titlu="Autorizații ISCIR ce expiră"
          gol="Nicio autorizație ISCIR nu expiră în curând."
        >
          {iscirScadente.map((autorizatie) => {
            const stare = stareScadentaData(autorizatie.valabil_pana, azi);
            return (
              <li key={autorizatie.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <Link
                    href={`/mentenanta/echipamente/${autorizatie.equipment_id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {numeEchipament(autorizatie.equipment_id)}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {autorizatie.tip} · {autorizatie.numar}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_STARE_SCADENTA[stare]}`}>
                    {ETICHETE_STARE_SCADENTA[stare]}
                  </span>
                  <span className="text-xs text-zinc-500">{formatDate(autorizatie.valabil_pana)}</span>
                </div>
              </li>
            );
          })}
        </Panou>
      </div>
    </div>
  );
}

function Panou({
  icon: Icon,
  titlu,
  gol,
  children,
}: {
  readonly icon: LucideIcon;
  readonly titlu: string;
  readonly gol: string;
  readonly children: ReactNode;
}) {
  const areConținut = Array.isArray(children) ? children.length > 0 : children !== null;
  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden="true" className="size-4 text-zinc-500" />
        {titlu}
      </h2>
      {areConținut ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">{children}</ul>
      ) : (
        <p className="py-4 text-sm text-zinc-500">{gol}</p>
      )}
    </section>
  );
}

export default async function PaginaMentenanta() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  // `can(..., "own")`, nu `scopeFor(...) !== null`: „none” e refuz explicit
  // ȘI e truthy, deci a doua formă ar lăsa poarta deschisă.
  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta mentenanța. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  // Cine are doar „own” ajunge aici prin QR/link direct — în meniu itemul are
  // minScope „team”, deci nu-l vede. Vede DOAR sesizările proprii, nu panoul
  // de organizație.
  if (!can(permisiuni, "maintenance:read", "team")) {
    return <SesizarileMele />;
  }

  const poateAdaugaEchipament = can(permisiuni, "maintenance:update", "team");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mentenanță</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Echipamente, planuri de mentenanță, intervenții și sesizări de defecțiune.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/mentenanta/sesizari/noua"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sesizare nouă
          </Link>
          {poateAdaugaEchipament ? (
            <Link
              href="/mentenanta/echipamente/nou"
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Echipament nou
            </Link>
          ) : null}
        </div>
      </header>

      <NavMentenanta />

      <PanouOrganizatie organizationId={tenant.organizationId} />
    </main>
  );
}
