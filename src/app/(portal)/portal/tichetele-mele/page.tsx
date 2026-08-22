// src/app/(portal)/portal/tichetele-mele/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { ticheteleMele } from "@/lib/queries/ticketing";
import { fisaMea } from "@/lib/queries/portal";
import {
  CLASE_PRIORITATE,
  CLASE_STATUS,
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
} from "@/app/(app)/ticketing/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Tichetele mele" };

export default async function PaginaTicheteleMele() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "tickets:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta tichetele de suport." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const poateDeschide = can(permisiuni, "tickets:create", "own");
  const tichete = await ticheteleMele(tenant.organizationId, stare.fisa.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Tichetele mele</h1>
          <p className="text-muted-foreground text-sm">Cererile dumneavoastră către IT.</p>
        </div>
        {poateDeschide ? (
          <Link
            href="/portal/tichetele-mele/nou"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
          >
            <Plus aria-hidden="true" className="size-4" />
            Tichet nou
          </Link>
        ) : null}
      </header>

      {tichete.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Niciun tichet deschis"
          description="Când aveți nevoie de un program, de un echipament, când s-a stricat ceva sau ați găsit o problemă în aplicație, deschideți un tichet."
        />
      ) : (
        // Listă de carduri, nu tabel: pe telefon un tabel cu șase coloane fie se
        // derulează orizontal, fie își strivește coloanele.
        <ul className="space-y-2">
          {tichete.map((tichet) => (
            <li key={tichet.id}>
              <Link
                href={`/portal/tichetele-mele/${tichet.id}`}
                className="bg-surface border-border hover:border-ring block rounded-lg border p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-medium">{tichet.titlu}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      <span className="font-mono">{tichet.numar_afisat}</span> ·{" "}
                      {ETICHETE_TIP[tichet.tip]} · {formatDate(tichet.created_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-xs ${CLASE_STATUS[tichet.status]}`}
                  >
                    {ETICHETE_STATUS[tichet.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs ${CLASE_PRIORITATE[tichet.prioritate]}`}
                  >
                    {ETICHETE_PRIORITATE[tichet.prioritate]}
                  </span>
                  {tichet.asignat === null ? (
                    <span className="text-muted-foreground text-xs">Neatribuit încă</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      La {tichet.asignat.full_name}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
