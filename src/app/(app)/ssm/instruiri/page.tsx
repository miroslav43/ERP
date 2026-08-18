// src/app/(app)/ssm/instruiri/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { idFisaProprie } from "@/lib/queries/employees";
import { cheieMatrice, matriceInstruiri, periodicitati, tipuriInstruire } from "@/lib/queries/ssm";
import { filtreInstruiriSchema } from "@/schemas/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import { CLASE_SCADENTA, ETICHETE_DOMENIU, ETICHETE_SCADENTA } from "../etichete";
import { NavSsm } from "../nav-ssm";
import { FiltreInstruiri } from "./filtre-instruiri";

export const metadata: Metadata = { title: "Instruiri SSM/PSI" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function Matrice({
  organizationId,
  userId,
  scope,
  parametri,
}: {
  readonly organizationId: string;
  readonly userId: string;
  readonly scope: "team" | "all";
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreInstruiriSchema, parametri);
  const propriaFisaId = await idFisaProprie(organizationId, userId);

  const [{ angajati, urmatorulCursor, celeMaiRecente }, tipuriToate, perioade] = await Promise.all([
    matriceInstruiri({
      organizationId,
      scope,
      propriaFisaId,
      filtre: {
        q: filtre.q,
        department_id: null,
        job_position_id: null,
        status: "activ",
        cursor: filtre.cursor,
        limita: filtre.limita,
      },
    }),
    tipuriInstruire(organizationId),
    periodicitati(organizationId),
  ]);

  const tipuri = tipuriToate.filter((t) => t.domeniu === filtre.domeniu);
  const perioadaDupaTip = new Map(perioade.map((p) => [p.training_type_id, p]));

  if (angajati.length === 0) {
    const areFiltre = filtre.q !== null;
    return (
      <EmptyState
        icon={GraduationCap}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun angajat de afișat"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toți angajații."
            : "Nu aveți acces la niciun angajat activ în acest scop."
        }
      />
    );
  }

  if (tipuri.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Niciun tip de instruire configurat pentru acest domeniu"
        description="Nomenclatorul de tipuri de instruire se completează de administratorul organizației."
      />
    );
  }

  const azi = todayInBucharest();

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Matricea de instruiri {ETICHETE_DOMENIU[filtre.domeniu]}, angajați × tipuri.
          </caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="sticky left-0 bg-surface px-4 py-3 font-medium">
                Angajat
              </th>
              {tipuri.map((tip) => {
                const perioada = perioadaDupaTip.get(tip.id);
                return (
                  <th key={tip.id} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                    {tip.denumire}
                    {perioada?.periodicitate_luni === null || perioada?.periodicitate_luni === undefined
                      ? null
                      : ` (${String(perioada.periodicitate_luni)} luni)`}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {angajati.map((angajat) => (
              <tr key={angajat.id} className="hover:bg-surface">
                <td className="sticky left-0 bg-background px-4 py-3 font-medium whitespace-nowrap">
                  {angajat.full_name}
                </td>
                {tipuri.map((tip) => {
                  const rand = celeMaiRecente.get(cheieMatrice(angajat.id, tip.id));
                  const stare = stareScadentaSsm(rand !== undefined, rand?.urmatoarea_scadenta ?? null, azi);
                  return (
                    <td key={tip.id} className="px-4 py-3 whitespace-nowrap">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${CLASE_SCADENTA[stare]}`}>
                        {ETICHETE_SCADENTA[stare]}
                      </span>
                      {rand === undefined ? null : (
                        <span className="ml-2 text-xs text-muted-foreground">{formatDate(rand.data_instruirii)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/ssm/instruiri?${cautare.toString()}`}
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm hover:bg-surface"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaInstruiri({ searchParams }: ProprietatiPagina) {
  const user = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  // Matricea are nevoie ȘI de dreptul de a citi instruirile, ȘI de dreptul de
  // a citi lista de angajați — fără al doilea, coloana „Angajat" n-ar putea fi
  // construită deloc.
  if (!can(permisiuni, "ssm:read", "team") || !can(permisiuni, "employees:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Matricea de instruiri cere atât dreptul de a consulta SSM, cât și dreptul de a consulta lista de angajați, la nivel de echipă. Solicitați administratorului organizației rolurile potrivite." />
    );
  }

  const parametri = await searchParams;
  // Gata garantat prin poarta de mai sus: scope-ul e mereu „team" sau „all".
  const scopeAngajati: "team" | "all" = scopeFor(permisiuni, "employees:read") === "all" ? "all" : "team";
  const poateCrea = can(permisiuni, "ssm:create", "team");

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Instruiri</h1>
          <p className="text-sm text-muted-foreground">
            Matricea angajați × tipuri de instruire, cu cea mai recentă efectuare.
          </p>
        </div>
        {poateCrea ? (
          <Link
            href="/ssm/instruiri/noua"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus aria-hidden="true" className="size-4" />
            Instruire nouă
          </Link>
        ) : null}
      </header>

      <NavSsm
        poateVedeaInstruiri
        poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
        poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
        poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
        poateVedeaEip={can(permisiuni, "ssm:read", "team")}
        poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
      />

      <FiltreInstruiri />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={6} />}>
        <Matrice
          organizationId={tenant.organizationId}
          userId={user.id}
          scope={scopeAngajati}
          parametri={parametri}
        />
      </Suspense>
    </main>
  );
}
