// src/app/(app)/salarizare/popriri/page.tsx
import type { Metadata } from "next";
import { Gavel } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { dosarePopriri } from "@/lib/queries/payroll";
import { formatAmount } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";

import { ActiuniPoprire } from "./actiuni-poprire";
import { FormularPoprireNoua } from "./formular-poprire-noua";

export const metadata: Metadata = { title: "Popriri" };

export default async function PaginaPopriri() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (scopeFor(permisiuni, "payroll:read") === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta popririle." />;
  }

  const poateCrea = can(permisiuni, "payroll:create", "all");
  const poateEdita = can(permisiuni, "payroll:update", "all");

  const db = await createServerSupabase();
  const [dosare, { data: angajati }] = await Promise.all([
    dosarePopriri(tenant.organizationId),
    db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .returns<{ id: string; full_name: string | null; marca: string }[]>(),
  ]);

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Popriri</h1>
          <p className="text-muted-foreground text-sm">
            Dosare de urmărire silită. Reținerea se plafonează automat la o treime din salariul net
            pentru un singur dosar și la jumătate când sunt mai multe, iar dosarul se închide singur
            când datoria e stinsă.
          </p>
        </div>
        {poateCrea ? <FormularPoprireNoua angajati={angajati ?? []} /> : null}
      </header>

      {dosare.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="Niciun dosar de poprire"
          description="Când primiți o adresă de înființare a popririi de la un executor judecătoresc, deschideți aici dosarul — reținerea intră automat în calculul salarial."
        />
      ) : (
        <ul className="space-y-3">
          {dosare.map((dosar) => {
            const soldRamas = dosar.sold_ramas ?? dosar.suma_totala - dosar.suma_recuperata;
            const procent =
              dosar.suma_totala > 0
                ? Math.min(100, Math.round((dosar.suma_recuperata / dosar.suma_totala) * 100))
                : 0;
            return (
              <li key={dosar.id} className="border-border bg-surface rounded-lg border shadow-sm">
                <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md">
                    <Gavel aria-hidden="true" className="text-primary size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{dosar.angajat?.full_name ?? "—"}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {dosar.angajat?.marca ?? ""}
                      </span>
                      <span className="text-muted-foreground text-xs">dosar {dosar.dosar}</span>
                      {dosar.tip_creanta === "intretinere" ? (
                        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                          Întreținere — prioritate legală
                        </span>
                      ) : null}
                      {dosar.activa ? null : (
                        <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                          {soldRamas <= 0 ? "Stins" : "Închis"}
                        </span>
                      )}
                    </div>

                    <p className="text-muted-foreground mt-1 text-sm">
                      {dosar.creditor}
                      {dosar.executor !== null ? ` · executor ${dosar.executor}` : ""} · din{" "}
                      {formatDate(dosar.data_inceput)}
                      {dosar.data_sfarsit !== null
                        ? ` până la ${formatDate(dosar.data_sfarsit)}`
                        : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span>
                        Datorie: <strong>{formatAmount(dosar.suma_totala)} lei</strong>
                      </span>
                      <span>
                        Recuperat: <strong>{formatAmount(dosar.suma_recuperata)} lei</strong>
                      </span>
                      <span>
                        Rămas: <strong>{formatAmount(soldRamas)} lei</strong>
                      </span>
                      <span className="text-muted-foreground">
                        rată lunară {formatAmount(dosar.suma_lunara)} lei
                      </span>
                    </div>

                    <div
                      className="bg-background mt-2 h-1.5 w-full overflow-hidden rounded-full"
                      role="progressbar"
                      aria-valuenow={procent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Recuperat ${String(procent)}% din datorie`}
                    >
                      <div className="bg-primary h-full" style={{ width: `${String(procent)}%` }} />
                    </div>
                  </div>
                </div>

                {poateEdita ? (
                  <div className="border-border bg-background border-t px-4 py-2">
                    <ActiuniPoprire id={dosar.id} activa={dosar.activa} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
