// src/app/(app)/mentenanta/echipamente/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench, WrenchIcon } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { listeazaEchipamente } from "@/lib/queries/maintenance";
import { filtreEchipamenteSchema } from "@/schemas/maintenance";

import { ETICHETE_STATUS_ECHIPAMENT, TONURI_STATUS_ECHIPAMENT } from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreEchipamenteForm } from "./filtre-echipamente";

export const metadata: Metadata = { title: "Echipamente" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelEchipamente({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreEchipamenteSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaEchipamente(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.cauta !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={
          areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun echipament înregistrat"
        }
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți tot parcul de echipamente."
            : "Adăugați primul echipament ca să puteți urmări mentenanța și autorizațiile ISCIR."
        }
        {...(areFiltre
          ? { actiune: { eticheta: "Șterge filtrele", href: "/mentenanta/echipamente" } }
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
          <caption className="sr-only">Echipamentele organizației.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Cod
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Denumire
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Locație
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                ISCIR
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((echipament) => (
              <RandTabel key={echipament.id} href={`/mentenanta/echipamente/${echipament.id}`}>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/mentenanta/echipamente/${echipament.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {echipament.cod}
                  </Link>
                </td>
                <td className="px-4 py-3">{echipament.denumire}</td>
                <td className="px-4 py-3">{echipament.locatie ?? "—"}</td>
                <td className="px-4 py-3">
                  {echipament.este_iscir ? (
                    <WrenchIcon
                      aria-label="Sub incidența ISCIR"
                      className="text-foreground size-4"
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge ton={TONURI_STATUS_ECHIPAMENT[echipament.status]}>
                    {ETICHETE_STATUS_ECHIPAMENT[echipament.status]}
                  </Badge>
                </td>
              </RandTabel>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/mentenanta/echipamente?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaEchipamente({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta echipamentele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateAdauga = can(permisiuni, "maintenance:update", "team");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Echipamente"
        descriere="Parcul de echipamente al organizației, cu starea și acoperirea ISCIR."
        {...(poateAdauga
          ? {
              actiuni: (
                <Link href="/mentenanta/echipamente/nou" className={buton({ varianta: "primar" })}>
                  Echipament nou
                </Link>
              ),
            }
          : {})}
        file={<NavMentenanta />}
      />

      <FiltreEchipamenteForm />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelEchipamente organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
