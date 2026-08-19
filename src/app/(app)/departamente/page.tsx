// src/app/(app)/departamente/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Building2, ChevronRight, Users } from "lucide-react";

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
  readonly manager: { readonly full_name: string; readonly avatar_url: string | null } | null;
}

interface RandDepartamentBrut extends Omit<RandDepartament, "manager"> {
  readonly manager: { readonly full_name: string; readonly user_id: string | null } | null;
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

/**
 * Fiecare card e o pereche <details>/rând de acțiuni, NU acțiunile ÎN
 * <summary>: un buton imbricat în <summary> ar cere stopPropagation ca să nu
 * declanșeze și extinderea la fiecare clic. Separate, rândul de acțiuni rămâne
 * mereu vizibil (editarea unui departament n-ar trebui să ceară mai întâi
 * desfacerea listei de angajați), iar lista de angajați — partea care crește
 * necontrolat la o organizație mare — se strânge implicit.
 *
 * Fără role="tree"/"treeitem" (spre deosebire de /organigrama): acolo chiar e
 * un widget de navigare ierarhică fără elemente interactive imbricate; aici e
 * o listă administrativă obișnuită, cu link-uri și formulare în interior —
 * exact ce pattern-ul ARIA de tip tree interzice.
 */
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
    <ul className={nivel === 1 ? "space-y-3" : "border-primary/15 mt-3 ml-6 space-y-3 border-l-2 pl-5"}>
      {noduri.map((nod) => (
        <li key={nod.id}>
          <div className="border-border bg-surface overflow-hidden rounded-lg border shadow-sm">
            <details className="group">
              <summary className="focus-visible:outline-ring flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md">
                  <Building2 aria-hidden="true" className="text-primary size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{nod.denumire}</span>
                    <span className="text-muted-foreground font-mono text-xs">{nod.cod}</span>
                    {!nod.activ ? (
                      <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                        Inactiv
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-sm">
                    {nod.manager !== null ? (
                      <Link
                        href={`/angajati/${nod.manager_employee_id}`}
                        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
                      >
                        <AvatarAngajat url={nod.manager.avatar_url} nume={nod.manager.full_name} marime="sm" />
                        {nod.manager.full_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground italic">manager nedesemnat</span>
                    )}
                  </span>
                </span>
                <span className="bg-background text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
                  <Users aria-hidden="true" className="size-3.5" />
                  {nod.angajatiiDepartamentului.length}
                  <span className="sr-only">angajați activi în acest departament</span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90"
                />
              </summary>

              <div className="border-border border-t px-4 py-3">
                {nod.angajatiiDepartamentului.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {nod.angajatiiDepartamentului.map((angajat) => (
                      <li key={angajat.id}>
                        <Link
                          href={`/angajati/${angajat.id}`}
                          className="border-border bg-background hover:border-primary/30 hover:bg-primary/5 inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors"
                        >
                          <AvatarAngajat url={angajat.avatar_url} nume={angajat.full_name} marime="sm" />
                          <span className="font-medium">{angajat.full_name}</span>
                          <span className="text-muted-foreground font-mono text-xs">{angajat.marca}</span>
                          {angajat.job_position !== null ? (
                            <span className="text-muted-foreground">· {angajat.job_position.denumire}</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">
                    Niciun angajat activ repartizat în acest departament.
                  </p>
                )}
              </div>
            </details>

            {poateEdita ? (
              <div className="border-border bg-background border-t px-4 py-2">
                <ActiuniDepartament
                  departament={nod}
                  departamente={departamente}
                  angajati={angajati}
                  poateEdita={poateEdita}
                />
              </div>
            ) : null}
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
        "id, parent_id, cod, denumire, descriere, activ, manager_employee_id, cost_center, manager:employees!manager_employee_id(full_name, user_id)",
      )
      .eq("organization_id", tenant.organizationId)
      .is("deleted_at", null)
      .order("denumire")
      .returns<RandDepartamentBrut[]>(),
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

  const structuraBruta = structura.data ?? [];
  const angajatiiBruti = angajatiActivi.data ?? [];
  const avataruri = await avataturiPeUtilizatori([
    ...angajatiiBruti.map((a) => a.user_id),
    ...structuraBruta.map((d) => d.manager?.user_id ?? null),
  ]);

  const listaAngajatiActivi: readonly AngajatDepartament[] = angajatiiBruti.map(
    ({ user_id, ...rest }) => ({
      ...rest,
      avatar_url: urlAvatar(avataruri.get(user_id ?? "") ?? null),
    }),
  );
  const randuri: readonly RandDepartament[] = structuraBruta.map((d) => ({
    ...d,
    manager:
      d.manager === null
        ? null
        : {
            full_name: d.manager.full_name,
            avatar_url: urlAvatar(avataruri.get(d.manager.user_id ?? "") ?? null),
          },
  }));

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
