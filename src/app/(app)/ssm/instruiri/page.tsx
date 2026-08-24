// src/app/(app)/ssm/instruiri/page.tsx
import { treaptaSsm } from "@/domain/ssm/scadente";
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Scadenta } from "@/components/ui/scadenta";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { idFisaProprie } from "@/lib/queries/employees";
import { cheieMatrice, matriceInstruiri, periodicitati, tipuriInstruire } from "@/lib/queries/ssm";
import { filtreInstruiriSchema } from "@/schemas/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import { ETICHETE_DOMENIU, ETICHETE_SCADENTA } from "../etichete";
import { NavSsm } from "../nav-ssm";
import { FiltreInstruiri } from "./filtre-instruiri";

export const metadata: Metadata = { title: "Instruiri SSM/PSI" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function Matrice({
  organizationId,
  userId,
  scope,
  parametri,
}: {
  readonly organizationId: string;
  readonly userId: string;
  readonly scope: "team" | "all";
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreInstruiriSchema, parametri);
  const propriaFisaId = await idFisaProprie(organizationId, userId);

  const [{ angajati, urmatorulCursor, celeMaiRecente }, tipuriToate, perioade] = await Promise.all([
    matriceInstruiri({
      organizationId,
      scope,
      propriaFisaId,
      filtre: {
        q: filtre.q,
        department_id: null,
        job_position_id: null,
        status: "activ",
        cursor: filtre.cursor,
        limita: filtre.limita,
        // Matricea de instruiri își impune propria ordine (angajat × tip), deci
        // sortarea din lista de angajați nu i se aplică.
        sort: null,
      },
    }),
    tipuriInstruire(organizationId),
    periodicitati(organizationId),
  ]);

  const tipuri = tipuriToate.filter((t) => t.domeniu === filtre.domeniu);
  const perioadaDupaTip = new Map(perioade.map((p) => [p.training_type_id, p]));

  if (angajati.length === 0) {
    const areFiltre = filtre.q !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={GraduationCap}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun angajat de afișat"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toți angajații."
            : "Nu aveți acces la niciun angajat activ în acest scop."
        }
        {...(areFiltre
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                href: `/ssm/instruiri?domeniu=${filtre.domeniu}`,
              },
            }
          : {})}
      />
    );
  }

  if (tipuri.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={GraduationCap}
        titlu="Niciun tip de instruire configurat pentru acest domeniu"
        descriere="Nomenclatorul de tipuri de instruire se completează de administratorul organizației."
      />
    );
  }

  const azi = todayInBucharest();

  /**
   * Adresa se construiește din parametrii EXISTENȚI: matricea are un tab
   * obligatoriu SSM/PSI, iar o pagină nouă n-are voie să-l piardă.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/ssm/instruiri" : `/ssm/instruiri?${p.toString()}`;
  }

  /*
   * Matricea NU trece pe `<Tabel>`: numărul ei de coloane e DINAMIC — o coloană
   * per tip de instruire configurat pentru domeniul ales — iar `<Tabel>` cere o
   * listă statică de coloane, cu antet și celulă declarate pentru fiecare. Tot
   * dinamice sunt și antetele (denumirea tipului plus periodicitatea în luni).
   * Ce s-a putut împrumuta — paginarea cu numărătoare și mărime de pagină — s-a
   * împrumutat; căderea pe card sub 768px n-are sens pentru o matrice, care se
   * citește pe orizontală, deci rămâne derularea orizontală, singura de acest
   * fel din modul.
   */
  return (
    <>
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
          <caption className="sr-only">
            Matricea de instruiri {ETICHETE_DOMENIU[filtre.domeniu]}, angajați × tipuri.
          </caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="bg-surface sticky left-0 px-4 py-3 font-medium">
                Angajat
              </th>
              {tipuri.map((tip) => {
                const perioada = perioadaDupaTip.get(tip.id);
                return (
                  <th key={tip.id} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                    {tip.denumire}
                    {perioada?.periodicitate_luni === null ||
                    perioada?.periodicitate_luni === undefined
                      ? null
                      : ` (${String(perioada.periodicitate_luni)} luni)`}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {angajati.map((angajat) => (
              <tr key={angajat.id} className="hover:bg-surface">
                <td className="bg-background sticky left-0 px-4 py-3 font-medium whitespace-nowrap">
                  {angajat.full_name}
                </td>
                {tipuri.map((tip) => {
                  const rand = celeMaiRecente.get(cheieMatrice(angajat.id, tip.id));
                  const scadenta = rand?.urmatoarea_scadenta ?? null;
                  const stare = stareScadentaSsm(rand !== undefined, scadenta, azi);
                  return (
                    <td key={tip.id} className="px-4 py-3 whitespace-nowrap">
                      <Scadenta treapta={treaptaSsm(stare, scadenta)}>
                        {ETICHETE_SCADENTA[stare]}
                      </Scadenta>
                      {rand === undefined ? null : (
                        <span className="text-muted-foreground text-nota ml-2">
                          {formatDate(rand.data_instruirii)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginare
        afisate={angajati.length}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa((p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </>
  );
}

export default async function PaginaInstruiri({ searchParams }: ProprietatiPagina) {
  const user = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // Matricea are nevoie ȘI de dreptul de a citi instruirile, ȘI de dreptul de
  // a citi lista de angajați — fără al doilea, coloana „Angajat" n-ar putea fi
  // construită deloc.
  if (!can(permisiuni, "ssm:read", "team") || !can(permisiuni, "employees:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Matricea de instruiri cere atât dreptul de a consulta SSM, cât și dreptul de a consulta lista de angajați, la nivel de echipă. Solicitați administratorului organizației rolurile potrivite." />
    );
  }

  const parametri = await searchParams;
  // Gata garantat prin poarta de mai sus: scope-ul e mereu „team" sau „all".
  const scopeAngajati: "team" | "all" =
    scopeFor(permisiuni, "employees:read") === "all" ? "all" : "team";
  const poateCrea = can(permisiuni, "ssm:create", "team");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Instruiri"
        descriere="Matricea angajați × tipuri de instruire, cu cea mai recentă efectuare."
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/ssm/instruiri/noua" className={buton({ varianta: "primar" })}>
                  <Plus aria-hidden="true" className="size-4" />
                  Instruire nouă
                </Link>
              ),
            }
          : {})}
        file={
          <NavSsm
            poateVedeaInstruiri
            poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
            poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
            poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
            poateVedeaEip={can(permisiuni, "ssm:read", "team")}
            poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
          />
        }
      />

      <FiltreInstruiri />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <Matrice
          organizationId={tenant.organizationId}
          userId={user.id}
          scope={scopeAngajati}
          parametri={parametri}
        />
      </Suspense>
    </div>
  );
}
