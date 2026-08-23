// src/app/(app)/onboarding/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, ListChecks } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { scrieSortare } from "@/lib/queries/cursor";
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
  const { randuri, urmatorulCursor, total, sortare } = await listeazaInstante(
    organizationId,
    filtre,
  );

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

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge filtrele, iar o schimbare de mărime a paginii ar
   * șterge sortarea.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/onboarding" : `/onboarding?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      // Numele vine dintr-o a doua citire, nu din `order by`-ul listei: nu se
      // poate sorta după el fără să rupă cursorul keyset.
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (r) => {
        const angajat = angajati.get(r.employee_id);
        return angajat === undefined
          ? "—"
          : `${angajat.full_name ?? angajat.marca} (${angajat.marca})`;
      },
    },
    {
      cheie: "tip",
      antet: "Tip",
      sortabil: true,
      peTelefon: "meta",
      celula: (r) => ETICHETE_TIP[r.tip],
    },
    {
      cheie: "data",
      antet: "Data de referință",
      sortabil: true,
      peTelefon: "meta",
      celula: (r) => formatDate(r.data_referinta),
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (r) => (
        <Badge ton={TONURI_STATUS_INSTANTA[r.status]}>{ETICHETE_STATUS_INSTANTA[r.status]}</Badge>
      ),
    },
    {
      cheie: "progres",
      antet: "Progres",
      peTelefon: "meta",
      celula: (r) => {
        const p = progres.get(r.id) ?? { total: 0, gata: 0, procent: 0 };
        return (
          // `<span>`, nu `<div>`: pe telefon celula ajunge în rândul de meta,
          // care e un `<p>` — un `<div>` acolo ar fi marcaj nevalid.
          <span className="inline-flex items-center gap-2">
            <progress
              value={p.procent}
              max={100}
              aria-label={`${String(p.gata)} din ${String(p.total)} pași finalizați`}
              className="h-2 w-24 accent-blue-700"
            />
            <span className="text-muted-foreground text-nota">
              {p.gata} din {p.total} pași
            </span>
          </span>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Instanțele de checklist la care aveți acces."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(r) => r.id}
        href={(r) => `/onboarding/${r.id}`}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul nu supraviețuiește unei schimbări de sortare: ar continua
            // de la un rând care, în noua ordine, nu mai e acolo unde era.
            p.delete("cursor");
          })
        }
        gol={null}
      />
      <Paginare
        afisate={randuri.length}
        total={total}
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
    </div>
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
