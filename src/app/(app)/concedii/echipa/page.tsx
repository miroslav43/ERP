// src/app/(app)/concedii/echipa/page.tsx
// Cererile subalternilor, fără ale mele. Perechea lui `/concedii`.
//
// Ce se vede aici NU e decis de pagina asta: `leave_requests_select` (0009)
// întoarce rândurile echipei doar cuiva care e ancestor în `manager_path`, ori
// are `leave:read = all`. Filtrul din `listeazaCereri` exclude doar fișa
// proprie — restul e RLS.
import { Suspense } from "react";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { citesteTot } from "@/lib/queries/citeste-tot";
import { numarDeAprobat } from "@/lib/queries/leave";
import { filtreCereriSchema } from "@/schemas/leave";
import { fisaProprie } from "@/lib/queries/portal";
import { filtreDinUrl } from "@/lib/rute/parametri";

import { FiltreCereri, type OptiuneAngajat as OptiuneAngajatFiltru } from "../filtre-cereri";
import { NavConcedii } from "../nav-concedii";
import { TabelCereri } from "../tabel-cereri";

export const metadata: Metadata = { title: "Concediile echipei" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface OptiuneTip {
  readonly id: string;
  readonly denumire: string;
  readonly culoare: string;
}

export default async function PaginaConcediiEchipa({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "leave:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cererile de concediu ale altor angajați. Această secțiune este rezervată managerilor și personalului de resurse umane." />
    );
  }

  const fisaMea = await fisaProprie(tenant.organizationId, user.id);
  const scope: "team" | "all" = can(permisiuni, "leave:read", "all") ? "all" : "team";
  const poateAproba = can(permisiuni, "leave:approve", "team");

  const parametri = await searchParams;
  const filtre = filtreDinUrl(filtreCereriSchema, parametri);
  const db = await createServerSupabase();
  const [{ data: tipuri }, deAprobat] = await Promise.all([
    db
      .from("leave_types")
      .select("id, denumire, culoare")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<OptiuneTip[]>(),
    poateAproba ? numarDeAprobat(tenant.organizationId, user.id) : Promise.resolve(0),
  ]);

  // Angajații pentru filtrul după persoană. `citesteTot`, nu o singură cerere:
  // PostgREST taie la `max_rows = 1000` FĂRĂ eroare, iar într-un combobox
  // tăierea nu se vede — omul caută un nume, nu-l găsește și trage concluzia că
  // persoana n-are cereri. RLS taie oricum rândurile pe care rolul nu are voie
  // să le vadă, deci lista e exact cea filtrabilă.
  const angajati = await citesteTot<OptiuneAngajatFiltru>(
    async (dupa, pas) => {
      let interogare = db
        .from("employees")
        .select("id, full_name, marca")
        .eq("organization_id", tenant.organizationId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(pas);
      if (dupa !== null) interogare = interogare.gt("id", dupa);
      return await interogare.returns<OptiuneAngajatFiltru[]>();
    },
    (a) => a.id,
    { nume: "angajații pentru filtrul de concedii ale echipei" },
  );
  // Fișa proprie iese din listă: ecranul ăsta n-o arată oricum, iar un filtru
  // care golește sigur lista e o capcană, nu o opțiune.
  const angajatiFiltrabili = [...angajati]
    .filter((a) => a.id !== fisaMea?.id)
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ro"));

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Concediile echipei"
        descriere={
          scope === "all"
            ? "Cererile de concediu ale tuturor angajaților din organizație, mai puțin ale dumneavoastră."
            : "Cererile de concediu ale angajaților din subordinea dumneavoastră."
        }
        file={
          <NavConcedii
            poateVedeaEchipa={true}
            poateAproba={poateAproba}
            poateVedeaCalendar={true}
            deAprobat={deAprobat}
          />
        }
      />

      <FiltreCereri tipuri={tipuri ?? []} angajati={angajatiFiltrabili} filtre={filtre} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelCereri
          organizationId={tenant.organizationId}
          vizualizare="echipa"
          tipuri={tipuri ?? []}
          parametri={parametri}
          scope={scope}
          fisaMea={fisaMea?.id ?? null}
          caleBaza="/concedii/echipa"
          gol={{
            titlu: "Nicio cerere de la echipă",
            descriere:
              "Niciun angajat din subordinea dumneavoastră nu are cereri de concediu înregistrate.",
          }}
        />
      </Suspense>
    </div>
  );
}
