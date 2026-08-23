// src/app/(app)/evaluari/sabloane/page.tsx
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { ActiuniSablonEvaluare } from "./actiuni-sablon-evaluare";
import { FormularSablonEvaluareNou } from "./formular-sablon-evaluare-nou";

export const metadata: Metadata = { title: "Șabloane de evaluare" };

interface CriteriuSablon {
  readonly cod: string;
  readonly denumire: string;
  readonly scala_max: number;
}

interface RandSablon {
  readonly id: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly criterii: readonly CriteriuSablon[];
  readonly activ: boolean;
  readonly organization_id: string | null;
}

export default async function PaginaSabloaneEvaluare() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "evaluations");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "employees:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta șabloanele de evaluare." />;
  }

  // Șablonul e comun pe firmă (0070): îl creează administratorul sau HR-ul.
  const poateCrea = can(permisiuni, "evaluations:update", "all");

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("evaluation_templates")
    .select("id, denumire, descriere, criterii, activ, organization_id")
    .or(`organization_id.eq.${tenant.organizationId},organization_id.is.null`)
    .is("deleted_at", null)
    .order("organization_id", { ascending: true, nullsFirst: true })
    .order("denumire")
    .returns<RandSablon[]>();
  if (error !== null) throw error;

  const sabloane = data ?? [];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Șabloane de evaluare"
        descriere="Un set de criterii reutilizabil, aplicat apoi angajaților de pe fișa fiecăruia. Poate fi creat de manageri, nu doar de administratori."
        {...(poateCrea ? { actiuni: <FormularSablonEvaluareNou /> } : {})}
      />

      {sabloane.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ClipboardCheck}
          titlu="Niciun șablon de evaluare"
          descriere="Adăugați primul șablon — de exemplu „Evaluare anuală”."
        />
      ) : (
        <ul className="space-y-3">
          {sabloane.map((sablon) => (
            <li
              key={sablon.id}
              className="border-border bg-surface rounded-panou shadow-ridicat border"
            >
              <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="bg-background rounded-control flex size-9 shrink-0 items-center justify-center">
                  <ClipboardCheck aria-hidden="true" className="text-primary size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{sablon.denumire}</span>
                    {sablon.organization_id === null ? (
                      <span className="bg-background text-muted-foreground text-nota rounded-full px-2 py-0.5 font-medium">
                        Șablon platformă
                      </span>
                    ) : null}
                    {!sablon.activ ? (
                      <span className="bg-background text-muted-foreground text-nota rounded-full px-2 py-0.5 font-medium">
                        Inactiv
                      </span>
                    ) : null}
                  </div>
                  {sablon.descriere !== null ? (
                    <p className="text-muted-foreground text-corp mt-1">{sablon.descriere}</p>
                  ) : null}
                  <ul className="text-muted-foreground text-nota mt-2 flex flex-wrap gap-1.5">
                    {sablon.criterii.map((criteriu) => (
                      <li key={criteriu.cod} className="bg-background rounded-full px-2 py-0.5">
                        {criteriu.denumire}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {poateCrea && sablon.organization_id !== null ? (
                <div className="border-border bg-background border-t px-4 py-2">
                  <ActiuniSablonEvaluare id={sablon.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
