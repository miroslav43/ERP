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
import { can, getPermissionMap } from "@/lib/auth/permissions";
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

export const metadata: Metadata = { title: "Autorizații nominale" };

async function TabelAutorizatii({
  organizationId,
  poateActualiza,
}: {
  readonly organizationId: string;
  readonly poateActualiza: boolean;
}) {
  const autorizatii = await autorizatiiNominale(organizationId);

  if (autorizatii.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={BadgeCheck}
        titlu="Nicio autorizație nominală înregistrată"
        descriere="Adăugați prima autorizație (stivuitorist, macaragiu, fochist, electrician autorizat…) folosind formularul de mai sus."
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
        return angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`;
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

export default async function PaginaAutorizatii() {
  await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ssm");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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

      <Suspense fallback={<Schelet forma="tabel" coloane={6} />}>
        <TabelAutorizatii organizationId={tenant.organizationId} poateActualiza={poateActualiza} />
      </Suspense>
    </div>
  );
}
