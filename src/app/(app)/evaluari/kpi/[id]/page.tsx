// src/app/(app)/evaluari/kpi/[id]/page.tsx

/**
 * Formularul unei luni.
 *
 * Citirea e permisă oricui vede angajatul (subarbore); SCRIEREA, doar
 * managerului direct — și asta o decide baza, prin `app.este_manager_direct`.
 * Pagina nu poate ști singură dacă utilizatorul e managerul direct fără o
 * interogare în plus, deci nu ascunde formularul: îl arată, iar refuzul vine
 * cu mesaj de la acțiune. Alternativa — o a doua interogare pe fiecare
 * încărcare — ar fi plătit pentru un caz care apare la directorii de nivel doi.
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Nivel } from "@/components/ui/nivel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { citesteLunaKpi } from "@/lib/queries/kpi";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { FileEvaluari } from "../../_components/file-evaluari";

import { ETICHETE_STATUS_KPI, TONURI_STATUS_KPI, numeLuna, tonKpi } from "../etichete";
import { FormularLuna } from "./formular-luna";

export const metadata: Metadata = { title: "Luna de KPI" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaLunaKpi({ params }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "evaluations"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "evaluations:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evaluările." />;
  }

  const { id } = await params;
  const luna = await citesteLunaKpi(tenant.organizationId, id);
  if (luna === null) notFound();

  const poateEdita = can(permisiuni, "evaluations:update", "team") && luna.status === "draft";

  return (
    <div className="space-y-6">
      <AntetPagina
        firimituri={[
          { eticheta: "Evaluări", href: "/evaluari" },
          { eticheta: "KPI lunar", href: "/evaluari/kpi" },
          { eticheta: numeLuna(luna.an, luna.luna) },
        ]}
        titlu={luna.angajat ?? "Angajat"}
        descriere={`${numeLuna(luna.an, luna.luna)}${luna.marca === null ? "" : ` · marca ${luna.marca}`}`}
        file={<FileEvaluari activa="kpi" />}
        actiuni={
          <div className="flex items-center gap-3">
            <Badge ton={TONURI_STATUS_KPI[luna.status]}>{ETICHETE_STATUS_KPI[luna.status]}</Badge>
          </div>
        }
      />

      <section className="border-foreground/15 bg-card space-y-2 rounded-lg border p-4">
        <h2 className="text-eticheta text-muted-foreground font-semibold tracking-wide uppercase">
          Scorul lunii
        </h2>
        {luna.scor.procent === null ? (
          <p className="text-muted-foreground">
            Nicio linie completată încă. Scorul apare de la prima valoare pusă.
          </p>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums">{luna.scor.procent} %</p>
            <Nivel
              valoare={luna.scor.procent}
              din={100}
              eticheta="Scorul lunii"
              text={`${String(luna.scor.procent)} % din țintă`}
              ton={tonKpi(luna.scor.procent)}
            />
          </>
        )}
        <p className="text-muted-foreground text-nota tabular-nums">
          {luna.scor.completate} completate · {luna.scor.necompletate} rămase
          {luna.scor.necompletate > 0
            ? " — ponderile se calculează doar peste liniile completate"
            : ""}
        </p>
      </section>

      <FormularLuna luna={luna} poateEdita={poateEdita} />
    </div>
  );
}
