// src/app/(app)/inventar/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Package, PackagePlus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { RandTabel } from "@/components/data/rand-tabel";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { alocariDeschise, categorii, listeazaObiecte } from "@/lib/queries/inventory";
import { filtreInventarSchema } from "@/schemas/inventory";

import { CLASE_STARE, CLASE_STATUS, ETICHETE_STARE, ETICHETE_STATUS } from "./etichete";
import { FiltreInventar } from "./filtre-inventar";
import { filtreDinUrl } from "@/lib/rute/parametri";

export const metadata: Metadata = { title: "Inventar" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface OptiuneCategorie {
  readonly id: string;
  readonly denumire: string;
}

interface ProprietatiTabel {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly categorii: readonly OptiuneCategorie[];
}

async function TabelInventar({ organizationId, parametri, categorii: listaCategorii }: ProprietatiTabel) {
  const filtre = filtreDinUrl(filtreInventarSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaObiecte(organizationId, filtre);

  if (randuri.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Niciun obiect găsit"
        description="Nu există obiecte de inventar care să corespundă filtrelor alese. Ștergeți filtrele sau adăugați primul obiect."
      />
    );
  }

  const idAlocate = randuri.filter((rand) => rand.status === "alocat").map((rand) => rand.id);
  const detinatori = await alocariDeschise(organizationId, idAlocate);
  const numeCategorii = new Map(listaCategorii.map((cat) => [cat.id, cat.denumire]));

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Lista obiectelor de inventar</caption>
          <thead className="bg-surface text-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Denumire
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Număr inventar
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Categorie
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Circuit
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Deținut de
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Valoare
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {randuri.map((rand) => {
              const detinator = detinatori.get(rand.id);
              return (
                <RandTabel key={rand.id} href={`/inventar/${rand.id}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/inventar/${rand.id}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {rand.denumire}
                    </Link>
                    {rand.model !== null ? (
                      <span className="ml-2 text-xs text-muted-foreground">({rand.model})</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{rand.numar_inventar}</td>
                  <td className="px-4 py-3">
                    {rand.category_id === null ? "—" : (numeCategorii.get(rand.category_id) ?? "—")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_STATUS[rand.status]}`}
                    >
                      {ETICHETE_STATUS[rand.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_STARE[rand.stare]}`}
                    >
                      {ETICHETE_STARE[rand.stare]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {detinator === undefined ? "—" : (detinator.angajatNume ?? "—")}
                  </td>
                  <td className="px-4 py-3">{rand.valoare === null ? "—" : formatLei(rand.valoare)}</td>
                </RandTabel>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="mt-4 flex justify-end">
        {urmatorulCursor === null ? (
          <p className="text-sm text-muted-foreground">Aceasta este ultima pagină.</p>
        ) : (
          <Link
            href={`/inventar?${cautare.toString()}`}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm font-medium hover:bg-surface"
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaInventar({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "inventory");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);
  const scope = scopeFor(permisiuni, "inventory:read");

  if (scope === null || scope === "none") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evidența de inventar. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateScrie = can(permisiuni, "inventory:update", "all");
  const listaCategorii = await categorii();

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventar</h1>
          <p className="text-sm text-muted-foreground">
            {scope === "own"
              ? "Vedeți obiectele aflate acum în primirea dumneavoastră."
              : scope === "team"
                ? "Vedeți obiectele aflate acum în primirea echipei dumneavoastră."
                : "Evidența completă a obiectelor de inventar ale organizației."}
          </p>
        </div>
        {poateScrie ? (
          <Link
            href="/inventar/nou"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <PackagePlus aria-hidden="true" className="size-4" />
            Obiect nou
          </Link>
        ) : null}
      </header>

      <FiltreInventar categorii={listaCategorii} />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable cols={7} />}>
        <TabelInventar
          organizationId={tenant.organizationId}
          parametri={parametri}
          categorii={listaCategorii}
        />
      </Suspense>
    </main>
  );
}
