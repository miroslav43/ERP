// src/app/(app)/departamente/page.tsx
import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Departamente" };

interface RandDepartament {
  readonly id: string;
  readonly parent_id: string | null;
  readonly cod: string;
  readonly denumire: string;
  readonly activ: boolean;
  readonly manager: { readonly full_name: string } | null;
}

interface NodDepartament extends RandDepartament {
  readonly copii: readonly NodDepartament[];
  readonly numarAngajati: number;
}

const RADACINA = "radacina";

function grupeaza(
  randuri: readonly RandDepartament[],
): ReadonlyMap<string, readonly RandDepartament[]> {
  const harta = new Map<string, readonly RandDepartament[]>();
  for (const rand of randuri) {
    const cheie = rand.parent_id ?? RADACINA;
    harta.set(cheie, [...(harta.get(cheie) ?? []), rand]);
  }
  return harta;
}

function construieste(
  cheie: string,
  dupaParinte: ReadonlyMap<string, readonly RandDepartament[]>,
  numarari: ReadonlyMap<string, number>,
): readonly NodDepartament[] {
  return (dupaParinte.get(cheie) ?? []).map((rand) => ({
    ...rand,
    numarAngajati: numarari.get(rand.id) ?? 0,
    copii: construieste(rand.id, dupaParinte, numarari),
  }));
}

function Arbore({
  noduri,
  nivel,
}: {
  readonly noduri: readonly NodDepartament[];
  readonly nivel: number;
}) {
  return (
    <ul
      role={nivel === 1 ? "tree" : "group"}
      className={
        nivel === 1
          ? "space-y-2"
          : "mt-2 space-y-2 border-l border-border pl-4"
      }
    >
      {noduri.map((nod) => (
        <li
          key={nod.id}
          role="treeitem"
          aria-expanded={nod.copii.length > 0 ? true : undefined}
          aria-level={nivel}
        >
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
            <span className="font-medium">{nod.denumire}</span>
            <span className="font-mono text-xs text-muted-foreground">{nod.cod}</span>
            {!nod.activ ? (
              <span className="rounded bg-surface px-2 py-0.5 text-xs">
                Inactiv
              </span>
            ) : null}
            <span className="text-sm text-muted-foreground">
              Manager: {nod.manager?.full_name ?? "nedesemnat"}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-sm">
              <Users aria-hidden="true" className="size-4 text-muted-foreground" />
              <span>{nod.numarAngajati}</span>
              <span className="sr-only">angajați în acest departament</span>
            </span>
          </div>
          {nod.copii.length > 0 ? <Arbore noduri={nod.copii} nivel={nivel + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaDepartamente() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (scopeFor(permisiuni, "departments:read") === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta structura organizatorică." />;
  }

  const db = await createServerSupabase();
  const [structura, angajati] = await Promise.all([
    db
      .from("departments")
      .select(
        "id, parent_id, cod, denumire, activ, manager:employees!manager_employee_id(full_name)",
      )
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .order("denumire")
      .returns<RandDepartament[]>(),
    db
      .from("employees")
      .select("department_id")
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .not("department_id", "is", null)
      .returns<{ department_id: string }[]>(),
  ]);

  if (structura.error !== null) throw structura.error;

  const numarari = (angajati.data ?? []).reduce<Map<string, number>>(
    (acumulat, rand) =>
      new Map(acumulat).set(rand.department_id, (acumulat.get(rand.department_id) ?? 0) + 1),
    new Map<string, number>(),
  );
  const randuri = structura.data ?? [];
  const arbore = construieste(RADACINA, grupeaza(randuri), numarari);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Departamente</h1>
        <p className="text-sm text-muted-foreground">
          Structura organizatorică, cu managerul și numărul de angajați pe fiecare nivel.
        </p>
      </header>

      {arbore.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Structura organizatorică este goală"
          description="Adăugați primul departament pentru a putea repartiza angajații și a delega drepturile pe echipă."
        />
      ) : (
        <Arbore noduri={arbore} nivel={1} />
      )}
    </main>
  );
}
