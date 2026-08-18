// src/app/(app)/ssm/eip/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { HardHat } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { angajatiDupaId, eip } from "@/lib/queries/ssm";
import { filtreEipSchema } from "@/schemas/ssm";

import { NavSsm } from "../nav-ssm";
import { FormularEip } from "./formular-eip";

export const metadata: Metadata = { title: "Echipament individual de protecție" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelEip({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreEipSchema, parametri);
  const { randuri, urmatorulCursor } = await eip(organizationId, filtre);

  if (randuri.length === 0) {
    return (
      <EmptyState
        icon={HardHat}
        title="Niciun echipament predat"
        description="Predați primul echipament individual de protecție folosind formularul de mai jos."
      />
    );
  }

  const angajati = await angajatiDupaId(
    organizationId,
    randuri.map((e) => e.employee_id),
  );

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Echipamentul individual de protecție predat.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Angajat
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Articol
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Cantitate
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Predat la
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Înlocuire
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Returnat
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {randuri.map((e) => {
              const angajat = angajati.get(e.employee_id);
              return (
                <tr key={e.id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
                  </td>
                  <td className="px-4 py-3">
                    {e.articol}
                    {e.cod_articol === null ? null : <span className="text-muted-foreground"> · {e.cod_articol}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e.cantitate} {e.unitate}
                  </td>
                  <td className="px-4 py-3">{formatDate(e.data_predarii)}</td>
                  <td className="px-4 py-3">{e.data_inlocuirii === null ? "—" : formatDate(e.data_inlocuirii)}</td>
                  <td className="px-4 py-3">{e.returnat_la === null ? "—" : formatDate(e.returnat_la)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/ssm/eip?${cautare.toString()}`}
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm hover:bg-surface"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaEip({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta echipamentul individual de protecție. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
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
        <h1 className="text-2xl font-semibold">Echipament individual de protecție</h1>
        <p className="text-sm text-muted-foreground">
          Predările de EIP, cu data de înlocuire calculată automat.
        </p>
      </header>

      <NavSsm
        poateVedeaInstruiri={can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")}
        poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
        poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
        poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
        poateVedeaEip
        poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
      />

      {poateCrea ? <FormularEip angajati={angajati} /> : null}

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={6} />}>
        <TabelEip organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
