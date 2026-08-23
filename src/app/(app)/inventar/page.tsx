// src/app/(app)/inventar/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Package, PackagePlus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { alocariDeschise, categorii, listeazaObiecte } from "@/lib/queries/inventory";
import { filtreInventarSchema } from "@/schemas/inventory";

import { ETICHETE_STARE, ETICHETE_STATUS, TONURI_STARE, TONURI_STATUS } from "./etichete";
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

async function TabelInventar({
  organizationId,
  parametri,
  categorii: listaCategorii,
}: ProprietatiTabel) {
  const filtre = filtreDinUrl(filtreInventarSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaObiecte(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre =
      filtre.q !== null ||
      filtre.numar !== null ||
      filtre.status !== null ||
      filtre.stare !== null ||
      filtre.category_id !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Package}
        titlu="Niciun obiect găsit"
        descriere="Nu există obiecte de inventar care să corespundă filtrelor alese. Ștergeți filtrele sau adăugați primul obiect."
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/inventar" } } : {})}
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
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full text-left">
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
          <tbody className="divide-border divide-y">
            {randuri.map((rand) => {
              const detinator = detinatori.get(rand.id);
              return (
                <RandTabel key={rand.id} href={`/inventar/${rand.id}`}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/inventar/${rand.id}`}
                      className="text-primary font-medium underline-offset-2 hover:underline"
                    >
                      {rand.denumire}
                    </Link>
                    {rand.model !== null ? (
                      <span className="text-muted-foreground text-nota ml-2">({rand.model})</span>
                    ) : null}
                  </td>
                  <td className="text-nota px-4 py-3 font-mono">{rand.numar_inventar}</td>
                  <td className="px-4 py-3">
                    {rand.category_id === null ? "—" : (numeCategorii.get(rand.category_id) ?? "—")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_STATUS[rand.status]}>{ETICHETE_STATUS[rand.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_STARE[rand.stare]}>{ETICHETE_STARE[rand.stare]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {detinator === undefined ? "—" : (detinator.angajatNume ?? "—")}
                  </td>
                  <td className="px-4 py-3">
                    {rand.valoare === null ? "—" : formatLei(rand.valoare)}
                  </td>
                </RandTabel>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="mt-4 flex justify-end">
        {urmatorulCursor === null ? (
          <p className="text-muted-foreground text-corp">Aceasta este ultima pagină.</p>
        ) : (
          <Link
            href={`/inventar?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
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
    <div className="space-y-6">
      <AntetPagina
        titlu="Inventar"
        descriere={
          scope === "own"
            ? "Vedeți obiectele aflate acum în primirea dumneavoastră."
            : scope === "team"
              ? "Vedeți obiectele aflate acum în primirea echipei dumneavoastră."
              : "Evidența completă a obiectelor de inventar ale organizației."
        }
        {...(poateScrie
          ? {
              actiuni: (
                <Link href="/inventar/nou" className={buton({ varianta: "primar" })}>
                  <PackagePlus aria-hidden="true" className="size-4" />
                  Obiect nou
                </Link>
              ),
            }
          : {})}
      />

      <FiltreInventar categorii={listaCategorii} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={7} />}>
        <TabelInventar
          organizationId={tenant.organizationId}
          parametri={parametri}
          categorii={listaCategorii}
        />
      </Suspense>
    </div>
  );
}
