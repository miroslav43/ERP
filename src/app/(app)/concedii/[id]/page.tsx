// src/app/(app)/concedii/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatAmount } from "@/lib/format/money";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { citesteCerere, lantulAprobarii, zileleCererii } from "@/lib/queries/leave";

import {
  CLASE_STATUS_CERERE,
  ETICHETE_PORTIUNE,
  ETICHETE_STATUS_CERERE,
  ETICHETE_STATUS_SARCINA,
} from "../etichete";
import { ActiuniCerere } from "./actiuni-cerere";
import { idDinRuta } from "@/lib/rute/parametri";

export const metadata: Metadata = { title: "Detaliile cererii de concediu" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

interface TipMinim {
  readonly denumire: string;
  readonly culoare: string;
}

interface AngajatMinim {
  readonly full_name: string;
  readonly marca: string;
}

export default async function PaginaDetaliuCerere({ params }: ProprietatiPagina) {
  const { id: idBrut } = await params;
  const id = idDinRuta(idBrut);
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "leave:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cererile de concediu. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const cerere = await citesteCerere(tenant.organizationId, id);
  if (cerere === null) notFound();

  const [zile, lant] = await Promise.all([
    zileleCererii(cerere.id),
    lantulAprobarii(tenant.organizationId, cerere.id),
  ]);

  const db = await createServerSupabase();
  const { data: tip } = await db
    .from("leave_types")
    .select("denumire, culoare")
    .eq("organization_id", tenant.organizationId)
    .eq("id", cerere.leave_type_id)
    .maybeSingle<TipMinim>();

  // Numele angajatului se citește doar dacă scope-ul depășește „own”:
  // pentru un rol strict „own” (`employees:read = none`), RLS ar întoarce
  // oricum null — mai bine sărim interogarea decât să o lăsăm eșueze tăcut.
  const arataAngajat = can(permisiuni, "leave:read", "team");
  let angajat: AngajatMinim | null = null;
  if (arataAngajat) {
    const { data } = await db
      .from("employees")
      .select("full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("id", cerere.employee_id)
      .maybeSingle<AngajatMinim>();
    angajat = data;
  }

  const poateAnula =
    can(permisiuni, "leave:update", "own") &&
    (cerere.status === "ciorna" || cerere.status === "trimisa");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <span
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: tip?.culoare ?? "#94a3b8" }}
              aria-hidden="true"
            />
            {tip?.denumire ?? "Cerere de concediu"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {angajat !== null ? `${angajat.full_name} (${angajat.marca}) · ` : ""}
            {formatDate(cerere.data_inceput)} – {formatDate(cerere.data_sfarsit)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${CLASE_STATUS_CERERE[cerere.status]}`}
        >
          {ETICHETE_STATUS_CERERE[cerere.status]}
        </span>
      </header>

      <section
        aria-labelledby="titlu-rezumat"
        className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
      >
        <h2 id="titlu-rezumat" className="mb-4 text-lg font-medium">
          Rezumat
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">Zile lucrătoare</dt>
            <dd className="mt-0.5 text-sm">{formatAmount(cerere.zile_lucratoare)}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">Zile calendaristice</dt>
            <dd className="mt-0.5 text-sm">{cerere.zile_calendaristice}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">Porțiuni</dt>
            <dd className="mt-0.5 text-sm">
              {ETICHETE_PORTIUNE[cerere.portiune_inceput]}
              {cerere.portiune_inceput !== cerere.portiune_sfarsit
                ? ` → ${ETICHETE_PORTIUNE[cerere.portiune_sfarsit]}`
                : ""}
            </dd>
          </div>
          {cerere.trimisa_la !== null ? (
            <div>
              <dt className="text-xs tracking-wide text-zinc-500 uppercase">Trimisă la</dt>
              <dd className="mt-0.5 text-sm">{formatDateTime(cerere.trimisa_la)}</dd>
            </div>
          ) : null}
          {cerere.decis_la !== null ? (
            <div>
              <dt className="text-xs tracking-wide text-zinc-500 uppercase">Decisă la</dt>
              <dd className="mt-0.5 text-sm">{formatDateTime(cerere.decis_la)}</dd>
            </div>
          ) : null}
          {cerere.motiv !== null && cerere.motiv.length > 0 ? (
            <div className="sm:col-span-3">
              <dt className="text-xs tracking-wide text-zinc-500 uppercase">Motiv</dt>
              <dd className="mt-0.5 text-sm">{cerere.motiv}</dd>
            </div>
          ) : null}
          {cerere.atasament_path !== null ? (
            <div className="sm:col-span-3">
              <dt className="text-xs tracking-wide text-zinc-500 uppercase">
                Document justificativ
              </dt>
              <dd className="mt-0.5 font-mono text-sm">{cerere.atasament_path}</dd>
            </div>
          ) : null}
          {cerere.motiv_respingere !== null ? (
            <div className="sm:col-span-3">
              <dt className="text-xs tracking-wide text-rose-600 uppercase dark:text-rose-400">
                Motivul respingerii
              </dt>
              <dd className="mt-0.5 text-sm">{cerere.motiv_respingere}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section
        aria-labelledby="titlu-zile"
        className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
      >
        <h2 id="titlu-zile" className="mb-4 text-lg font-medium">
          Zilele cererii
        </h2>
        {zile.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Zilele cererii nu au fost încă generate.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
            {zile.map((zi) => (
              <li
                key={zi.data}
                className={`rounded-md border px-2 py-1.5 text-center ${
                  zi.este_lucratoare
                    ? "border-zinc-200 dark:border-zinc-700"
                    : "border-zinc-100 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                }`}
              >
                <div className="font-medium">{formatDate(zi.data)}</div>
                {zi.portiune !== "zi_intreaga" ? (
                  <div className="text-xs">{ETICHETE_PORTIUNE[zi.portiune]}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="titlu-aprobare"
        className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
      >
        <h2 id="titlu-aprobare" className="mb-4 text-lg font-medium">
          Lanțul de aprobare
        </h2>
        {cerere.status === "ciorna" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Cererea este încă o ciornă; lanțul de aprobare se generează la trimitere.
          </p>
        ) : lant.length === 0 ? (
          // Solicitantul vede lanțul GOL dacă nu e el însuși aprobator:
          // `approval_tasks_select` arată doar sarcinile proprii. Nu se
          // randează un tabel gol — mesajul explică ce urmează.
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Cererea a fost trimisă spre aprobare; rezultatul apare aici după decizie.
          </p>
        ) : (
          <ol className="space-y-2 text-sm">
            {lant.map((pas) => (
              <li
                key={pas.id}
                className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">Pasul {pas.ordine}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      pas.status === "aprobata"
                        ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50"
                        : pas.status === "respinsa"
                          ? "bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-50"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-50"
                    }`}
                  >
                    {ETICHETE_STATUS_SARCINA[pas.status]}
                  </span>
                </div>
                {pas.comentariu !== null && pas.comentariu.length > 0 ? (
                  <p className="mt-1 text-zinc-600 dark:text-zinc-300">{pas.comentariu}</p>
                ) : null}
                {pas.decis_la !== null ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Decis la {formatDateTime(pas.decis_la)}
                  </p>
                ) : pas.termen_la !== null ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Termen: {formatDateTime(pas.termen_la)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {poateAnula ? <ActiuniCerere cerereId={cerere.id} /> : null}
    </main>
  );
}
