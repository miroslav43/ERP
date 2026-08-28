// src/app/(app)/onboarding/sarcinile-mele/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { angajatiDupaId, sarcinileMele } from "@/lib/queries/checklist";
import { fisaMea } from "@/lib/queries/portal";
import type { RolResponsabil } from "@/schemas/checklist";

import { ETICHETE_FEL_PAS } from "../etichete";
import { NavOnboarding } from "../nav-onboarding";

export const metadata: Metadata = { title: "Sarcinile mele de integrare" };

export default async function PaginaSarcini() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta checklisturile de integrare. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  // `super_admin` nu apare niciodată în `organization_members` și n-are fișă;
  // pentru el lista e goală, ceea ce e corect: nu e angajatul nimănui.
  const stare = await fisaMea(tenant.organizationId, user.id);
  const fisaId = stare.stare === "ok" ? stare.fisa.id : null;

  const sarcini = await sarcinileMele(tenant.organizationId, fisaId, tenant.role as RolResponsabil);

  const numeAngajati = await angajatiDupaId(tenant.organizationId, [
    ...new Set(sarcini.map((s) => s.employee_id)),
  ]);

  const azi = todayInBucharest();

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu="Sarcinile mele de integrare"
        descriere="Pașii care îmi revin mie, din parcursurile deschise ale colegilor."
      />
      <NavOnboarding />

      {sarcini.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ClipboardCheck}
          titlu="Nimic de făcut"
          descriere="Nu aveți niciun pas de integrare în lucru. Pașii atribuiți vouă apar aici imediat ce un parcurs pornește."
        />
      ) : (
        <ul className="space-y-2">
          {sarcini.map((sarcina) => {
            const intarziat = sarcina.termen !== null && sarcina.termen < azi;
            const angajat = numeAngajati.get(sarcina.employee_id);
            return (
              <li key={sarcina.id}>
                <Link
                  href={`/onboarding/${sarcina.instance_id}`}
                  className="bg-surface border-border hover:border-ring rounded-panou block border p-4 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {sarcina.titlu}
                        {sarcina.obligatoriu ? (
                          <span className="text-muted-foreground text-nota ml-1">
                            (obligatoriu)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground text-nota mt-1 flex flex-wrap items-center gap-2">
                        <span>
                          {angajat === undefined
                            ? "Un coleg"
                            : (angajat.full_name ?? angajat.marca)}
                        </span>
                        {sarcina.etapa_titlu === null ? null : (
                          <>
                            <span>·</span>
                            <span>{sarcina.etapa_titlu}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{ETICHETE_FEL_PAS[sarcina.fel]}</span>
                      </p>
                    </div>
                    {sarcina.termen === null ? null : (
                      // Tonul spune ce e de făcut ACUM; data spune când.
                      <Badge ton={intarziat ? "pericol" : "atentie"}>
                        {intarziat ? "Termen depășit · " : "Termen "}
                        {formatDate(sarcina.termen)}
                      </Badge>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
