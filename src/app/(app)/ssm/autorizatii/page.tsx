// src/app/(app)/ssm/autorizatii/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { angajatiDupaId, autorizatiiNominale } from "@/lib/queries/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import { CLASE_SCADENTA, ETICHETE_SCADENTA } from "../etichete";
import { NavSsm } from "../nav-ssm";
import { FormularAutorizatie } from "./formular-autorizatie";

export const metadata: Metadata = { title: "Autorizații nominale" };

async function TabelAutorizatii({ organizationId }: { readonly organizationId: string }) {
  const autorizatii = await autorizatiiNominale(organizationId);

  if (autorizatii.length === 0) {
    return (
      <EmptyState
        icon={BadgeCheck}
        title="Nicio autorizație nominală înregistrată"
        description="Adăugați prima autorizație (stivuitorist, macaragiu, fochist, electrician autorizat…) folosind formularul de mai sus."
      />
    );
  }

  const angajati = await angajatiDupaId(
    organizationId,
    autorizatii.map((a) => a.employee_id),
  );
  const azi = todayInBucharest();

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <caption className="sr-only">Autorizațiile nominale ale angajaților.</caption>
        <thead className="bg-zinc-50 text-left dark:bg-zinc-900">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Angajat
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Tip
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Număr
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Emitent
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Valabilă până la
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Stare
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {autorizatii.map((a) => {
            const angajat = angajati.get(a.employee_id);
            const stare = a.suspendata_la !== null ? null : stareScadentaSsm(true, a.valabil_pana, azi);
            return (
              <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <td className="px-4 py-3">
                  {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
                </td>
                <td className="px-4 py-3">
                  {a.tip}
                  {a.grupa === null ? null : <span className="text-zinc-500"> · grupa {a.grupa}</span>}
                </td>
                <td className="px-4 py-3">{a.numar}</td>
                <td className="px-4 py-3">{a.emitent}</td>
                <td className="px-4 py-3">{formatDate(a.valabil_pana)}</td>
                <td className="px-4 py-3">
                  {a.suspendata_la !== null ? (
                    <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                      Suspendată {formatDate(a.suspendata_la)}
                    </span>
                  ) : stare === null ? null : (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_SCADENTA[stare]}`}>
                      {ETICHETE_SCADENTA[stare]}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaginaAutorizatii() {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta autorizațiile nominale. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateCrea = can(permisiuni, "ssm:create", "team");

  let angajati: readonly { readonly id: string; readonly full_name: string | null; readonly marca: string }[] = [];
  if (poateCrea) {
    const db = await createServerSupabase();
    const { data } = await db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .limit(500);
    angajati = data ?? [];
  }

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Autorizații nominale</h1>
        <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
          Stivuitorist, macaragiu, fochist, electrician autorizat și altele — condiționează
          desemnarea unui angajat ca responsabil pe echipamente ISCIR.
        </p>
      </header>

      <NavSsm
        poateVedeaInstruiri={can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")}
        poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
        poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
        poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
        poateVedeaEip={can(permisiuni, "ssm:read", "team")}
        poateVedeaAutorizatii
      />

      {poateCrea ? <FormularAutorizatie angajati={angajati} /> : null}

      <Suspense fallback={<SkeletonTable cols={6} />}>
        <TabelAutorizatii organizationId={tenant.organizationId} />
      </Suspense>
    </main>
  );
}
