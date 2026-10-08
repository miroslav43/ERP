// src/app/(app)/ssm/autorizatii/page.tsx
import { treaptaSsm } from "@/domain/ssm/scadente";
import { Suspense } from "react";
import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { Scadenta } from "@/components/ui/scadenta";
import { can, getPermissionMap, type PermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { angajatiDupaId, autorizatiiNominale } from "@/lib/queries/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import { ETICHETE_SCADENTA } from "../etichete";
import { NavSsm } from "../nav-ssm";
import { FormularAutorizatie } from "./formular-autorizatie";
import { SuspendareAutorizatie } from "./suspendare-autorizatie";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisa } from "@/lib/navigare/fisa";
import { PastileFiltre } from "@/components/ui/pastile-filtre";

export const metadata: Metadata = { title: "Autorizații nominale" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function TabelAutorizatii({
  organizationId,
  angajat,
  poateActualiza,
  poateCrea,
  permisiuni,
}: {
  readonly organizationId: string;
  /** `?angajat=`: doar autorizațiile unui om. */
  readonly angajat: string | null;
  readonly poateActualiza: boolean;
  /** Formularul „de mai sus" există doar cu `ssm:create`; altfel textul trimitea spre nimic. */
  readonly poateCrea: boolean;
  readonly permisiuni: PermissionMap;
}) {
  const autorizatii = await autorizatiiNominale(organizationId, { angajat });

  if (autorizatii.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={BadgeCheck}
        titlu="Nicio autorizație nominală înregistrată"
        descriere={
          poateCrea
            ? "Adăugați prima autorizație (stivuitorist, macaragiu, fochist, electrician autorizat…) folosind formularul de mai sus."
            : "Nicio autorizație nominală nu e înregistrată încă. Le adaugă responsabilul SSM."
        }
      />
    );
  }

  const angajati = await angajatiDupaId(
    organizationId,
    autorizatii.map((a) => a.employee_id),
  );
  const azi = todayInBucharest();

  /**
   * Lista nu are paginare keyset — `autorizatiiNominale` citește nomenclatorul
   * întreg, ordonat după valabilitate — deci nici antete sortabile: un antet
   * care pare sortabil și nu face nimic e mai rău decât unul care nu pare.
   */
  const coloane: readonly Coloana<(typeof autorizatii)[number]>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (a) => {
        const angajat = angajati.get(a.employee_id);
        return (
          <LinkEntitate href={hrefFisa(angajat, permisiuni)}>
            {angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`}
          </LinkEntitate>
        );
      },
    },
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "meta",
      celula: (a) => (
        <>
          {a.tip}
          {a.grupa === null ? null : (
            <span className="text-muted-foreground"> · grupa {a.grupa}</span>
          )}
        </>
      ),
    },
    { cheie: "numar", antet: "Număr", peTelefon: "meta", celula: (a) => a.numar },
    { cheie: "emitent", antet: "Emitent", peTelefon: "meta", celula: (a) => a.emitent },
    {
      cheie: "valabil",
      antet: "Valabilă până la",
      peTelefon: "meta",
      latime: "ingusta",
      celula: (a) => formatDate(a.valabil_pana),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (a) => {
        // Suspendarea acoperă valabilitatea: o autorizație suspendată nu susține
        // nicio desemnare, oricât ar mai fi valabilă pe hârtie.
        if (a.suspendata_la !== null) {
          return <Badge ton="pericol">Suspendată {formatDate(a.suspendata_la)}</Badge>;
        }
        const stare = stareScadentaSsm(true, a.valabil_pana, azi);
        return (
          <Scadenta treapta={treaptaSsm(stare, a.valabil_pana)}>
            {ETICHETE_SCADENTA[stare]}
          </Scadenta>
        );
      },
    },
  ];

  // Coloana de acțiune apare DOAR pentru cine are `ssm:update` — un antet care
  // rămâne gol pe toate rândurile e o promisiune neonorată în plus.
  const coloaneFinale: readonly Coloana<(typeof autorizatii)[number]>[] = poateActualiza
    ? [
        ...coloane,
        {
          cheie: "actiuni",
          antet: "Acțiuni",
          antetAscuns: true,
          latime: "ingusta",
          peTelefon: "meta",
          celula: (a) => (
            <SuspendareAutorizatie id={a.id} suspendataLa={a.suspendata_la} azi={azi} />
          ),
        },
      ]
    : coloane;

  return (
    <Tabel
      caption="Autorizațiile nominale ale angajaților."
      coloane={coloaneFinale}
      randuri={autorizatii}
      cheieRand={(a) => a.id}
      gol={null}
    />
  );
}

export default async function PaginaAutorizatii({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta autorizațiile nominale. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateCrea = can(permisiuni, "ssm:create", "team");
  const poateActualiza = can(permisiuni, "ssm:update", "team");

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

  // Filtrul de intrare din fișa angajatului: un UUID sau nimic; numele, sub RLS.
  const parametri = await searchParams;
  const angajatBrut = parametri["angajat"];
  const angajatFiltrat =
    typeof angajatBrut === "string" && UUID_RE.test(angajatBrut) ? angajatBrut : null;
  const numeAngajatFiltrat =
    angajatFiltrat === null
      ? null
      : ((await angajatiDupaId(tenant.organizationId, [angajatFiltrat])).get(angajatFiltrat)
          ?.full_name ?? null);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Autorizații nominale"
        descriere="Stivuitorist, macaragiu, fochist, electrician autorizat și altele — condiționează desemnarea unui angajat ca responsabil pe echipamente ISCIR."
        file={
          <NavSsm
            poateVedeaInstruiri={
              can(permisiuni, "ssm:read", "team") && can(permisiuni, "employees:read", "team")
            }
            poateVedeaMedicina={can(permisiuni, "ssm:read", "team")}
            poateVedeaAccidente={can(permisiuni, "ssm:read", "team")}
            poateVedeaStingatoare={can(permisiuni, "ssm:read", "team")}
            poateVedeaEip={can(permisiuni, "ssm:read", "team")}
            poateVedeaAutorizatii
          />
        }
      />

      {poateCrea ? <FormularAutorizatie angajati={angajati} /> : null}

      <PastileFiltre
        active={
          angajatFiltrat === null
            ? []
            : [{ cheie: "angajat", eticheta: `Angajat: ${numeAngajatFiltrat ?? "ales"}` }]
        }
      />

      <Suspense fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelAutorizatii
          organizationId={tenant.organizationId}
          angajat={angajatFiltrat}
          poateActualiza={poateActualiza}
          poateCrea={poateCrea}
          permisiuni={permisiuni}
        />
      </Suspense>
    </div>
  );
}
