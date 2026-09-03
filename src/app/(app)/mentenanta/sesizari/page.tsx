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

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/mentenanta/sesizari" : `/mentenanta/sesizari?${p.toString()}`;
  }

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
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                // Nu `/mentenanta/sesizari` gol: butonul ăsta șterge FILTRELE, nu
                // ordinea aleasă din antet și nici mărimea de pagină. `echipament`
                // intră și el, fiindcă textul promite „toate sesizările”.
                href: adresa((p) => {
                  p.delete("status");
                  p.delete("urgenta");
                  p.delete("echipament");
                  p.delete("cursor");
                }),
              },
            }
          : {})}
      />
    );
  }

  const echipamente = await echipamenteDupaId(
    organizationId,
    randuri.map((r) => r.equipment_id),
  );

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
      /*
       * `opreste_functionarea` era CITIT de `sesizari()` (e în `COLOANE_SESIZARE`)
       * și nu apărea nicăieri în coadă — se vedea abia pe detaliu, după două
       * clicuri. E singurul semnal care spune „utilajul nu produce acum”, adică
       * exact ce decide ce se ia primul dintr-o coadă de triaj.
       */
      cheie: "oprit",
      antet: "Utilaj",
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (s) =>
        s.opreste_functionarea ? (
          <Badge ton="pericol" cuAvertisment>
            Oprit
          </Badge>
        ) : (
          <span className="text-muted-foreground">Funcționează</span>
        ),
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
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  // Aceeași validare ca a tabelului, refăcută aici fiindcă e pură: bara de
  // filtre are nevoie de valorile CURENTE ca să-și scrie pastilele, iar din
  // parametrii bruți ar putea scrie o pastilă cu o valoare inventată din URL.
  const filtre = filtreDinUrl(filtreSesizariSchema, parametri);

  /*
   * Denumirea echipamentului filtrat, DOAR ca să existe o pastilă cu ieșire.
   * `echipament` e cheia pusă de codul QR de pe utilaj: lista deschisă de pe
   * telefonul cuiva din hală e filtrată la o singură mașină, iar până acum
   * filtrul era invizibil ȘI de neșters — singura ieșire era linkul din starea
   * goală, care apare numai când lista chiar e goală.
   */
  const etichetaEchipament =
    filtre.echipament === null
      ? null
      : ((await echipamenteDupaId(tenant.organizationId, [filtre.echipament])).get(
          filtre.echipament,
        )?.cod ?? null);

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

      <FiltreSesizariForm
        filtre={filtre}
        {...(etichetaEchipament === null ? {} : { etichetaEchipament })}
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelSesizari organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
