// src/app/(app)/angajati/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { UserPlus, Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { idFisaProprie, listeazaAngajati } from "@/lib/queries/employees";
import { filtreAngajatiSchema } from "@/schemas/employee";

import { ETICHETE_STATUS, TONURI_STATUS } from "./etichete";
import { FiltreAngajati } from "./filtre-angajati";

export const metadata: Metadata = { title: "Angajați" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ProprietatiTabel {
  readonly organizationId: string;
  readonly scope: "own" | "team" | "all";
  readonly userId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}

async function TabelAngajati({ organizationId, scope, userId, parametri }: ProprietatiTabel) {
  const filtre = filtreAngajatiSchema.parse(parametri);
  const propriaFisaId = scope === "all" ? null : await idFisaProprie(organizationId, userId);
  const { randuri, urmatorulCursor } = await listeazaAngajati({
    organizationId,
    scope,
    propriaFisaId,
    filtre,
  });

  if (randuri.length === 0) {
    // Textul recomandă ștergerea filtrelor, deci butonul trebuie să existe —
    // dar numai când chiar există filtre de șters.
    const areFiltre =
      filtre.q !== null ||
      filtre.department_id !== null ||
      filtre.job_position_id !== null ||
      filtre.status !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Users}
        titlu="Niciun angajat găsit"
        descriere="Nu există fișe care să corespundă filtrelor alese. Ștergeți filtrele sau adăugați primul angajat."
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/angajati" } } : {})}
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
        <table className="text-corp w-full text-left">
          <caption className="sr-only">Lista angajaților din organizație</caption>
          <thead className="bg-surface text-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Fotografie</span>
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Marcă
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Nume și prenume
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Departament
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Funcție
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Angajat din
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((rand) => (
              <RandTabel key={rand.id} href={`/angajati/${rand.id}`}>
                <td className="px-4 py-3">
                  <AvatarAngajat url={rand.avatar_url} nume={rand.full_name} marime="sm" />
                </td>
                <td className="text-nota px-4 py-3 font-mono">{rand.marca}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/angajati/${rand.id}`}
                    className="text-primary font-medium underline-offset-2 hover:underline"
                  >
                    {rand.full_name}
                  </Link>
                  {!rand.is_primary ? (
                    <span className="text-muted-foreground text-nota ml-2">(cumul de funcții)</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{rand.department?.denumire ?? "—"}</td>
                <td className="px-4 py-3">{rand.job_position?.denumire ?? "—"}</td>
                <td className="px-4 py-3">
                  {rand.hired_on === null ? "—" : formatDate(rand.hired_on)}
                </td>
                <td className="px-4 py-3">
                  <Badge ton={TONURI_STATUS[rand.status]}>{ETICHETE_STATUS[rand.status]}</Badge>
                </td>
              </RandTabel>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Paginare" className="mt-4 flex justify-end">
        {urmatorulCursor === null ? (
          <p className="text-muted-foreground text-corp">Aceasta este ultima pagină.</p>
        ) : (
          <Link
            href={`/angajati?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaAngajati({ searchParams }: ProprietatiPagina) {
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "employees:read");

  if (scope === null || scope === "none") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evidența de personal. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = scopeFor(permisiuni, "employees:create") === "all";

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Angajați"
        descriere={
          scope === "own"
            ? "Vedeți propria fișă de personal."
            : scope === "team"
              ? "Vedeți fișele angajaților din subordinea dumneavoastră."
              : "Evidența completă de personal a organizației."
        }
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/angajati/nou" className={buton({ varianta: "primar" })}>
                  <UserPlus aria-hidden="true" className="size-4" />
                  Angajat nou
                </Link>
              ),
            }
          : {})}
      />

      <FiltreAngajati />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={7} />}>
        <TabelAngajati
          organizationId={tenant.organizationId}
          scope={scope}
          userId={utilizator.id}
          parametri={parametri}
        />
      </Suspense>
    </div>
  );
}
