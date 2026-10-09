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
import { cn } from "@/lib/ui/cn";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisa } from "@/lib/navigare/fisa";
import { todayInBucharest } from "@/lib/format/date";

/** O componentă activă azi, cu fișa (prin RLS) a angajatului care o are. */
interface ComponentaAtribuita {
  readonly component_type_id: string;
  readonly employee_id: string;
  readonly angajat: Readonly<{
    full_name: string | null;
    marca: string;
    deleted_at: string | null;
  }> | null;
}

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

export default async function PaginaComponenteSalariale({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // `?nou=<id>`: șablonul tocmai creat, evidențiat pe server și derulat la `#sablon-<id>`.
  const nouBrut = (await searchParams)["nou"];
  const nouId = typeof nouBrut === "string" ? nouBrut : null;
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "payroll"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // `getPermissionMap` scoate `none` din hartă (`permissions.ts`), iar
  // `scopeFor` întoarce `null` pentru o cheie absentă — comparația doar cu
  // `"none"` nu era NICIODATĂ adevărată, deci poarta nu refuza pe nimeni.
  const scopeComponente = scopeFor(permisiuni, "payroll:read");
  if (scopeComponente === null || scopeComponente === "none") {
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

  /*
    Cine are fiecare șablon. Descrierea paginii spune că șabloanele „se
    asociază angajaților de pe fișa fiecăruia", dar un șablon nu arăta nici
    câți, nici care angajați îl au: înainte să-i schimbi regimul fiscal nu
    puteai vedea pe cine afectează (analiza 2026-10-08, salarizare-L17/P13).
    Doar componentele valabile azi; fișa se leagă per rând, prin `hrefFisa`.
  */
  const azi = todayInBucharest();
  const { data: atribuiri } = await db
    .from("salary_components")
    .select(
      "component_type_id, employee_id, angajat:employees!employee_id(full_name, marca, deleted_at)",
    )
    .eq("organization_id", tenant.organizationId)
    .is("deleted_at", null)
    .lte("valabil_de_la", azi)
    .or(`valabil_pana.is.null,valabil_pana.gte.${azi}`)
    .returns<ComponentaAtribuita[]>();
  const angajatiPeSablon = new Map<string, ComponentaAtribuita[]>();
  for (const atribuire of atribuiri ?? []) {
    const existente = angajatiPeSablon.get(atribuire.component_type_id) ?? [];
    if (!existente.some((e) => e.employee_id === atribuire.employee_id)) {
      angajatiPeSablon.set(atribuire.component_type_id, [...existente, atribuire]);
    }
  }

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
              id={`sablon-${sablon.id}`}
              className={cn(
                "border-border bg-surface rounded-panou shadow-ridicat scroll-mt-24 border",
                nouId === sablon.id && "ring-primary ring-2",
              )}
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
                  {(() => {
                    const cineIlAre = angajatiPeSablon.get(sablon.id) ?? [];
                    if (cineIlAre.length === 0) {
                      return (
                        <p className="text-muted-foreground text-nota mt-1">
                          Niciun angajat nu-l are în prezent.
                        </p>
                      );
                    }
                    return (
                      <p className="text-nota mt-1">
                        <span className="text-muted-foreground">
                          {cineIlAre.length === 1
                            ? "Un angajat îl are: "
                            : `${String(cineIlAre.length)} angajați îl au: `}
                        </span>
                        {cineIlAre.map((atribuire, indice) => (
                          <span key={atribuire.employee_id}>
                            {indice > 0 ? ", " : ""}
                            <LinkEntitate
                              href={hrefFisa(
                                {
                                  id: atribuire.employee_id,
                                  deleted_at: atribuire.angajat?.deleted_at ?? null,
                                },
                                permisiuni,
                              )}
                            >
                              {atribuire.angajat?.full_name ?? atribuire.angajat?.marca ?? "—"}
                            </LinkEntitate>
                          </span>
                        ))}
                      </p>
                    );
                  })()}
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
