// src/app/(app)/departamente/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { urlAvatar } from "@/lib/avatar/cale";
import { avataturiPeUtilizatori } from "@/lib/queries/profile";
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

interface AngajatDepartament {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly department_id: string | null;
  readonly avatar_url: string | null;
  readonly job_position: { readonly denumire: string } | null;
}

interface AngajatDepartamentBrut extends Omit<AngajatDepartament, "avatar_url"> {
  readonly user_id: string | null;
}

interface NodDepartament extends RandDepartament {
  readonly copii: readonly NodDepartament[];
  readonly angajatiiDepartamentului: readonly AngajatDepartament[];
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
  angajatiPeDepartament: ReadonlyMap<string, readonly AngajatDepartament[]>,
): readonly NodDepartament[] {
  return (dupaParinte.get(cheie) ?? []).map((rand) => {
    const angajatiiDepartamentului = angajatiPeDepartament.get(rand.id) ?? [];
    return {
      ...rand,
      angajatiiDepartamentului,
      numarAngajati: angajatiiDepartamentului.length,
      copii: construieste(rand.id, dupaParinte, angajatiPeDepartament),
    };
  });
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
                <span>{nod.angajatiiDepartamentului.length}</span>
                <span className="sr-only">angajați activi în acest departament</span>
              </span>
            </div>
            {nod.angajatiiDepartamentului.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {nod.angajatiiDepartamentului.map((angajat) => (
                  <li key={angajat.id}>
                    <Link
                      href={`/angajati/${angajat.id}`}
                      className="border-border hover:bg-surface inline-flex items-center gap-1.5 rounded-md border py-1 pr-2 pl-1 text-sm"
                    >
                      <AvatarAngajat url={angajat.avatar_url} nume={angajat.full_name} marime="sm" />
                      <span>{angajat.full_name}</span>
                      <span className="text-muted-foreground font-mono text-xs">{angajat.marca}</span>
                      {angajat.job_position !== null ? (
                        <span className="text-muted-foreground">· {angajat.job_position.denumire}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-3 text-sm">
                Niciun angajat activ repartizat în acest departament.
              </p>
            )}
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
  const [structura, angajatiActivi] = await Promise.all([
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
      .select(
        "id, full_name, marca, department_id, user_id, job_position:job_positions!job_position_id(denumire)",
      )
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .returns<AngajatDepartamentBrut[]>(),
  ]);

  if (structura.error !== null) throw structura.error;
  if (angajatiActivi.error !== null) throw angajatiActivi.error;

  const avataruri = await avataturiPeUtilizatori((angajatiActivi.data ?? []).map((a) => a.user_id));
  const listaAngajatiActivi: readonly AngajatDepartament[] = (angajatiActivi.data ?? []).map(
    ({ user_id, ...rest }) => ({
      ...rest,
      avatar_url: urlAvatar(avataruri.get(user_id ?? "") ?? null),
    }),
  );
  const angajatiPeDepartament = listaAngajatiActivi.reduce<Map<string, readonly AngajatDepartament[]>>(
    (acumulat, angajat) =>
      angajat.department_id === null
        ? acumulat
        : new Map(acumulat).set(angajat.department_id, [
            ...(acumulat.get(angajat.department_id) ?? []),
            angajat,
          ]),
    new Map<string, readonly AngajatDepartament[]>(),
  );
  const randuri = structura.data ?? [];
  const arbore = construieste(RADACINA, grupeaza(randuri), angajatiPeDepartament);
  const listaDepartamente: readonly OptiuneDepartament[] = randuri.map((r) => ({
    id: r.id,
    denumire: r.denumire,
    cod: r.cod,
  }));
  const optiuniAngajati: readonly OptiuneAngajat[] = listaAngajatiActivi.map((a) => ({
    id: a.id,
    full_name: a.full_name,
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
          <FormularDepartamentNou departamente={listaDepartamente} angajati={optiuniAngajati} />
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
          angajati={optiuniAngajati}
          poateEdita={poateEdita}
        />
      )}
    </main>
  );
}
