// src/app/(app)/ssm/stingatoare/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FireExtinguisher, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { stingatoare } from "@/lib/queries/ssm";
import { filtreStingatoareSchema } from "@/schemas/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import {
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_STINGATOR,
  TONURI_SCADENTA,
  TONURI_STATUS_STINGATOR,
} from "../etichete";
import { NavSsm } from "../nav-ssm";
import { FiltreStingatoare } from "./filtre-stingatoare";

export const metadata: Metadata = { title: "Stingătoare" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function CelulaScadenta({
  areInregistrare,
  data,
  scadenta,
  azi,
}: {
  readonly areInregistrare: boolean;
  readonly data: string | null;
  readonly scadenta: string | null;
  readonly azi: string;
}) {
  const stare = stareScadentaSsm(areInregistrare, scadenta, azi);
  return (
    <td className="px-4 py-3 whitespace-nowrap">
      <Badge ton={TONURI_SCADENTA[stare]} cuAvertisment={stare === "expirat"}>
        {ETICHETE_SCADENTA[stare]}
      </Badge>
      {data === null ? null : (
        <span className="text-muted-foreground text-nota ml-2">{formatDate(data)}</span>
      )}
    </td>
  );
}

async function TabelStingatoare({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreStingatoareSchema, parametri);
  const { randuri, urmatorulCursor } = await stingatoare(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.cauta !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={FireExtinguisher}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun stingător înregistrat"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate stingătoarele."
            : "Adăugați primul stingător ca să puteți urmări verificările, reîncărcările și probele de presiune."
        }
        actiune={
          areFiltre
            ? { eticheta: "Șterge filtrele", href: "/ssm/stingatoare" }
            : { eticheta: "Adaugă stingător", href: "/ssm/stingatoare/nou" }
        }
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
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
          <caption className="sr-only">
            Stingătoarele organizației, cu cele trei obligații de întreținere pe coloane distincte.
          </caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Cod
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Locație
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Verificare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Reîncărcare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Probă de presiune
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((s) => (
              <RandTabel key={s.id} href={`/ssm/stingatoare/${s.id}`}>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/ssm/stingatoare/${s.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {s.cod}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {s.locatie}
                  {s.cladire === null ? null : (
                    <span className="text-muted-foreground"> · {s.cladire}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge ton={TONURI_STATUS_STINGATOR[s.status]}>
                    {ETICHETE_STATUS_STINGATOR[s.status]}
                  </Badge>
                </td>
                <CelulaScadenta
                  areInregistrare={s.ultima_verificare !== null}
                  data={s.ultima_verificare}
                  scadenta={s.scadenta_verificare}
                  azi={azi}
                />
                <CelulaScadenta
                  areInregistrare={s.ultima_reincarcare !== null}
                  data={s.ultima_reincarcare}
                  scadenta={s.scadenta_reincarcare}
                  azi={azi}
                />
                <CelulaScadenta
                  areInregistrare={s.ultima_proba_presiune !== null}
                  data={s.ultima_proba_presiune}
                  scadenta={s.scadenta_proba_presiune}
                  azi={azi}
                />
              </RandTabel>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/ssm/stingatoare?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaStingatoare({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta stingătoarele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "ssm:create", "team");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Stingătoare"
        descriere="Verificarea tehnică, reîncărcarea și proba de presiune — trei obligații cu periodicități diferite."
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/ssm/stingatoare/nou" className={buton({ varianta: "primar" })}>
                  <Plus aria-hidden="true" className="size-4" />
                  Stingător nou
                </Link>
              ),
            }
          : {})}
        file={
          <NavSsm
            poateVedeaInstruiri={
              can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")
            }
            poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
            poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
            poateVedeaStingatoare
            poateVedeaEip={can(permisiuni, "ssm:read", "team")}
            poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
          />
        }
      />

      <FiltreStingatoare />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelStingatoare organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
