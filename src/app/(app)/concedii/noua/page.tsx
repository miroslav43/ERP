// src/app/(app)/concedii/noua/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";
import { soldAnual, zileNelucratoare } from "@/lib/queries/leave";

import { NavConcedii } from "../nav-concedii";
import { FormularCerere } from "./formular-cerere";

export const metadata: Metadata = { title: "Cerere de concediu nouă" };

interface TipPentruFormular {
  readonly id: string;
  readonly denumire: string;
  readonly culoare: string;
  readonly zile_implicite: number;
  readonly scade_din_sold: boolean;
  readonly necesita_document: boolean;
}

export default async function PaginaCerereNoua() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "leave:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a depune cereri de concediu. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateAlegeAngajat = can(permisiuni, "leave:create", "all");
  const poateVedeaCalendar = can(permisiuni, "leave:read", "team");
  const poateAproba = can(permisiuni, "leave:approve", "team");
  const poateConfigura = can(permisiuni, "leave:update", "all");

  const anCurent = Number(todayInBucharest().slice(0, 4));
  const db = await createServerSupabase();

  const [{ data: tipuri }, { nationale, organizatie }] = await Promise.all([
    db
      .from("leave_types")
      .select("id, denumire, culoare, zile_implicite, scade_din_sold, necesita_document")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<TipPentruFormular[]>(),
    zileNelucratoare(tenant.organizationId, anCurent - 1, anCurent + 1),
  ]);

  let angajati: readonly Readonly<{ id: string; full_name: string; marca: string }>[] = [];
  let soldPropriu: ReadonlyMap<string, number> | null = null;

  if (poateAlegeAngajat) {
    const { data } = await db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .returns<{ id: string; full_name: string; marca: string }[]>();
    angajati = data ?? [];
  } else {
    // Doar când cererea e strict pentru mine însumi (fără selector de angajat)
    // se poate arăta soldul: RLS restrânge deja `soldAnual` la rândurile
    // proprii pentru cine are `leave:create = own`.
    const { tipuri: tipuriSold, solduri } = await soldAnual(tenant.organizationId, anCurent);
    soldPropriu = new Map(
      tipuriSold.map((tip) => {
        const rand = solduri.find((s) => s.leave_type_id === tip.id);
        return [tip.id, rand?.ramase ?? tip.zile_implicite];
      }),
    );
  }

  const sarbatoriRo = nationale.map((z) => z.data);
  const liberSuplimentar = organizatie
    .filter((z) => z.tip === "liber_suplimentar")
    .map((z) => z.data);
  const zileRecuperare = organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Cerere de concediu nouă</h1>
        <p className="text-muted-foreground text-sm">
          Previzualizarea zilelor consumate se calculează pe măsură ce completați formularul; soldul
          se verifică din nou, exact, la trimitere.
        </p>
      </header>

      <NavConcedii
        poateVedeaEchipa={poateVedeaCalendar}
        poateAproba={poateAproba}
        poateVedeaCalendar={poateVedeaCalendar}
        poateConfigura={poateConfigura}
      />

      {tipuri === null || tipuri.length === 0 ? (
        <p className="border-warning/40 bg-warning/12 text-foreground rounded-lg border p-4 text-sm">
          Organizația nu are niciun tip de concediu activ configurat. Contactați administratorul.
        </p>
      ) : (
        <FormularCerere
          tipuri={tipuri}
          sarbatoriRo={sarbatoriRo}
          liberSuplimentar={liberSuplimentar}
          zileRecuperare={zileRecuperare}
          angajati={poateAlegeAngajat ? angajati : null}
          soldPropriu={soldPropriu === null ? null : Object.fromEntries(soldPropriu)}
        />
      )}
    </main>
  );
}
