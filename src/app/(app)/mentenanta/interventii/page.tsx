// src/app/(app)/mentenanta/interventii/page.tsx
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
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { echipamenteDupaId, interventii } from "@/lib/queries/maintenance";
import { filtreInterventiiSchema } from "@/schemas/maintenance";

import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_TIP_MENTENANTA,
  TONURI_REZULTAT_INTERVENTIE,
} from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreInterventiiForm } from "./filtre-interventii";

export const metadata: Metadata = { title: "Intervenții de mentenanță" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelInterventii({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreInterventiiSchema, parametri);
  const { randuri, urmatorulCursor } = await interventii(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.tip !== null || filtre.rezultat !== null || filtre.echipament !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={
          areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio intervenție înregistrată"
        }
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate intervențiile."
            : "Intervențiile se adaugă din fișa fiecărui echipament, sau la rezolvarea unei sesizări."
        }
        {...(areFiltre
          ? { actiune: { eticheta: "Șterge filtrele", href: "/mentenanta/interventii" } }
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
          <caption className="sr-only">Intervențiile de mentenanță ale organizației.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Data
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Echipament
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Descriere
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Cost total
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Rezultat
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((interventie) => {
              const echipament = echipamente.get(interventie.equipment_id);
              return (
                <RandTabel
                  key={interventie.id}
                  href={
                    echipament === undefined
                      ? null
                      : `/mentenanta/echipamente/${interventie.equipment_id}`
                  }
                >
                  <td className="px-4 py-3">{formatDate(interventie.data)}</td>
                  <td className="px-4 py-3">
                    {echipament === undefined ? (
                      "—"
                    ) : (
                      <Link
                        href={`/mentenanta/echipamente/${interventie.equipment_id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {echipament.cod} — {echipament.denumire}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">{ETICHETE_TIP_MENTENANTA[interventie.tip]}</td>
                  <td className="px-4 py-3">{interventie.descriere}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatLei(
                      interventie.cost_total ?? interventie.cost_piese + interventie.cost_manopera,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_REZULTAT_INTERVENTIE[interventie.rezultat]}>
                      {ETICHETE_REZULTAT_INTERVENTIE[interventie.rezultat]}
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
            href={`/mentenanta/interventii?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaInterventii({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta intervențiile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Intervenții de mentenanță"
        descriere="Istoricul intervențiilor, cu costurile lor. Se adaugă din fișa fiecărui echipament."
        file={<NavMentenanta />}
      />

      <FiltreInterventiiForm />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelInterventii organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
