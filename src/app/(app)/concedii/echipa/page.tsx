// src/app/(app)/concedii/echipa/page.tsx
// Cererile subalternilor, fără ale mele. Perechea lui `/concedii`.
//
// Ce se vede aici NU e decis de pagina asta: `leave_requests_select` (0009)
// întoarce rândurile echipei doar cuiva care e ancestor în `manager_path`, ori
// are `leave:read = all`. Filtrul de mai jos exclude doar fișa proprie —
// restul e RLS.
import { Suspense } from "react";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { numarDeAprobat } from "@/lib/queries/leave";
import { fisaProprie } from "@/lib/queries/portal";

import { FiltreCereri } from "../filtre-cereri";
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

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * Câți angajați intră în selectul de filtrare. PostgREST taie oricum la
 * `max_rows = 1000`, TĂCUT — limita explicită face trunchierea vizibilă în cod
 * și lasă loc mesajului de mai jos. Peste prag, filtrarea pe angajat rămâne
 * posibilă din ecranul de personal, prin link direct.
 */
const MAXIM_ANGAJATI_FILTRU = 500;

export default async function PaginaConcediiEchipa({ searchParams }: ProprietatiPagina) {
  await requireUser();
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "leave:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cererile de concediu ale altor angajați. Această secțiune este rezervată managerilor și personalului de resurse umane." />
    );
  }

  const fisaMea = await fisaProprie(tenant.organizationId, user.id);
  const scope = can(permisiuni, "leave:read", "all") ? "all" : "team";
  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateConfigura = can(permisiuni, "leave:update", "all");

  const parametri = await searchParams;
  const db = await createServerSupabase();
  const [{ data: tipuri }, { data: angajati }, deAprobat] = await Promise.all([
    db
      .from("leave_types")
      .select("id, denumire, culoare")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<OptiuneTip[]>(),
    // Lista pentru selectul de filtrare. Trece prin RLS: un manager primește
    // subarborele lui, HR-ul și org_admin-ul primesc tot. Fișa proprie e
    // exclusă, ca selectul să nu ofere un filtru care golește lista.
    db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .limit(MAXIM_ANGAJATI_FILTRU)
      .returns<OptiuneAngajat[]>(),
    poateAproba ? numarDeAprobat(tenant.organizationId, user.id) : Promise.resolve(0),
  ]);

  const angajatiFiltru = (angajati ?? []).filter((a) => a.id !== fisaMea?.id);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Concediile echipei</h1>
        <p className="text-muted-foreground text-sm">
          {scope === "all"
            ? "Cererile de concediu ale tuturor angajaților din organizație, mai puțin ale dumneavoastră."
            : "Cererile de concediu ale angajaților din subordinea dumneavoastră."}
        </p>
      </header>

      <NavConcedii
        poateVedeaEchipa={true}
        poateAproba={poateAproba}
        poateVedeaCalendar={true}
        poateConfigura={poateConfigura}
        deAprobat={deAprobat}
      />

      <FiltreCereri tipuri={tipuri ?? []} angajati={angajatiFiltru} />

      <Suspense key={JSON.stringify(parametri)} fallback={<SkeletonTable />}>
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
              "Nu există cereri ale altor angajați care să corespundă filtrelor alese. Ștergeți filtrele sau reveniți mai târziu.",
          }}
        />
      </Suspense>
    </main>
  );
}
