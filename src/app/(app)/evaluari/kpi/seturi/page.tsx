// src/app/(app)/evaluari/kpi/seturi/page.tsx

/**
 * Seturile de indicatori, câte unul per funcție.
 *
 * Un set e „ce se măsoară la postul ăsta". Ținta scrisă aici e implicita
 * funcției; abaterea per om se pune din fișa lui, nu de aici — altfel ecranul
 * ar fi trebuit să încapă și lista angajaților, iar cele două lucruri se
 * schimbă la ritmuri complet diferite.
 */

import type { Metadata } from "next";
import { Gauge } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { functiiFolosite } from "@/lib/queries/employees";
import { listeazaSeturiKpi } from "@/lib/queries/kpi";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { FileEvaluari } from "../../_components/file-evaluari";
import { ETICHETE_SENS_KPI } from "@/domain/evaluations/kpi-vocabular";

import { ActiuniSet } from "./actiuni-set";
import { ConstructorSet } from "./constructor-set";

export const metadata: Metadata = { title: "Seturi de indicatori" };

export default async function PaginaSeturiKpi() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "evaluations");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "evaluations:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evaluările." />;
  }

  const poateEdita = can(permisiuni, "evaluations:update", "team");
  const [seturi, functii] = await Promise.all([
    listeazaSeturiKpi(tenant.organizationId),
    functiiFolosite(tenant.organizationId),
  ]);

  const active = seturi.filter((s) => s.activ);
  const arhivate = seturi.filter((s) => !s.activ);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Seturi de indicatori"
        descriere="Ce se măsoară la fiecare funcție, cu ținta implicită și ponderea fiecărei linii."
        file={<FileEvaluari activa="kpi" />}
        {...(poateEdita ? { actiuni: <ConstructorSet functiiSugerate={functii} /> } : {})}
      />

      {seturi.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Gauge}
          titlu="Niciun set de indicatori"
          descriere="Un set descrie ce se măsoară la o funcție. Fără el, luna nu se poate deschide pentru angajații de pe funcția aceea."
        />
      ) : (
        <div className="space-y-8">
          <ListaSeturi
            titlu="Active"
            seturi={active}
            poateEdita={poateEdita}
            functii={functii}
            gol="Niciun set activ. Cele arhivate se pot vedea mai jos."
          />
          {arhivate.length > 0 ? (
            <ListaSeturi
              titlu="Arhivate"
              seturi={arhivate}
              poateEdita={poateEdita}
              functii={functii}
              gol=""
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ListaSeturi({
  titlu,
  seturi,
  poateEdita,
  functii,
  gol,
}: {
  readonly titlu: string;
  readonly seturi: readonly Awaited<ReturnType<typeof listeazaSeturiKpi>>[number][];
  readonly poateEdita: boolean;
  readonly functii: readonly string[];
  readonly gol: string;
}) {
  if (seturi.length === 0 && gol === "") return null;

  return (
    <section className="space-y-3">
      <h2 className="text-eticheta text-foreground font-semibold tracking-wide uppercase">
        {titlu}
      </h2>
      {seturi.length === 0 ? (
        <p className="text-muted-foreground text-nota">{gol}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {seturi.map((set) => {
            const ponderi = set.indicatori.reduce((s, i) => s + i.pondere, 0);
            return (
              <article
                key={set.id}
                className="border-foreground/15 bg-card space-y-3 rounded-lg border p-4"
              >
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{set.denumire}</h3>
                    <p className="text-muted-foreground text-nota">{set.functie}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {set.activ ? null : <Badge ton="neutru">Arhivat</Badge>}
                    {poateEdita ? <ActiuniSet set={set} functiiSugerate={functii} /> : null}
                  </div>
                </header>

                {set.descriere === null ? null : (
                  <p className="text-muted-foreground text-nota">{set.descriere}</p>
                )}

                <ul className="divide-foreground/10 text-nota divide-y">
                  {set.indicatori.map((ind) => (
                    <li key={ind.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                      <span className="font-medium">{ind.denumire}</span>
                      <span className="text-muted-foreground">
                        {ind.tip === "masurat"
                          ? `țintă ${String(ind.tinta_implicita ?? 0)}${ind.unitate === null ? "" : ` ${ind.unitate}`} · ${ind.sens === null ? "" : ETICHETE_SENS_KPI[ind.sens].toLowerCase()}`
                          : `scală 1–${String(ind.scala_max ?? 5)}`}
                      </span>
                      <span className="text-muted-foreground ms-auto tabular-nums">
                        {ind.pondere} %
                      </span>
                    </li>
                  ))}
                </ul>

                {/*
                  Ponderile NU sunt obligate să însumeze 100: `calculeazaScorLunar`
                  le renormalizează oricum. Dar o sumă mult diferită de 100 e
                  aproape sigur o scăpare, deci se spune — fără să blocheze.
                */}
                <p className="text-muted-foreground text-nota tabular-nums">
                  {set.indicatori.length} {set.indicatori.length === 1 ? "indicator" : "indicatori"}{" "}
                  · ponderi {ponderi} %
                  {Math.abs(ponderi - 100) > 0.01
                    ? " (nu însumează 100 — scorul se calculează proporțional)"
                    : ""}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
