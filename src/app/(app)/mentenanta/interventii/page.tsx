// src/app/(app)/mentenanta/interventii/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { echipamenteDupaId, interventii } from "@/lib/queries/maintenance";
import { filtreInterventiiSchema } from "@/schemas/maintenance";

import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_TIP_MENTENANTA,
  TONURI_REZULTAT_INTERVENTIE,
} from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";
import { FiltreInterventiiForm } from "./filtre-interventii";

export const metadata: Metadata = { title: "Intervenții de mentenanță" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelInterventii({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreInterventiiSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await interventii(organizationId, filtre);

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/mentenanta/interventii" : `/mentenanta/interventii?${p.toString()}`;
  }

  if (randuri.length === 0) {
    const areFiltre = filtre.tip !== null || filtre.rezultat !== null || filtre.echipament !== null;
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Wrench}
        titlu={
          areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio intervenție înregistrată"
        }
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate intervențiile."
            : "Intervențiile se adaugă din fișa fiecărui echipament, sau la rezolvarea unei sesizări."
        }
        {...(areFiltre
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                // Nu `/mentenanta/interventii` gol: butonul ăsta șterge FILTRELE,
                // nu ordinea aleasă din antet și nici mărimea de pagină. `echipament`
                // intră și el, fiindcă textul promite „toate intervențiile”.
                href: adresa((p) => {
                  p.delete("tip");
                  p.delete("rezultat");
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

  // Rândul NU e apăsabil în întregime, ca înainte: ținta lui e fișa
  // echipamentului, iar echipamentul poate lipsi — RLS îl poate ascunde. Linkul
  // rămâne exact acolo unde există ceva de deschis, în celula de echipament.
  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "data",
      antet: "Data",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (i) => formatDate(i.data),
    },
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "titlu",
      celula: (i) => {
        const echipament = echipamente.get(i.equipment_id);
        return echipament === undefined ? (
          "—"
        ) : (
          <Link
            href={`/mentenanta/echipamente/${i.equipment_id}`}
            className="underline-offset-2 hover:underline"
          >
            {echipament.cod} — {echipament.denumire}
          </Link>
        );
      },
    },
    {
      cheie: "tip",
      antet: "Tip",
      sortabil: true,
      peTelefon: "meta",
      celula: (i) => ETICHETE_TIP_MENTENANTA[i.tip],
    },
    {
      cheie: "descriere",
      antet: "Descriere",
      peTelefon: "meta",
      celula: (i) => i.descriere,
    },
    {
      cheie: "cost",
      antet: "Cost total",
      sortabil: true,
      numeric: true,
      peTelefon: "meta",
      celula: (i) => formatLei(i.cost_total ?? i.cost_piese + i.cost_manopera),
    },
    {
      cheie: "rezultat",
      antet: "Rezultat",
      sortabil: true,
      peTelefon: "insigna",
      celula: (i) => (
        <Badge ton={TONURI_REZULTAT_INTERVENTIE[i.rezultat]}>
          {ETICHETE_REZULTAT_INTERVENTIE[i.rezultat]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Intervențiile de mentenanță ale organizației."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(i) => i.id}
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

export default async function PaginaInterventii({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta intervențiile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  // Aceeași validare ca a tabelului, refăcută aici fiindcă e pură: bara de
  // filtre are nevoie de valorile CURENTE ca să-și scrie pastilele, iar din
  // parametrii bruți ar putea scrie o pastilă cu o valoare inventată din URL.
  const filtre = filtreDinUrl(filtreInterventiiSchema, parametri);

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
        titlu="Intervenții de mentenanță"
        descriere="Istoricul intervențiilor, cu costurile lor. Se adaugă din fișa fiecărui echipament."
        file={<NavMentenanta />}
      />

      <FiltreInterventiiForm
        filtre={filtre}
        {...(etichetaEchipament === null ? {} : { etichetaEchipament })}
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelInterventii organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
