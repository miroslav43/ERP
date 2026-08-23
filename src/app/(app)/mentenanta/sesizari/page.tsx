// src/app/(app)/mentenanta/sesizari/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { echipamenteDupaId, sesizari } from "@/lib/queries/maintenance";
import { filtreSesizariSchema } from "@/schemas/maintenance";

import {
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
} from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreSesizariForm } from "./filtre-sesizari";

export const metadata: Metadata = { title: "Sesizări de defecțiune" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelSesizari({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreSesizariSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await sesizari(organizationId, filtre);

  if (randuri.length === 0) {
    const areFiltre =
      filtre.status !== null || filtre.urgenta !== null || filtre.echipament !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio sesizare înregistrată"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate sesizările."
            : "Sesizările apar aici pe măsură ce echipa raportează defecțiuni."
        }
        {...(areFiltre
          ? { actiune: { eticheta: "Șterge filtrele", href: "/mentenanta/sesizari" } }
          : {})}
      />
    );
  }

  const echipamente = await echipamenteDupaId(
    organizationId,
    randuri.map((r) => r.equipment_id),
  );

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/mentenanta/sesizari" : `/mentenanta/sesizari?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "titlu",
      celula: (s) => {
        const echipament = echipamente.get(s.equipment_id);
        return (
          <span className="font-medium">
            {echipament === undefined
              ? "Echipament necunoscut"
              : `${echipament.cod} — ${echipament.denumire}`}
          </span>
        );
      },
    },
    {
      cheie: "descriere",
      antet: "Descriere",
      peTelefon: "meta",
      celula: (s) => s.descriere,
    },
    {
      cheie: "raportat",
      antet: "Raportată la",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (s) => formatDateTime(s.raportat_la),
    },
    {
      cheie: "urgenta",
      antet: "Urgență",
      sortabil: true,
      peTelefon: "insigna",
      celula: (s) => (
        <Badge ton={TONURI_URGENTA_SESIZARE[s.urgenta]}>
          {ETICHETE_URGENTA_SESIZARE[s.urgenta]}
        </Badge>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (s) => (
        <Badge ton={TONURI_STATUS_SESIZARE[s.status]}>{ETICHETE_STATUS_SESIZARE[s.status]}</Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Sesizările de defecțiune ale organizației."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(s) => s.id}
        href={(s) => `/mentenanta/sesizari/${s.id}`}
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

export default async function PaginaSesizari({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Sesizări de defecțiune"
        descriere="Defecțiunile raportate, cu starea lor de triaj și rezolvare."
        actiuni={
          <Link href="/mentenanta/sesizari/noua" className={buton({ varianta: "primar" })}>
            Sesizare nouă
          </Link>
        }
        file={<NavMentenanta />}
      />

      <FiltreSesizariForm />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelSesizari organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
