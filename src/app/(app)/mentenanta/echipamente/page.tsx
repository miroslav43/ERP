// src/app/(app)/mentenanta/echipamente/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench, WrenchIcon } from "lucide-react";

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
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { listeazaEchipamente } from "@/lib/queries/maintenance";
import { filtreEchipamenteSchema } from "@/schemas/maintenance";

import { ETICHETE_STATUS_ECHIPAMENT, TONURI_STATUS_ECHIPAMENT } from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreEchipamenteForm } from "./filtre-echipamente";

export const metadata: Metadata = { title: "Echipamente" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelEchipamente({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreEchipamenteSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await listeazaEchipamente(
    organizationId,
    filtre,
  );

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/mentenanta/echipamente" : `/mentenanta/echipamente?${p.toString()}`;
  }

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null || filtre.cauta !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={
          areFiltre ? "Niciun rezultat pentru filtrele alese" : "Niciun echipament înregistrat"
        }
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți tot parcul de echipamente."
            : "Adăugați primul echipament ca să puteți urmări mentenanța și autorizațiile ISCIR."
        }
        {...(areFiltre
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                // Nu `/mentenanta/echipamente` gol: butonul ăsta șterge FILTRELE,
                // nu ordinea aleasă din antet și nici mărimea de pagină. Aceleași
                // chei ca ale barei, plus cursorul, care n-are ce continua.
                href: adresa((p) => {
                  p.delete("cauta");
                  p.delete("status");
                  p.delete("cursor");
                }),
              },
            }
          : {})}
      />
    );
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "cod",
      antet: "Cod",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (e) => <span className="font-medium">{e.cod}</span>,
    },
    {
      cheie: "denumire",
      antet: "Denumire",
      sortabil: true,
      peTelefon: "titlu",
      celula: (e) => e.denumire,
    },
    {
      cheie: "locatie",
      antet: "Locație",
      peTelefon: "meta",
      celula: (e) => e.locatie ?? "—",
    },
    {
      cheie: "iscir",
      antet: "ISCIR",
      latime: "ingusta",
      // Pictogramă fără text: nu are ce spune pe cardul de telefon, unde
      // rândul mărunt e o înșiruire de valori citite cu voce tare.
      peTelefon: "ascuns",
      celula: (e) =>
        e.este_iscir ? (
          <WrenchIcon aria-label="Sub incidența ISCIR" className="text-foreground size-4" />
        ) : (
          "—"
        ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (e) => (
        <Badge ton={TONURI_STATUS_ECHIPAMENT[e.status]}>
          {ETICHETE_STATUS_ECHIPAMENT[e.status]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Echipamentele organizației."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(e) => e.id}
        href={(e) => `/mentenanta/echipamente/${e.id}`}
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

export default async function PaginaEchipamente({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta echipamentele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  // Aceeași validare ca a tabelului, refăcută aici fiindcă e pură: bara de
  // filtre are nevoie de valorile CURENTE ca să-și scrie pastilele, iar din
  // parametrii bruți ar putea scrie o pastilă cu o valoare inventată din URL.
  const filtre = filtreDinUrl(filtreEchipamenteSchema, parametri);
  const poateAdauga = can(permisiuni, "maintenance:update", "team");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Echipamente"
        descriere="Parcul de echipamente al organizației, cu starea și acoperirea ISCIR."
        {...(poateAdauga
          ? {
              actiuni: (
                <Link href="/mentenanta/echipamente/nou" className={buton({ varianta: "primar" })}>
                  Echipament nou
                </Link>
              ),
            }
          : {})}
        file={<NavMentenanta />}
      />

      <FiltreEchipamenteForm filtre={filtre} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelEchipamente organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
