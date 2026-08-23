// src/app/(app)/ssm/stingatoare/page.tsx
import { treaptaSsm } from "@/domain/ssm/scadente";
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { FireExtinguisher, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { Scadenta } from "@/components/ui/scadenta";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { stingatoare } from "@/lib/queries/ssm";
import { filtreStingatoareSchema } from "@/schemas/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import { ETICHETE_SCADENTA, ETICHETE_STATUS_STINGATOR, TONURI_STATUS_STINGATOR } from "../etichete";
import { NavSsm } from "../nav-ssm";
import { FiltreStingatoare } from "./filtre-stingatoare";

export const metadata: Metadata = { title: "Stingătoare" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Nu mai randează `<td>`-ul, ci doar conținutul lui: `<Tabel>` construiește
 * celula (și varianta de card de sub 768px) din metadatele coloanei.
 */
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
    <span className="whitespace-nowrap">
      <Scadenta treapta={treaptaSsm(stare, scadenta)}>{ETICHETE_SCADENTA[stare]}</Scadenta>
      {data === null ? null : (
        <span className="text-muted-foreground text-nota ml-2">{formatDate(data)}</span>
      )}
    </span>
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
  const { randuri, urmatorulCursor, total, sortare } = await stingatoare(organizationId, filtre);

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

  /** Adresele pornesc de la parametrii EXISTENȚI — o sortare nu are voie să șteargă căutarea. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/ssm/stingatoare" : `/ssm/stingatoare?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "cod",
      antet: "Cod",
      sortabil: true,
      peTelefon: "titlu",
      latime: "ingusta",
      celula: (s) => <span className="font-medium">{s.cod}</span>,
    },
    {
      cheie: "locatie",
      antet: "Locație",
      sortabil: true,
      peTelefon: "meta",
      celula: (s) => (
        <>
          {s.locatie}
          {s.cladire === null ? null : (
            <span className="text-muted-foreground"> · {s.cladire}</span>
          )}
        </>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (s) => (
        <Badge ton={TONURI_STATUS_STINGATOR[s.status]}>{ETICHETE_STATUS_STINGATOR[s.status]}</Badge>
      ),
    },
    {
      cheie: "verificare",
      antet: "Verificare",
      peTelefon: "meta",
      celula: (s) => (
        <CelulaScadenta
          areInregistrare={s.ultima_verificare !== null}
          data={s.ultima_verificare}
          scadenta={s.scadenta_verificare}
          azi={azi}
        />
      ),
    },
    {
      cheie: "reincarcare",
      antet: "Reîncărcare",
      peTelefon: "meta",
      celula: (s) => (
        <CelulaScadenta
          areInregistrare={s.ultima_reincarcare !== null}
          data={s.ultima_reincarcare}
          scadenta={s.scadenta_reincarcare}
          azi={azi}
        />
      ),
    },
    {
      cheie: "proba",
      antet: "Probă de presiune",
      peTelefon: "meta",
      celula: (s) => (
        <CelulaScadenta
          areInregistrare={s.ultima_proba_presiune !== null}
          data={s.ultima_proba_presiune}
          scadenta={s.scadenta_proba_presiune}
          azi={azi}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Stingătoarele organizației, cu cele trei obligații de întreținere pe coloane distincte."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(s) => s.id}
        href={(s) => `/ssm/stingatoare/${s.id}`}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
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
  // Bara de filtre nu mai citește singură adresa: primește valorile deja trecute
  // prin schemă, deci un `?status=inventat` nu mai poate ajunge pe o pastilă.
  const filtreCurente = filtreDinUrl(filtreStingatoareSchema, parametri);

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

      <FiltreStingatoare status={filtreCurente.status} cauta={filtreCurente.cauta} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelStingatoare organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
