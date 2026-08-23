// src/app/(app)/ssm/medicina-muncii/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Stethoscope } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { angajatiDupaId, fiseAptitudine } from "@/lib/queries/ssm";
import { filtreFiseSchema } from "@/schemas/ssm";

import { ETICHETE_REZULTAT_EXAMEN, ETICHETE_TIP_EXAMEN, TONURI_REZULTAT_EXAMEN } from "../etichete";
import { NavSsm } from "../nav-ssm";

export const metadata: Metadata = { title: "Medicina muncii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelFise({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreFiseSchema, parametri);
  const { randuri, urmatorulCursor } = await fiseAptitudine(organizationId, filtre);

  if (randuri.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={Stethoscope}
        titlu="Nicio fișă de aptitudine înregistrată"
        descriere="Adăugați prima fișă ca să urmăriți valabilitatea controalelor medicale periodice."
        actiune={{ eticheta: "Fișă nouă", href: "/ssm/medicina-muncii/noua" }}
      />
    );
  }

  const angajati = await angajatiDupaId(
    organizationId,
    randuri.map((f) => f.employee_id),
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
          <caption className="sr-only">Fișele de aptitudine la care aveți acces.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Angajat
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Data examinării
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Valabilă până la
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Rezultat
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((f) => {
              const angajat = angajati.get(f.employee_id);
              return (
                <tr key={f.id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
                  </td>
                  <td className="px-4 py-3">{ETICHETE_TIP_EXAMEN[f.tip]}</td>
                  <td className="px-4 py-3">{formatDate(f.data_examinarii)}</td>
                  <td className="px-4 py-3">
                    {f.valabil_pana === null ? "—" : formatDate(f.valabil_pana)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_REZULTAT_EXAMEN[f.rezultat]}>
                      {ETICHETE_REZULTAT_EXAMEN[f.rezultat]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="flex justify-end">
        {urmatorulCursor === null ? null : (
          <Link
            href={`/ssm/medicina-muncii?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaMedicinaMuncii({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta dosarele de medicina muncii. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "ssm:create", "team");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Medicina muncii"
        descriere="Fișele de aptitudine. Diagnosticul nu se stochează — doar rezultatul."
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/ssm/medicina-muncii/noua" className={buton({ varianta: "primar" })}>
                  <Plus aria-hidden="true" className="size-4" />
                  Fișă nouă
                </Link>
              ),
            }
          : {})}
        file={
          <NavSsm
            poateVedeaInstruiri={
              can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")
            }
            poateVedeaMedicina
            poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
            poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
            poateVedeaEip={can(permisiuni, "ssm:read", "team")}
            poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
          />
        }
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelFise organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
