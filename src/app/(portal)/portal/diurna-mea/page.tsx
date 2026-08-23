// src/app/(portal)/portal/diurna-mea/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Plane, Plus } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { deplasarileMele, tari } from "@/lib/queries/per-diem";
import { fisaMea } from "@/lib/queries/portal";
import { CLASE_STATUS_DEPLASARE, ETICHETE_STATUS_DEPLASARE } from "@/app/(app)/diurna/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Diurna mea" };

export default async function PaginaDiurnaMea() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

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
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Diurna mea</h1>
          <p className="text-muted-foreground text-sm">Deplasările dumneavoastră și starea lor.</p>
        </div>
        {poateInregistra ? (
          <Link
            href="/portal/diurna-mea/noua"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
          >
            <Plus aria-hidden="true" className="size-4" />
            Deplasare nouă
          </Link>
        ) : null}
      </header>

      {deplasari.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="Nicio deplasare"
          description="Deplasările pe care le înregistrați apar aici, cu diurna calculată."
        />
      ) : (
        <ul className="space-y-2">
          {deplasari.map((deplasare) => (
            <li key={deplasare.id}>
              <Link
                href={`/portal/diurna-mea/${deplasare.id}`}
                className="bg-surface border-border hover:border-ring block rounded-lg border p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-medium">{deplasare.scop}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {formatDate(deplasare.plecare_la)} – {formatDate(deplasare.sosire_la)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {deplasare.localitate ?? "Fără localitate"}
                      {deplasare.country_id === null
                        ? null
                        : ` · ${denumireTara.get(deplasare.country_id) ?? "—"}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-xs ${CLASE_STATUS_DEPLASARE[deplasare.status]}`}
                  >
                    {ETICHETE_STATUS_DEPLASARE[deplasare.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
