// src/app/(app)/onboarding/sabloane/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FilePlus2, ListChecks } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Buton, buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
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
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={ListChecks}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun șablon creat încă"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate șabloanele."
            : "Creați primul șablon ca să puteți porni instanțe de checklist pentru angajați."
        }
        {...(areFiltre
          ? { actiune: { eticheta: "Șterge filtrele", href: "/onboarding/sabloane" } }
          : {})}
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
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
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
          <tbody className="divide-border divide-y">
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
                    className={`text-nota rounded px-2 py-0.5 font-medium ${
                      s.activ ? "bg-surface text-foreground" : "bg-surface text-foreground"
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
            className={buton({ varianta: "secundar" })}
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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
    <div className="space-y-6">
      <AntetPagina
        titlu="Șabloane de checklist"
        descriere="Structura pașilor pentru integrare, ieșire sau transfer."
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/onboarding/sabloane/nou" className={buton({ varianta: "primar" })}>
                  <FilePlus2 aria-hidden="true" className="size-4" />
                  Șablon nou
                </Link>
              ),
            }
          : {})}
        file={<NavOnboarding />}
      />

      {/* Formular simplu, fără JavaScript: GET direct pe query string. */}
      <form
        method="get"
        className="border-border rounded-panou flex flex-wrap items-end gap-3 border p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="cauta" className="text-corp font-medium">
            Denumire
          </label>
          <input
            id="cauta"
            name="cauta"
            type="search"
            defaultValue={cautaCurent}
            className="border-foreground/60 text-corp rounded-control border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tip" className="text-corp font-medium">
            Tip
          </label>
          <select
            id="tip"
            name="tip"
            defaultValue={tipCurent}
            className="border-foreground/60 text-corp rounded-control border px-3 py-2"
          >
            <option value="">Toate</option>
            {CHECKLIST_TIP.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP[t]}
              </option>
            ))}
          </select>
        </div>
        <Buton type="submit" varianta="secundar">
          Filtrează
        </Buton>
      </form>

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={4} />}>
        <TabelSabloane organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
