// src/app/(app)/ssm/eip/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { HardHat } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { scrieSortare } from "@/lib/queries/cursor";
import { angajatiDupaId, eip } from "@/lib/queries/ssm";
import { filtreEipSchema } from "@/schemas/ssm";

import { NavSsm } from "../nav-ssm";
import { FormularEip } from "./formular-eip";

export const metadata: Metadata = { title: "Echipament individual de protecție" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function TabelEip({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreEipSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await eip(organizationId, filtre);

  if (randuri.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={HardHat}
        titlu="Niciun echipament predat"
        descriere="Predați primul echipament individual de protecție folosind formularul de mai jos."
      />
    );
  }

  const angajati = await angajatiDupaId(
    organizationId,
    randuri.map((e) => e.employee_id),
  );

  /** Adresele pornesc de la parametrii EXISTENȚI, ca o sortare să nu piardă mărimea paginii. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/ssm/eip" : `/ssm/eip?${p.toString()}`;
  }

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (e) => {
        const angajat = angajati.get(e.employee_id);
        return angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`;
      },
    },
    {
      cheie: "articol",
      antet: "Articol",
      sortabil: true,
      peTelefon: "meta",
      celula: (e) => (
        <>
          {e.articol}
          {e.cod_articol === null ? null : (
            <span className="text-muted-foreground"> · {e.cod_articol}</span>
          )}
        </>
      ),
    },
    {
      cheie: "cantitate",
      antet: "Cantitate",
      numeric: true,
      peTelefon: "meta",
      latime: "ingusta",
      celula: (e) => `${String(e.cantitate)} ${e.unitate}`,
    },
    {
      cheie: "predat",
      antet: "Predat la",
      sortabil: true,
      peTelefon: "meta",
      latime: "ingusta",
      celula: (e) => formatDate(e.data_predarii),
    },
    {
      cheie: "inlocuire",
      antet: "Înlocuire",
      peTelefon: "meta",
      latime: "ingusta",
      celula: (e) => (e.data_inlocuirii === null ? "—" : formatDate(e.data_inlocuirii)),
    },
    {
      cheie: "returnat",
      antet: "Returnat",
      peTelefon: "meta",
      latime: "ingusta",
      celula: (e) => (e.returnat_la === null ? "—" : formatDate(e.returnat_la)),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Echipamentul individual de protecție predat."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(e) => e.id}
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

export default async function PaginaEip({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta echipamentul individual de protecție. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const poateCrea = can(permisiuni, "ssm:create", "team");

  let angajati: readonly {
    readonly id: string;
    readonly full_name: string | null;
    readonly marca: string;
  }[] = [];
  if (poateCrea) {
    const db = await createServerSupabase();
    const { data } = await db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .limit(500);
    angajati = data ?? [];
  }

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Echipament individual de protecție"
        descriere="Predările de EIP, cu data de înlocuire calculată automat."
        file={
          <NavSsm
            poateVedeaInstruiri={
              can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")
            }
            poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
            poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
            poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
            poateVedeaEip
            poateVedeaAutorizatii={can(permisiuni, "ssm:read", "team")}
          />
        }
      />

      {poateCrea ? <FormularEip angajati={angajati} /> : null}

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelEip organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
