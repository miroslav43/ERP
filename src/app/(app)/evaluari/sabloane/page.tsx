// src/app/(app)/evaluari/sabloane/page.tsx
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "employees:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta șabloanele de evaluare." />;
  }

  const poateCrea = can(permisiuni, "employees:update", "team");

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
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Șabloane de evaluare</h1>
          <p className="text-muted-foreground text-sm">
            Un set de criterii reutilizabil, aplicat apoi angajaților de pe fișa fiecăruia. Poate fi
            creat de manageri, nu doar de administratori.
          </p>
        </div>
        {poateCrea ? <FormularSablonEvaluareNou /> : null}
      </header>

      {sabloane.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Niciun șablon de evaluare"
          description="Adăugați primul șablon — de exemplu „Evaluare anuală”."
        />
      ) : (
        <ul className="space-y-3">
          {sabloane.map((sablon) => (
            <li key={sablon.id} className="border-border bg-surface rounded-lg border shadow-sm">
              <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md">
                  <ClipboardCheck aria-hidden="true" className="text-primary size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{sablon.denumire}</span>
                    {sablon.organization_id === null ? (
                      <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                        Șablon platformă
                      </span>
                    ) : null}
                    {!sablon.activ ? (
                      <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                        Inactiv
                      </span>
                    ) : null}
                  </div>
                  {sablon.descriere !== null ? (
                    <p className="text-muted-foreground mt-1 text-sm">{sablon.descriere}</p>
                  ) : null}
                  <ul className="text-muted-foreground mt-2 flex flex-wrap gap-1.5 text-xs">
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
    </main>
  );
}
