// src/app/(app)/onboarding/sabloane/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FilePlus2, ListChecks } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Buton, buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { scrieSortare } from "@/lib/queries/cursor";
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
  const { randuri, urmatorulCursor, total, sortare } = await listeazaSabloane(
    organizationId,
    filtre,
  );

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

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge căutarea și filtrul de tip.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/onboarding/sabloane" : `/onboarding/sabloane?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "denumire",
      antet: "Denumire",
      sortabil: true,
      peTelefon: "titlu",
      celula: (s) => <span className="font-medium">{s.denumire}</span>,
    },
    {
      cheie: "tip",
      antet: "Tip",
      sortabil: true,
      peTelefon: "meta",
      celula: (s) => ETICHETE_TIP[s.tip],
    },
    {
      cheie: "valabil",
      antet: "Valabil de la",
      sortabil: true,
      peTelefon: "meta",
      celula: (s) => formatDate(s.valabil_de_la),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      // Pastila avea AMBELE ramuri identice (`bg-surface text-foreground`), deci
      // „Activ" și „Dezactivat" arătau la fel. `Badge` le separă prin bulină,
      // fără să se sprijine doar pe culoare.
      celula: (s) =>
        s.activ ? <Badge ton="succes">Activ</Badge> : <Badge ton="neutru">Dezactivat</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Șabloanele de checklist ale organizației."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(s) => s.id}
        href={(s) => `/onboarding/sabloane/${s.id}`}
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

export default async function PaginaSabloane({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "onboarding"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

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
