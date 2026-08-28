// src/app/(app)/onboarding/sabloane/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteSablon, etapeleSablonului, pasiiSablonului } from "@/lib/queries/checklist";

import { stareDinSablon } from "../../_formulare/citire";
import {
  ETICHETE_FEL_PAS,
  ETICHETE_RESPONSABIL_TIP,
  ETICHETE_ROL,
  ETICHETE_TIP,
} from "../../etichete";
import { AsistentSablon } from "../_componente/asistent-sablon";
import { optiuniAsistent } from "../_componente/optiuni";

export const metadata: Metadata = { title: "Șablon de checklist" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaSablon({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta șabloanele de checklist. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const sablon = await citesteSablon(tenant.organizationId, id);
  if (sablon === null) notFound();

  const [etape, pasi] = await Promise.all([
    etapeleSablonului(tenant.organizationId, sablon.id),
    pasiiSablonului(tenant.organizationId, sablon.id),
  ]);

  // Editarea cere `all` pe amândouă: `checklist_salveaza_sablon` inserează ȘI
  // actualizează, iar politicile din 0014 cer scope `all` pentru fiecare.
  const poateEditare =
    can(permisiuni, "checklists:update", "all") && can(permisiuni, "checklists:create", "all");

  const antet = (
    <div className="space-y-1">
      <p className="text-muted-foreground text-corp">
        <Link href="/onboarding/sabloane" className="underline-offset-2 hover:underline">
          Șabloane
        </Link>
      </p>
      <AntetPagina
        titlu={sablon.denumire}
        descriere={`${ETICHETE_TIP[sablon.tip]} · Valabil de la ${formatDate(sablon.valabil_de_la)}${
          sablon.valabil_pana_la === null ? "" : ` până la ${formatDate(sablon.valabil_pana_la)}`
        } · ${sablon.activ ? "Activ" : "Dezactivat"} · ${String(pasi.length)} pași`}
      />
    </div>
  );

  if (!poateEditare) {
    // Fără drept de editare, șablonul se CITEȘTE. Varianta veche randa oricum
    // lista cu butoane inerte; un control care nu poate reuși e mai rău decât
    // absența lui.
    return (
      <div className={`${LATIMI.detaliu} space-y-6`}>
        {antet}
        <ol className="space-y-2">
          {pasi.map((p) => {
            const etapa = etape.find((e) => e.id === p.etapa_id);
            return (
              <li key={p.id} className="border-border rounded-panou border p-3">
                <p className="font-medium">
                  {p.titlu}
                  {p.obligatoriu ? (
                    <span className="text-muted-foreground text-nota ml-1">(obligatoriu)</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-nota mt-1 flex flex-wrap items-center gap-2">
                  {etapa === undefined ? null : <Badge ton="neutru">{etapa.titlu}</Badge>}
                  <span>{ETICHETE_FEL_PAS[p.fel]}</span>
                  <span>·</span>
                  <span>
                    {ETICHETE_RESPONSABIL_TIP[p.responsabil_tip]}
                    {p.responsabil_tip === "rol" && p.responsabil_rol !== null
                      ? `: ${ETICHETE_ROL[p.responsabil_rol]}`
                      : ""}
                  </span>
                  <span>·</span>
                  <span>{p.termen_zile_relativ} zile</span>
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const optiuni = await optiuniAsistent(tenant.organizationId);

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      {antet}
      {/* Același asistent ca la creare, cu salt liber între etape: cine intră
          să schimbe un termen n-are de ce să reparcurgă tot. */}
      <AsistentSablon
        departamente={optiuni.departamente}
        posturi={optiuni.posturi}
        cursuri={optiuni.cursuri}
        materiale={optiuni.materiale}
        angajati={optiuni.angajati}
        astazi={sablon.valabil_de_la}
        initial={stareDinSablon(sablon, etape, pasi)}
      />
    </div>
  );
}
