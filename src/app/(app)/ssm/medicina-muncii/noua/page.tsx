// src/app/(app)/ssm/medicina-muncii/noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { FormularFisa } from "./formular-fisa";

export const metadata: Metadata = { title: "Fișă de aptitudine nouă" };

export default async function PaginaFisaNoua() {
  await requireUser();
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "ssm"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "ssm:create", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a înregistra fișe de aptitudine. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const db = await createServerSupabase();
  const { data: angajati } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", tenant.organizationId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .order("full_name")
    .limit(500);

  return (
    <div className={`${LATIMI.formular} space-y-6`}>
      <p className="text-muted-foreground text-corp">
        <Link href="/ssm/medicina-muncii" className="underline-offset-2 hover:underline">
          Medicina muncii
        </Link>
      </p>

      <AntetPagina
        titlu="Fișă de aptitudine nouă"
        descriere="Se stochează doar rezultatul aptitudinii — formularul nu are câmp de diagnostic."
      />

      <FormularFisa
        angajati={(angajati ?? []).map((a) => ({
          id: a.id,
          full_name: a.full_name,
          marca: a.marca,
        }))}
      />
    </div>
  );
}
