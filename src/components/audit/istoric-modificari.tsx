// src/components/audit/istoric-modificari.tsx
import "server-only";

import Link from "next/link";
import { History } from "lucide-react";

import { poateDeschide } from "@/config/porti-ruta";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";

/**
 * „Istoric modificări" de pe fișa unui obiect: jurnalul de audit filtrat pe
 * rândul lui.
 *
 * Jurnalul era referit doar din meniu și din asistent, deci „cine a schimbat
 * fișa asta?" cerea navigarea prin meniu și lipirea manuală a id-ului
 * (analiza 2026-10-08, setari-L4/P4). Filtrul e DOAR `entity_id`: triggerele
 * scriu numele tabelei (`employees`), acțiunile scriu literalul singular
 * (`employee`), iar un filtru pe `entitate` ar fi ascuns una dintre familii.
 * `interogheazaJurnal` aplică `eq` pe un UUID complet, nu `ilike`.
 *
 * Autonomă, ca `NumarRegistru`: își citește porțile singură (memoizate pe
 * cerere) și nu randează nimic pentru cine nu poate deschide `/setari/audit`.
 */
export async function IstoricModificari({
  tenant,
  entityId,
}: Readonly<{
  tenant: Readonly<{
    organizationId: string;
    role: Parameters<typeof getPermissionMap>[1];
    memberId: Parameters<typeof getPermissionMap>[2];
  }>;
  entityId: string;
}>) {
  const [permisiuni, module] = await Promise.all([
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);
  if (!poateDeschide("/setari/audit", { features: module, permissions: permisiuni })) return null;

  return (
    <p className="text-muted-foreground text-nota">
      <Link
        href={`/setari/audit?entity_id=${entityId}`}
        className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
      >
        <History aria-hidden="true" className="size-3.5" />
        Istoricul modificărilor
      </Link>
    </p>
  );
}
