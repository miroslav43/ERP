// src/app/(portal)/portal/diurna-mea/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Plane, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { deplasarileMele, tari } from "@/lib/queries/per-diem";
import { fisaMea } from "@/lib/queries/portal";
import { ETICHETE_STATUS_DEPLASARE, TONURI_STATUS_DEPLASARE } from "@/app/(app)/diurna/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Diurna mea" };

export default async function PaginaDiurnaMea() {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "per_diem"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const poateInregistra = can(permisiuni, "per_diem:create", "own");
  const [deplasari, listaTari] = await Promise.all([
    deplasarileMele(tenant.organizationId, stare.fisa.id),
    tari(),
  ]);
  const denumireTara = new Map(listaTari.map((t) => [t.id, t.denumire]));

  return (
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina
        titlu="Diurna mea"
        descriere="Deplasările dumneavoastră și starea lor."
        {...(poateInregistra
          ? {
              actiuni: (
                <Link href="/portal/diurna-mea/noua" className={buton({ varianta: "primar" })}>
                  <Plus aria-hidden="true" className="size-4" />
                  Deplasare nouă
                </Link>
              ),
            }
          : {})}
      />

      {deplasari.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Plane}
          titlu="Nicio deplasare"
          descriere="Deplasările pe care le înregistrați apar aici, cu diurna calculată."
        />
      ) : (
        <ul className="space-y-2">
          {deplasari.map((deplasare) => (
            <li key={deplasare.id}>
              <Link
                href={`/portal/diurna-mea/${deplasare.id}`}
                className="bg-surface border-border hover:border-ring rounded-panou block border p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground text-corp font-medium">{deplasare.scop}</p>
                    <p className="text-muted-foreground text-corp mt-0.5">
                      {formatDate(deplasare.plecare_la)} – {formatDate(deplasare.sosire_la)}
                    </p>
                    <p className="text-muted-foreground text-nota mt-0.5">
                      {deplasare.localitate ?? "Fără localitate"}
                      {deplasare.country_id === null
                        ? null
                        : ` · ${denumireTara.get(deplasare.country_id) ?? "—"}`}
                    </p>
                  </div>
                  <Badge className="shrink-0" ton={TONURI_STATUS_DEPLASARE[deplasare.status]}>
                    {ETICHETE_STATUS_DEPLASARE[deplasare.status]}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
