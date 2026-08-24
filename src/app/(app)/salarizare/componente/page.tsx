// src/app/(app)/salarizare/componente/page.tsx
import type { Metadata } from "next";
import { Percent } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { ActiuniSablonComponenta } from "./actiuni-sablon-componenta";
import { FormularSablonComponentaNou } from "./formular-sablon-componenta-nou";

export const metadata: Metadata = { title: "Sporuri și prime" };

const ETICHETE_TIP: Readonly<Record<string, string>> = {
  spor_procent: "Spor procentual",
  spor_suma: "Spor — sumă fixă",
  indemnizatie: "Indemnizație",
  prima_recurenta: "Primă recurentă",
  beneficiu_natura: "Beneficiu în natură",
};

interface RandSablon {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly kind: string;
  readonly impozabil: boolean;
  readonly intra_in_baza_cas: boolean;
  readonly intra_in_baza_cass: boolean;
  readonly cod_revisal: string | null;
  readonly activ: boolean;
  readonly organization_id: string | null;
}

export default async function PaginaComponenteSalariale() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (scopeFor(permisiuni, "payroll:read") === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sporurile și primele." />;
  }

  const poateCrea = can(permisiuni, "payroll:create", "all");
  const poateEdita = can(permisiuni, "payroll:update", "all");

  const db = await createServerSupabase();
  // Șabloanele platformă (organization_id null) sunt vizibile tuturor, dar
  // needitabile — doar cele proprii organizației pot fi schimbate/dezactivate.
  const { data, error } = await db
    .from("salary_component_types")
    .select(
      "id, cod, denumire, kind, impozabil, intra_in_baza_cas, intra_in_baza_cass, cod_revisal, activ, organization_id",
    )
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
        titlu="Sporuri și prime"
        descriere="Șabloane reutilizabile — se creează o singură dată, apoi se asociază angajaților de pe fișa fiecăruia, cu un procent sau o sumă fixă."
        {...(poateCrea ? { actiuni: <FormularSablonComponentaNou /> } : {})}
      />

      {sabloane.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Percent}
          titlu="Niciun șablon de spor sau primă"
          descriere="Adăugați primul șablon — de exemplu „Spor de vechime” sau „Primă de performanță”."
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
                  <Percent aria-hidden="true" className="text-primary size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{sablon.denumire}</span>
                    <span className="text-muted-foreground text-nota font-mono">{sablon.cod}</span>
                    <span className="bg-primary/10 text-primary text-nota rounded-full px-2 py-0.5 font-medium">
                      {ETICHETE_TIP[sablon.kind] ?? sablon.kind}
                    </span>
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
                  <p className="text-muted-foreground text-corp mt-1">
                    {sablon.impozabil ? "Impozabil" : "Neimpozabil"} ·{" "}
                    {sablon.intra_in_baza_cas ? "intră în baza CAS" : "nu intră în baza CAS"} ·{" "}
                    {sablon.intra_in_baza_cass ? "intră în baza CASS" : "nu intră în baza CASS"}
                    {sablon.cod_revisal !== null ? ` · cod REVISAL ${sablon.cod_revisal}` : ""}
                  </p>
                </div>
              </div>
              {poateEdita && sablon.organization_id !== null ? (
                <div className="border-border bg-background border-t px-4 py-2">
                  <ActiuniSablonComponenta sablon={sablon} poateEdita={poateEdita} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
