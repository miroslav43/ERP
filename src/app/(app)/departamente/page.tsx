// src/app/(app)/departamente/page.tsx
import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { ActiuniDepartament } from "./actiuni-departament";
import { FormularDepartamentNou } from "./formular-departament-nou";

export const metadata: Metadata = { title: "Departamente" };

interface RandDepartament {
  readonly id: string;
  readonly parent_id: string | null;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly activ: boolean;
  readonly manager_employee_id: string | null;
  readonly cost_center: string | null;
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

interface OptiuneDepartament {
  readonly id: string;
  readonly denumire: string;
  readonly cod: string;
}

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string;
}

function Arbore({
  noduri,
  nivel,
  departamente,
  angajati,
  poateEdita,
}: {
  readonly noduri: readonly NodDepartament[];
  readonly nivel: number;
  readonly departamente: readonly OptiuneDepartament[];
  readonly angajati: readonly OptiuneAngajat[];
  readonly poateEdita: boolean;
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
          <div className="rounded-md border border-border px-3 py-2">
            <div className="flex flex-wrap items-center gap-3">
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
            <ActiuniDepartament
              departament={nod}
              departamente={departamente}
              angajati={angajati}
              poateEdita={poateEdita}
            />
          </div>
          {nod.copii.length > 0 ? (
            <Arbore
              noduri={nod.copii}
              nivel={nivel + 1}
              departamente={departamente}
              angajati={angajati}
              poateEdita={poateEdita}
            />
          ) : null}
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

  const poateCrea = can(permisiuni, "departments:create", "all");
  const poateEdita = can(permisiuni, "departments:update", "all");

  const db = await createServerSupabase();
  const [structura, alocari, angajatiActivi] = await Promise.all([
    db
      .from("departments")
      .select(
        "id, parent_id, cod, denumire, descriere, activ, manager_employee_id, cost_center, manager:employees!manager_employee_id(full_name)",
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
    db
      .from("employees")
      .select("id, full_name")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .returns<OptiuneAngajat[]>(),
  ]);

  if (structura.error !== null) throw structura.error;

  const numarari = (alocari.data ?? []).reduce<Map<string, number>>(
    (acumulat, rand) =>
      new Map(acumulat).set(rand.department_id, (acumulat.get(rand.department_id) ?? 0) + 1),
    new Map<string, number>(),
  );
  const randuri = structura.data ?? [];
  const arbore = construieste(RADACINA, grupeaza(randuri), numarari);
  const listaDepartamente: readonly OptiuneDepartament[] = randuri.map((r) => ({
    id: r.id,
    denumire: r.denumire,
    cod: r.cod,
  }));

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Departamente</h1>
          <p className="text-sm text-muted-foreground">
            Structura organizatorică, cu managerul și numărul de angajați pe fiecare nivel.
          </p>
        </div>
        {poateCrea ? (
          <FormularDepartamentNou departamente={listaDepartamente} angajati={angajatiActivi.data ?? []} />
        ) : null}
      </header>

      {arbore.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Structura organizatorică este goală"
          description="Adăugați primul departament pentru a putea repartiza angajații și a delega drepturile pe echipă."
        />
      ) : (
        <Arbore
          noduri={arbore}
          nivel={1}
          departamente={listaDepartamente}
          angajati={angajatiActivi.data ?? []}
          poateEdita={poateEdita}
        />
      )}
    </main>
  );
}
