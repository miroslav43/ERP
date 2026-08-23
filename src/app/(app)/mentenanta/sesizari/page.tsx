// src/app/(app)/mentenanta/sesizari/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench } from "lucide-react";

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
import { formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { echipamenteDupaId, sesizari } from "@/lib/queries/maintenance";
import { filtreSesizariSchema } from "@/schemas/maintenance";

import {
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
} from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreSesizariForm } from "./filtre-sesizari";

export const metadata: Metadata = { title: "Sesizări de defecțiune" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelSesizari({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreSesizariSchema, parametri);
  const { randuri, urmatorulCursor } = await sesizari(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre =
      filtre.status !== null || filtre.urgenta !== null || filtre.echipament !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio sesizare înregistrată"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate sesizările."
            : "Sesizările apar aici pe măsură ce echipa raportează defecțiuni."
        }
        {...(areFiltre
          ? { actiune: { eticheta: "Șterge filtrele", href: "/mentenanta/sesizari" } }
          : {})}
      />
    );
  }

  const echipamente = await echipamenteDupaId(
    organizationId,
    randuri.map((r) => r.equipment_id),
  );

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
          <caption className="sr-only">Sesizările de defecțiune ale organizației.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Echipament
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Descriere
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Raportată la
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Urgență
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((sesizare) => {
              const echipament = echipamente.get(sesizare.equipment_id);
              return (
                <RandTabel key={sesizare.id} href={`/mentenanta/sesizari/${sesizare.id}`}>
                  <td className="px-4 py-3 font-medium">
                    {echipament === undefined
                      ? "Echipament necunoscut"
                      : `${echipament.cod} — ${echipament.denumire}`}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/mentenanta/sesizari/${sesizare.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {sesizare.descriere}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(sesizare.raportat_la)}</td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_URGENTA_SESIZARE[sesizare.urgenta]}>
                      {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_STATUS_SESIZARE[sesizare.status]}>
                      {ETICHETE_STATUS_SESIZARE[sesizare.status]}
                    </Badge>
                  </td>
                </RandTabel>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/mentenanta/sesizari?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaSesizari({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Sesizări de defecțiune"
        descriere="Defecțiunile raportate, cu starea lor de triaj și rezolvare."
        actiuni={
          <Link href="/mentenanta/sesizari/noua" className={buton({ varianta: "primar" })}>
            Sesizare nouă
          </Link>
        }
        file={<NavMentenanta />}
      />

      <FiltreSesizariForm />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelSesizari organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
