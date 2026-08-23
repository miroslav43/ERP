// src/app/(app)/onboarding/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, ListChecks } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { RandTabel } from "@/components/data/rand-tabel";
import { Schelet } from "@/components/ui/schelet";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  angajatiActivi,
  angajatiDupaId,
  listeazaInstante,
  progresInstante,
  type AngajatRezumat,
} from "@/lib/queries/checklist";
import { filtreInstanteSchema } from "@/schemas/checklist";

import { TONURI_STATUS_INSTANTA, ETICHETE_STATUS_INSTANTA, ETICHETE_TIP } from "./etichete";
import { FiltreInstante } from "./filtre-instante";
import { NavOnboarding } from "./nav-onboarding";

export const metadata: Metadata = { title: "Onboarding" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelInstante({
  organizationId,
  parametri,
  poateVedeaAngajati,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly poateVedeaAngajati: boolean;
}) {
  const filtre = filtreDinUrl(filtreInstanteSchema, parametri);
  const { randuri, urmatorulCursor } = await listeazaInstante(organizationId, filtre);

  if (randuri.length === 0) {
    // Mesajul diferă după cauză: „nimic încă" cere o acțiune (pornirea unui
    // checklist), „niciun rezultat" cere doar ștergerea filtrelor.
    const areFiltre =
      filtre.tip !== null ||
      (filtre.status !== null && filtre.status.length > 0) ||
      filtre.angajat !== null ||
      filtre.de_la !== null ||
      filtre.pana_la !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={ClipboardList}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun checklist pornit încă"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate instanțele."
            : "Porniți un checklist de integrare sau de ieșire pentru un angajat, dintr-un șablon."
        }
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/onboarding" } } : {})}
      />
    );
  }

  const [progres, angajati] = await Promise.all([
    progresInstante(randuri.map((r) => r.id)),
    poateVedeaAngajati
      ? angajatiDupaId(
          organizationId,
          randuri.map((r) => r.employee_id),
        )
      : Promise.resolve(new Map<string, AngajatRezumat>()),
  ]);

  const cautare = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && cheie !== "cursor") cautare.set(cheie, valoare);
  }
  if (urmatorulCursor !== null) cautare.set("cursor", urmatorulCursor);

  return (
    <>
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
          <caption className="sr-only">Instanțele de checklist la care aveți acces.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Angajat
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Tip
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Data de referință
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stare
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Progres
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {randuri.map((r) => {
              const angajat = angajati.get(r.employee_id);
              const p = progres.get(r.id) ?? { total: 0, gata: 0, procent: 0 };
              return (
                <RandTabel key={r.id} href={`/onboarding/${r.id}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/onboarding/${r.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {angajat === undefined
                        ? "—"
                        : `${angajat.full_name ?? angajat.marca} (${angajat.marca})`}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{ETICHETE_TIP[r.tip]}</td>
                  <td className="px-4 py-3">{formatDate(r.data_referinta)}</td>
                  <td className="px-4 py-3">
                    <Badge ton={TONURI_STATUS_INSTANTA[r.status]}>
                      {ETICHETE_STATUS_INSTANTA[r.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <progress
                        value={p.procent}
                        max={100}
                        aria-label={`${String(p.gata)} din ${String(p.total)} pași finalizați`}
                        className="h-2 w-24 accent-blue-700"
                      />
                      <span className="text-muted-foreground text-nota">
                        {p.gata} din {p.total} pași
                      </span>
                    </div>
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
            href={`/onboarding?${cautare.toString()}`}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
          </Link>
        )}
      </nav>
    </>
  );
}

export default async function PaginaOnboarding({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // `can(..., "own")` și nu `scopeFor(...) !== null`: scope-ul „none" e refuz
  // explicit ȘI e truthy, deci a doua formă ar lăsa poarta deschisă. RLS dă
  // fiecărui angajat propriile instanțe, deci scope-ul minim „own" e corect
  // aici, deși meniul cere „team" pentru a arăta fila.
  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta checklisturile de integrare. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const scope = scopeFor(permisiuni, "checklists:read");
  const poatePorni = can(permisiuni, "checklists:create", "all");
  const poateVedeaAngajati = can(permisiuni, "employees:read", "team");

  const angajati = poateVedeaAngajati ? await angajatiActivi(tenant.organizationId) : null;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Onboarding"
        descriere={
          scope === "all" || scope === "team"
            ? "Checklisturile de integrare și de ieșire ale organizației, cu progresul lor."
            : "Checklistul dvs. de integrare, cu progresul lui."
        }
        {...(poatePorni
          ? {
              actiuni: (
                <Link href="/onboarding/noua" className={buton({ varianta: "primar" })}>
                  <ListChecks aria-hidden="true" className="size-4" />
                  Instanță nouă
                </Link>
              ),
            }
          : {})}
        file={<NavOnboarding />}
      />

      <FiltreInstante angajati={angajati} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelInstante
          organizationId={tenant.organizationId}
          parametri={parametri}
          poateVedeaAngajati={poateVedeaAngajati}
        />
      </Suspense>
    </div>
  );
}
