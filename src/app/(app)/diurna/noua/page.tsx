// src/app/(app)/diurna/noua/page.tsx
import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";
import { baremeleTarilor, politicaLaData, tari } from "@/lib/queries/per-diem";

import { FormularDeplasare } from "./formular-deplasare";

export const metadata: Metadata = { title: "Deplasare nouă" };

interface AngajatMinim {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

export default async function PaginaDeplasareNoua() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a înregistra deplasări. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateConfiguraPolitica = can(permisiuni, "per_diem:update", "all");
  const azi = todayInBucharest();
  const politica = await politicaLaData(tenant.organizationId, azi);

  if (politica === null) {
    return (
      <div className={cn(LATIMI.formular, "space-y-6")}>
        <AntetPagina titlu="Deplasare nouă" />
        <StareGoala
          fel="initiala"
          pictograma={Settings}
          titlu="Politica de diurnă nu este configurată"
          descriere={
            poateConfiguraPolitica
              ? "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Configurați pragurile și baremul firmei."
              : "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Cereți administratorului organizației să configureze politica firmei."
          }
          {...(poateConfiguraPolitica
            ? { actiune: { eticheta: "Configurează politica", href: "/diurna/politica" } }
            : {})}
        />
      </div>
    );
  }

  const poateAlegeAngajat = can(permisiuni, "per_diem:create", "all");
  const listaTari = await tari();
  const baremuri = await baremeleTarilor(listaTari.map((t) => t.id));

  let angajati: readonly AngajatMinim[] | null = null;
  if (poateAlegeAngajat) {
    const db = await createServerSupabase();
    const { data } = await db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .returns<AngajatMinim[]>();
    angajati = data ?? [];
  }

  return (
    <div className={cn(LATIMI.detaliu, "space-y-6")}>
      <AntetPagina
        titlu="Deplasare nouă"
        descriere="Zilele și suma diurnei se calculează pe măsură ce completați formularul; suma finală se verifică din nou, exact, pe fișa deplasării, după ce adăugați etapele reale ale traseului."
      />

      <FormularDeplasare
        tari={listaTari}
        politica={politica}
        baremuri={baremuri}
        angajati={angajati}
      />
    </div>
  );
}
