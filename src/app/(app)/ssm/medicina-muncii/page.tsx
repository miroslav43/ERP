// src/app/(app)/ssm/medicina-muncii/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Stethoscope } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Scadenta } from "@/components/ui/scadenta";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { angajatiDupaId, fiseAptitudine, restrictiiActive } from "@/lib/queries/ssm";
import { filtreFiseSchema } from "@/schemas/ssm";
import { stareScadentaSsm, treaptaSsm } from "@/domain/ssm/scadente";

import {
  ETICHETE_REZULTAT_EXAMEN,
  ETICHETE_SCADENTA,
  ETICHETE_TIP_EXAMEN,
  TONURI_REZULTAT_EXAMEN,
} from "../etichete";
import { NavSsm } from "../nav-ssm";

export const metadata: Metadata = { title: "Medicina muncii" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Restricțiile de muncă active — informația care decide dacă cineva are voie să
 * lucreze azi.
 *
 * `restrictiiActive` era scrisă, testată și apelată dintr-un SINGUR loc:
 * `dosarul-meu.tsx`, ecranul pe care rolul `employee` nu-l poate atinge
 * (`(app)/layout.tsx` îl redirecționează spre portal). Adică: nici responsabilul
 * SSM, nici HR-ul nu vedeau nicăieri, în aplicația de firmă, cine e „inapt
 * temporar". Un „inapt" invizibil pe ecranul celui care face programările nu e
 * o problemă de interfață, e una de siguranță.
 *
 * Restricțiile le scrie singur triggerul `internal.ssm_exam_sync` la fiecare
 * rezultat diferit de „apt", deci banda se umple fără nicio acțiune nouă.
 */
async function BandaRestrictii({ organizationId }: { readonly organizationId: string }) {
  const restrictii = await restrictiiActive(organizationId);
  if (restrictii.length === 0) return null;

  const angajati = await angajatiDupaId(
    organizationId,
    restrictii.map((r) => r.employee_id),
  );

  return (
    <Callout
      fel="atentie"
      titlu={`${String(restrictii.length)} ${restrictii.length === 1 ? "angajat are" : "angajați au"} restricții de muncă active`}
    >
      <ul className="mt-1 space-y-1">
        {restrictii.map((r) => {
          const angajat = angajati.get(r.employee_id);
          return (
            <li key={r.id}>
              <span className="font-medium">
                {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
              </span>
              {" · "}
              {r.restrictie}
              <span className="text-muted-foreground">
                {" · din "}
                {formatDate(r.valabil_de_la)}
                {r.valabil_pana === null
                  ? ", fără termen"
                  : ` până la ${formatDate(r.valabil_pana)}`}
              </span>
            </li>
          );
        })}
      </ul>
      {/* `restrictiiActive` citește cel mult 200 de rânduri. La fix 200 nu se
          poate ști dacă urmau altele — se spune, nu se tace. */}
      {restrictii.length === 200 ? (
        <p className="text-muted-foreground text-nota mt-1">
          Lista e tăiată la primele 200 de restricții.
        </p>
      ) : null}
    </Callout>
  );
}

async function TabelFise({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreFiseSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await fiseAptitudine(organizationId, filtre);

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
  const azi = todayInBucharest();

  /** Adresele pornesc de la parametrii EXISTENȚI — altfel o sortare ar șterge filtrul de rezultat. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/ssm/medicina-muncii" : `/ssm/medicina-muncii?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (f) => {
        const angajat = angajati.get(f.employee_id);
        return angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`;
      },
    },
    {
      cheie: "tip",
      antet: "Tip",
      sortabil: true,
      peTelefon: "meta",
      celula: (f) => ETICHETE_TIP_EXAMEN[f.tip],
    },
    {
      cheie: "data",
      antet: "Data examinării",
      sortabil: true,
      peTelefon: "meta",
      latime: "ingusta",
      celula: (f) => formatDate(f.data_examinarii),
    },
    {
      // Coloana afișa o dată brută pe EXACT valoarea pe care `contorFiseAptitudine`
      // o numără ca urgență pe panou: cardul spunea „14 de atenționat", iar
      // ecranul deschis din el nu marca niciun rând. `stareScadentaSsm` era deja
      // folosită pe /ssm, /ssm/stingatoare și /ssm/autorizatii — aici lipsea.
      cheie: "valabil",
      antet: "Valabilă până la",
      peTelefon: "meta",
      celula: (f) => {
        if (f.valabil_pana === null) {
          return <Scadenta treapta="neaplicabil">Fără termen</Scadenta>;
        }
        const stare = stareScadentaSsm(true, f.valabil_pana, azi);
        return (
          <span className="whitespace-nowrap">
            <Scadenta treapta={treaptaSsm(stare, f.valabil_pana)}>
              {ETICHETE_SCADENTA[stare]}
            </Scadenta>
            <span className="text-muted-foreground text-nota ml-2">
              {formatDate(f.valabil_pana)}
            </span>
          </span>
        );
      },
    },
    {
      cheie: "rezultat",
      antet: "Rezultat",
      sortabil: true,
      peTelefon: "insigna",
      celula: (f) => (
        <Badge ton={TONURI_REZULTAT_EXAMEN[f.rezultat]}>
          {ETICHETE_REZULTAT_EXAMEN[f.rezultat]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Fișele de aptitudine la care aveți acces."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(f) => f.id}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul se șterge la orice schimbare de sortare: ar continua de la
            // un rând care, în noua ordine, nu mai e acolo unde era.
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

export default async function PaginaMedicinaMuncii({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "ssm"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

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

      <Suspense fallback={null}>
        <BandaRestrictii organizationId={tenant.organizationId} />
      </Suspense>

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelFise organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
