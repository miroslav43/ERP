// src/app/(portal)/portal/tichetele-mele/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { ticheteleMele } from "@/lib/queries/ticketing";
import { fisaMea } from "@/lib/queries/portal";
import {
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  TONURI_PRIORITATE,
  TONURI_STATUS,
} from "@/app/(app)/ticketing/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Tichetele mele" };

export default async function PaginaTicheteleMele() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina
        titlu="Tichetele mele"
        descriere="Cererile dumneavoastră către IT."
        {...(poateDeschide
          ? {
              actiuni: (
                <Link href="/portal/tichetele-mele/nou" className={buton({ varianta: "primar" })}>
                  <Plus aria-hidden="true" className="size-4" />
                  Tichet nou
                </Link>
              ),
            }
          : {})}
      />

      {tichete.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={LifeBuoy}
          titlu="Niciun tichet deschis"
          descriere="Când aveți nevoie de un program, de un echipament, când s-a stricat ceva sau ați găsit o problemă în aplicație, deschideți un tichet."
        />
      ) : (
        // Listă de carduri, nu tabel: pe telefon un tabel cu șase coloane fie se
        // derulează orizontal, fie își strivește coloanele.
        <ul className="space-y-2">
          {tichete.map((tichet) => (
            <li key={tichet.id}>
              <Link
                href={`/portal/tichetele-mele/${tichet.id}`}
                className="bg-surface border-border hover:border-ring rounded-panou block border p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground text-corp font-medium">{tichet.titlu}</p>
                    <p className="text-muted-foreground text-nota mt-0.5">
                      <span className="font-mono">{tichet.numar_afisat}</span> ·{" "}
                      {ETICHETE_TIP[tichet.tip]} · {formatDate(tichet.created_at)}
                    </p>
                  </div>
                  <Badge ton={TONURI_STATUS[tichet.status]} className="shrink-0">
                    {ETICHETE_STATUS[tichet.status]}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge ton={TONURI_PRIORITATE[tichet.prioritate]}>
                    {ETICHETE_PRIORITATE[tichet.prioritate]}
                  </Badge>
                  {tichet.asignat === null ? (
                    <span className="text-muted-foreground text-nota">Neatribuit încă</span>
                  ) : (
                    <span className="text-muted-foreground text-nota">
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
