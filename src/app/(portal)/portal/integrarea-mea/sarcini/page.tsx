// src/app/(portal)/portal/integrarea-mea/sarcini/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
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
import { ETICHETE_STATUS_ITEM, TONURI_STATUS_ITEM } from "@/app/(app)/onboarding/etichete";

import { FaraFisa } from "../../fara-fisa";

export const metadata: Metadata = { title: "Pașii mei la colegi" };

/**
 * Pașii din integrarea COLEGILOR care îmi revin mie.
 *
 * RLS îi dădea angajatului desemnat responsabil acces la pașii din parcursul
 * unui coleg — citire (0014:835, 0089:418) și bifare (0014:864) — dar portalul
 * n-avea niciun ecran pentru ei: „Integrarea mea" filtra pe `employee_id = fișa
 * mea`, iar `/onboarding/<uuid>` din notificare îl arunca pe `/portal` (analiza
 * 2026-10-08, portal-L2/P2). Aceeași citire ca „Sarcinile mele" din aplicația
 * mare (`sarcinileMele`), ca cifra din „De făcut" și lista să nu poată diverge.
 */
export default async function PaginaPasiiMeiLaColegi() {
  const { tenant, user } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "onboarding"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta pașii de integrare." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  // Doar pașii din parcursurile ALTORA: cei din propriul parcurs stau pe
  // „Integrarea mea", iar aici ar fi dublați.
  const sarcini = (
    await sarcinileMele(tenant.organizationId, stare.fisa.id, tenant.role as RolResponsabil)
  ).filter((s) => s.employee_id !== stare.fisa.id);
  const colegi = await angajatiDupaId(tenant.organizationId, [
    ...new Set(sarcini.map((s) => s.employee_id)),
  ]);
  const azi = todayInBucharest();

  return (
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina
        firimituri={[{ eticheta: "Integrarea mea", href: "/portal/integrarea-mea" }]}
        titlu="Pașii mei la colegi"
        descriere="Pașii din parcursurile colegilor pentru care sunteți responsabil."
      />

      {sarcini.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ClipboardCheck}
          titlu="Niciun pas de făcut la colegi"
          descriere="Când un coleg pornește un parcurs în care aveți un pas, el apare aici."
        />
      ) : (
        <ul className="space-y-2">
          {sarcini.map((sarcina) => {
            const intarziat = sarcina.termen !== null && sarcina.termen < azi;
            const coleg = colegi.get(sarcina.employee_id);
            return (
              <li key={sarcina.id}>
                <Link
                  href={`/portal/integrarea-mea/${sarcina.instance_id}`}
                  className="bg-surface border-border hover:border-ring rounded-panou block border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground text-corp font-medium">{sarcina.titlu}</p>
                      <p className="text-muted-foreground text-corp mt-0.5">
                        {/* Fișa colegului se citește prin RLS: dacă n-o vede, rămâne „un coleg”. */}
                        Pentru {coleg?.full_name ?? "un coleg"}
                        {sarcina.etapa_titlu === null ? "" : ` · ${sarcina.etapa_titlu}`}
                      </p>
                      {sarcina.termen === null ? null : (
                        <p
                          className={`text-nota mt-0.5 ${intarziat ? "text-danger" : "text-muted-foreground"}`}
                        >
                          Termen {formatDate(sarcina.termen)}
                          {intarziat ? " — depășit" : ""}
                        </p>
                      )}
                    </div>
                    <Badge className="shrink-0" ton={TONURI_STATUS_ITEM[sarcina.status]}>
                      {ETICHETE_STATUS_ITEM[sarcina.status]}
                    </Badge>
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
