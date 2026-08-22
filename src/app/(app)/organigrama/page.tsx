// src/app/(app)/organigrama/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { EmptyState } from "@/components/feedback/empty-state";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { arboreleManagerial, idFisaProprie, type NodManagerial } from "@/lib/queries/employees";

export const metadata: Metadata = { title: "Organigramă" };

const RADACINA = "radacina";

interface NodArbore extends NodManagerial {
  readonly copii: readonly NodArbore[];
}

function grupeaza(noduri: readonly NodManagerial[]): ReadonlyMap<string, readonly NodManagerial[]> {
  const idVizibile = new Set(noduri.map((n) => n.id));
  const harta = new Map<string, readonly NodManagerial[]>();
  for (const nod of noduri) {
    const areManagerVizibil =
      nod.manager_employee_id !== null && idVizibile.has(nod.manager_employee_id);
    const cheie = areManagerVizibil ? (nod.manager_employee_id as string) : RADACINA;
    harta.set(cheie, [...(harta.get(cheie) ?? []), nod]);
  }
  return harta;
}

function construieste(
  cheie: string,
  dupaManager: ReadonlyMap<string, readonly NodManagerial[]>,
): readonly NodArbore[] {
  return (dupaManager.get(cheie) ?? []).map((nod) => ({
    ...nod,
    copii: construieste(nod.id, dupaManager),
  }));
}

function Arbore({
  noduri,
  nivel,
}: {
  readonly noduri: readonly NodArbore[];
  readonly nivel: number;
}) {
  return (
    <ul role={nivel === 1 ? "tree" : "group"} className={nivel === 1 ? "og-radacina" : "og-ramura"}>
      {noduri.map((nod) => (
        <li key={nod.id} role="treeitem" aria-expanded={nod.copii.length > 0} aria-level={nivel}>
          <Link
            href={`/angajati/${nod.id}`}
            className="border-border bg-background hover:bg-surface hover:border-primary/40 flex w-40 flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center shadow-sm"
          >
            <AvatarAngajat url={nod.avatar_url} nume={nod.full_name} marime="sm" />
            <span className="text-sm leading-tight font-medium">{nod.full_name}</span>
            <span className="text-muted-foreground font-mono text-xs">{nod.marca}</span>
            <span className="text-muted-foreground text-xs leading-tight">
              {nod.job_position?.denumire ?? "fără funcție"}
              {nod.department === null ? "" : ` · ${nod.department.denumire}`}
            </span>
            {nod.copii.length > 0 ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <Users aria-hidden="true" className="size-3.5" />
                <span>{nod.copii.length}</span>
                <span className="sr-only">subordonați direcți</span>
              </span>
            ) : null}
          </Link>
          {nod.copii.length > 0 ? <Arbore noduri={nod.copii} nivel={nivel + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaOrganigrama() {
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);
  const scope = scopeFor(permisiuni, "employees:read");

  if (scope === null || scope === "none") {
    return (
      <main className="p-6">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta organigrama. Solicitați administratorului organizației rolul potrivit." />
      </main>
    );
  }

  const propriaFisaId =
    scope === "all" ? null : await idFisaProprie(tenant.organizationId, utilizator.id);
  const noduri = await arboreleManagerial(tenant.organizationId, scope, propriaFisaId);
  const arbore = construieste(RADACINA, grupeaza(noduri));

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Organigramă</h1>
        <p className="text-muted-foreground text-sm">
          {scope === "all"
            ? "Ierarhia managerială a întregii organizații."
            : scope === "team"
              ? "Ierarhia managerială a echipei dumneavoastră."
              : "Locul dumneavoastră în ierarhia managerială."}
        </p>
      </header>

      {arbore.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nimic de afișat"
          description="Ierarhia se completează pe măsură ce fișele angajaților primesc un manager direct."
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="w-fit min-w-full px-4">
            <Arbore noduri={arbore} nivel={1} />
          </div>
        </div>
      )}
    </main>
  );
}
