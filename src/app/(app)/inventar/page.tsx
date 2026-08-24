// src/app/(app)/inventar/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Package, PackagePlus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { scrieSortare } from "@/lib/queries/cursor";
import { alocariDeschise, categorii, listeazaObiecte } from "@/lib/queries/inventory";
import { filtreInventarSchema } from "@/schemas/inventory";

import { ETICHETE_STARE, ETICHETE_STATUS, TONURI_STARE, TONURI_STATUS } from "./etichete";
import { FiltreInventar } from "./filtre-inventar";
import { filtreDinUrl } from "@/lib/rute/parametri";

export const metadata: Metadata = { title: "Inventar" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface OptiuneCategorie {
  readonly id: string;
  readonly denumire: string;
}

interface ProprietatiTabel {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly categorii: readonly OptiuneCategorie[];
}

async function TabelInventar({
  organizationId,
  parametri,
  categorii: listaCategorii,
}: ProprietatiTabel) {
  const filtre = filtreDinUrl(filtreInventarSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await listeazaObiecte(
    organizationId,
    filtre,
  );

  if (randuri.length === 0) {
    const areFiltre =
      filtre.q !== null ||
      filtre.numar !== null ||
      filtre.status !== null ||
      filtre.stare !== null ||
      filtre.category_id !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Package}
        titlu="Niciun obiect găsit"
        descriere="Nu există obiecte de inventar care să corespundă filtrelor alese. Ștergeți filtrele sau adăugați primul obiect."
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: "/inventar" } } : {})}
      />
    );
  }

  const idAlocate = randuri.filter((rand) => rand.status === "alocat").map((rand) => rand.id);
  const detinatori = await alocariDeschise(organizationId, idAlocate);
  const numeCategorii = new Map(listaCategorii.map((cat) => [cat.id, cat.denumire]));

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
    return p.size === 0 ? "/inventar" : `/inventar?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "denumire",
      antet: "Denumire",
      sortabil: true,
      peTelefon: "titlu",
      celula: (rand) => (
        <>
          <span className="font-medium">{rand.denumire}</span>
          {rand.model === null ? null : (
            <span className="text-muted-foreground text-nota ml-2">({rand.model})</span>
          )}
        </>
      ),
    },
    {
      cheie: "numar",
      antet: "Număr inventar",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (rand) => <span className="text-nota font-mono">{rand.numar_inventar}</span>,
    },
    {
      cheie: "categorie",
      antet: "Categorie",
      peTelefon: "meta",
      celula: (rand) =>
        rand.category_id === null ? "—" : (numeCategorii.get(rand.category_id) ?? "—"),
    },
    {
      cheie: "circuit",
      antet: "Circuit",
      peTelefon: "insigna",
      celula: (rand) => (
        <Badge ton={TONURI_STATUS[rand.status]}>{ETICHETE_STATUS[rand.status]}</Badge>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (rand) => <Badge ton={TONURI_STARE[rand.stare]}>{ETICHETE_STARE[rand.stare]}</Badge>,
    },
    {
      cheie: "detinut_de",
      antet: "Deținut de",
      peTelefon: "meta",
      celula: (rand) => detinatori.get(rand.id)?.angajatNume ?? "—",
    },
    {
      cheie: "valoare",
      antet: "Valoare",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => (rand.valoare === null ? "—" : formatLei(rand.valoare)),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Lista obiectelor de inventar"
        coloane={coloane}
        randuri={randuri}
        cheieRand={(rand) => rand.id}
        href={(rand) => `/inventar/${rand.id}`}
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

export default async function PaginaInventar({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "inventory");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "inventory:read");

  if (scope === null || scope === "none") {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evidența de inventar. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateScrie = can(permisiuni, "inventory:update", "all");
  const listaCategorii = await categorii();
  // Aceleași filtre pe care le vede lista: bara le arată în câmpuri și ca pastile.
  const filtre = filtreDinUrl(filtreInventarSchema, parametri);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Inventar"
        descriere={
          scope === "own"
            ? "Vedeți obiectele aflate acum în primirea dumneavoastră."
            : scope === "team"
              ? "Vedeți obiectele aflate acum în primirea echipei dumneavoastră."
              : "Evidența completă a obiectelor de inventar ale organizației."
        }
        {...(poateScrie
          ? {
              actiuni: (
                <Link href="/inventar/nou" className={buton({ varianta: "primar" })}>
                  <PackagePlus aria-hidden="true" className="size-4" />
                  Obiect nou
                </Link>
              ),
            }
          : {})}
      />

      <FiltreInventar categorii={listaCategorii} filtre={filtre} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={7} />}>
        <TabelInventar
          organizationId={tenant.organizationId}
          parametri={parametri}
          categorii={listaCategorii}
        />
      </Suspense>
    </div>
  );
}
