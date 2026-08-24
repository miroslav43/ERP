// src/app/(app)/ssm/accidente/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plus, ShieldAlert } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { accidente, angajatiDupaId } from "@/lib/queries/ssm";
import { filtreAccidenteSchema } from "@/schemas/ssm";
import { momentLimitaComunicareItm } from "@/domain/ssm/termen-itm";

import { ETICHETE_TIP_ACCIDENT, TONURI_TIP_ACCIDENT } from "../etichete";
import { NavSsm } from "../nav-ssm";
import { NumaratoareItm } from "../numaratoare-itm";

export const metadata: Metadata = { title: "Accidente de muncă" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelAccidente({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreAccidenteSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await accidente(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre = filtre.tip !== null || filtre.necomunicate !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={ShieldAlert}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun accident înregistrat"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate accidentele."
            : "Registrul de accidente e gol — sperăm să rămână așa."
        }
        actiune={
          areFiltre
            ? { eticheta: "Șterge filtrele", href: "/ssm/accidente" }
            : { eticheta: "Înregistrează un accident", href: "/ssm/accidente/nou" }
        }
      />
    );
  }

  const angajati = await angajatiDupaId(
    organizationId,
    randuri.map((a) => a.employee_id).filter((id): id is string => id !== null),
  );
  const acum = new Date().toISOString();

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge filtrul de tip, iar o schimbare de mărime a
   * paginii ar șterge sortarea.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/ssm/accidente" : `/ssm/accidente?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "data",
      antet: "Data",
      sortabil: true,
      peTelefon: "titlu",
      latime: "ingusta",
      celula: (a) => formatDate(a.data_producerii),
    },
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "meta",
      celula: (a) => {
        const angajat = a.employee_id === null ? undefined : angajati.get(a.employee_id);
        return angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`;
      },
    },
    {
      cheie: "tip",
      antet: "Tip",
      sortabil: true,
      peTelefon: "insigna",
      celula: (a) => <Badge ton={TONURI_TIP_ACCIDENT[a.tip]}>{ETICHETE_TIP_ACCIDENT[a.tip]}</Badge>,
    },
    {
      // Coloana spunea „Nu" fără să spună cât mai e, deși `ora_producerii` și
      // `termen_comunicare_ore` erau deja citite de query. Registrul de
      // accidente e primul loc unde se uită cineva după un eveniment, iar
      // întrebarea lui nu e „s-a comunicat?", ci „mai am timp?".
      cheie: "comunicat",
      antet: "Termen ITM",
      peTelefon: "meta",
      celula: (a) =>
        a.comunicat_la_itm_la === null ? (
          <NumaratoareItm
            momentLimita={momentLimitaComunicareItm(
              a.data_producerii,
              a.ora_producerii,
              a.termen_comunicare_ore ?? 24,
            ).toISOString()}
            acumInitial={acum}
            fel="compact"
          />
        ) : (
          <span className="text-muted-foreground whitespace-nowrap">
            comunicat {formatDateTime(a.comunicat_la_itm_la)}
          </span>
        ),
    },
    {
      cheie: "cercetare",
      antet: "Cercetare",
      peTelefon: "meta",
      celula: (a) =>
        a.cercetare_finalizata_la === null ? "În curs" : formatDate(a.cercetare_finalizata_la),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Accidentele de muncă la care aveți acces."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(a) => a.id}
        href={(a) => `/ssm/accidente/${a.id}`}
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

export default async function PaginaAccidente({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta registrul de accidente. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "ssm:create", "team");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Accidente de muncă"
        descriere="Registrul de accidente, cu termenul de comunicare la ITM și stadiul cercetării."
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/ssm/accidente/nou" className={buton({ varianta: "primar" })}>
                  <Plus aria-hidden="true" className="size-4" />
                  Accident nou
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
            poateVedeaAccidente
            poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
            poateVedeaEip={can(permisiuni, "ssm:read", "team")}
            poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
          />
        }
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelAccidente organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
