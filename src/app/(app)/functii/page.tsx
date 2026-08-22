// src/app/(app)/functii/page.tsx
import type { Metadata } from "next";
import { Briefcase } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { ActiuniFunctie } from "./actiuni-functie";
import { FormularFunctieNoua } from "./formular-functie-noua";

export const metadata: Metadata = { title: "Funcții" };

interface RandFunctie {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly cod_cor: string | null;
  readonly nivel_studii: string | null;
  readonly descriere: string | null;
  readonly activ: boolean;
}

export default async function PaginaFunctii() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (scopeFor(permisiuni, "departments:read") === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta nomenclatorul de funcții." />;
  }

  const poateCrea = can(permisiuni, "departments:create", "all");
  const poateEdita = can(permisiuni, "departments:update", "all");

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("job_positions")
    .select("id, cod, denumire, cod_cor, nivel_studii, descriere, activ")
    .eq("organization_id", tenant.organizationId)
    .is("deleted_at", null)
    .order("denumire")
    .returns<RandFunctie[]>();
  if (error !== null) throw error;

  const functii = data ?? [];

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Funcții</h1>
          <p className="text-muted-foreground text-sm">
            Nomenclatorul de funcții al companiei. Codul COR (Clasificarea Ocupațiilor din România)
            e necesar pentru contract și REVISAL.
          </p>
        </div>
        {poateCrea ? <FormularFunctieNoua /> : null}
      </header>

      {functii.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nicio funcție înregistrată"
          description="Adăugați prima funcție — codul și denumirea din ultima variantă REVISAL a nomenclatorului COR."
        />
      ) : (
        <ul className="space-y-3">
          {functii.map((functie) => (
            <li key={functie.id} className="border-border bg-surface rounded-lg border shadow-sm">
              <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md">
                  <Briefcase aria-hidden="true" className="text-primary size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{functie.denumire}</span>
                    <span className="text-muted-foreground font-mono text-xs">{functie.cod}</span>
                    {functie.cod_cor !== null ? (
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                        COR {functie.cod_cor}
                      </span>
                    ) : null}
                    {!functie.activ ? (
                      <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                        Inactivă
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {[functie.nivel_studii, functie.descriere].filter(Boolean).join(" · ") ||
                      "Fără detalii suplimentare."}
                  </p>
                </div>
              </div>
              {poateEdita ? (
                <div className="border-border bg-background border-t px-4 py-2">
                  <ActiuniFunctie functie={functie} poateEdita={poateEdita} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
