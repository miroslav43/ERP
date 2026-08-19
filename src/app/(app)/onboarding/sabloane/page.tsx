// src/app/(app)/onboarding/sabloane/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FilePlus2, ListChecks } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { RandTabel } from "@/components/data/rand-tabel";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { listeazaSabloane } from "@/lib/queries/checklist";
import { CHECKLIST_TIP, filtreSabloaneSchema } from "@/schemas/checklist";

import { ETICHETE_TIP } from "../etichete";
import { NavOnboarding } from "../nav-onboarding";

export const metadata: Metadata = { title: "Șabloane de checklist" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelSabloane({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreSabloaneSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaSabloane(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.tip !== null || filtre.cauta !== null;
    return (
      <EmptyState
        icon={ListChecks}
        title={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun șablon creat încă"}
        description={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate șabloanele."
            : "Creați primul șablon ca să puteți porni instanțe de checklist pentru angajați."
        }
      />
    );
  }

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Șabloanele de checklist ale organizației.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Denumire
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Valabil de la
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {randuri.map((s) => (
              <RandTabel key={s.id} href={`/onboarding/sabloane/${s.id}`}>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/onboarding/sabloane/${s.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {s.denumire}
                  </Link>
                </td>
                <td className="px-4 py-3">{ETICHETE_TIP[s.tip]}</td>
                <td className="px-4 py-3">{formatDate(s.valabil_de_la)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      s.activ
                        ? "bg-surface text-foreground"
                        : "bg-surface text-foreground"
                    }`}
                  >
                    {s.activ ? "Activ" : "Dezactivat"}
                  </span>
                </td>
              </RandTabel>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/onboarding/sabloane?${cautare.toString()}`}
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm hover:bg-surface"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaSabloane({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta șabloanele de checklist. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "checklists:create", "all");
  const tipCurent = typeof parametri["tip"] === "string" ? parametri["tip"] : "";
  const cautaCurent = typeof parametri["cauta"] === "string" ? parametri["cauta"] : "";

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Șabloane de checklist</h1>
          <p className="text-sm text-muted-foreground">
            Structura pașilor pentru integrare, ieșire sau transfer.
          </p>
        </div>
        {poateCrea ? (
          <Link
            href="/onboarding/sabloane/nou"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <FilePlus2 aria-hidden="true" className="size-4" />
            Șablon nou
          </Link>
        ) : null}
      </header>

      <NavOnboarding />

      {/* Formular simplu, fără JavaScript: GET direct pe query string. */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="cauta" className="text-sm font-medium">
            Denumire
          </label>
          <input
            id="cauta"
            name="cauta"
            type="search"
            defaultValue={cautaCurent}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tip" className="text-sm font-medium">
            Tip
          </label>
          <select
            id="tip"
            name="tip"
            defaultValue={tipCurent}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            <option value="">Toate</option>
            {CHECKLIST_TIP.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP[t]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Filtrează
        </button>
      </form>

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={4} />}>
        <TabelSabloane organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </main>
  );
}
