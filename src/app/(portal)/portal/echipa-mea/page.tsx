// src/app/(portal)/portal/echipa-mea/page.tsx
//
// Ramura proprie din organigramă, pentru angajat.
//
// De ce există pagina asta, deși `/organigrama` face același lucru: rolul
// `employee` NU ajunge niciodată acolo. `(app)/layout.tsx:64` îl redirectează
// la `/portal` (`POARTA_PORTAL_ACTIVA`), iar niciuna din paginile portalului
// nu era organigramă. Ramura `scope === "own"` din `arboreleManagerial`
// (`queries/employees.ts:348-390`) — cea care construiește exact „lanțul lui de
// șefi plus subordonații lui" — era, la configurația implicită, COD MORT.
//
// Reutilizează aceeași funcție de citire, cu `scope = "own"`. Zero cod de query
// nou: dacă ar fi fost o a doua interogare, cele două ar fi putut diverge, iar
// angajatul ar fi văzut altceva decât administratorul.
import type { Metadata } from "next";
import { Network } from "lucide-react";

import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { arboreleManagerial, idFisaProprie, type NodManagerial } from "@/lib/queries/employees";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { fisaMea } from "@/lib/queries/portal";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Echipa mea" };

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

function Ramura({
  noduri,
  nivel,
  idPropriu,
}: {
  readonly noduri: readonly NodArbore[];
  readonly nivel: number;
  readonly idPropriu: string | null;
}) {
  if (noduri.length === 0) return null;
  return (
    <ul role={nivel === 1 ? "tree" : "group"} className="space-y-2">
      {noduri.map((nod) => {
        const esteEu = nod.id === idPropriu;
        return (
          <li key={nod.id} role="treeitem" aria-selected={esteEu} aria-level={nivel}>
            <div
              className={`rounded-panou flex items-center gap-3 border p-3 ${
                esteEu ? "border-primary bg-primary/5" : "border-border bg-surface"
              }`}
            >
              <AvatarAngajat url={nod.avatar_url} nume={nod.full_name} marime="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-corp truncate font-medium">
                  {nod.full_name}
                  {esteEu ? <span className="text-primary text-nota ml-2">(tu)</span> : null}
                </p>
                <p className="text-muted-foreground text-nota truncate">
                  {[nod.job_position?.denumire, nod.department?.denumire]
                    .filter((v): v is string => v !== undefined && v !== null)
                    .join(" · ")}
                </p>
              </div>
            </div>
            {nod.copii.length > 0 ? (
              <div className="border-border mt-2 ml-4 border-l pl-4">
                <Ramura noduri={nod.copii} nivel={nivel + 1} idPropriu={idPropriu} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default async function PaginaEchipaMea() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const idPropriu = await idFisaProprie(tenant.organizationId, user.id);
  // `scope = "own"`, mereu: portalul e al angajatului. Chiar dacă cineva cu rol
  // de manager ar ajunge aici, vede tot ramura lui — pentru vederea completă
  // există `/organigrama`, sub `(app)`.
  const noduri = await arboreleManagerial(tenant.organizationId, "own", idPropriu);
  const arbore = construieste(RADACINA, grupeaza(noduri));

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Echipa mea"
        descriere="Locul tău în organizație: lanțul de șefi deasupra ta și, dacă ai, oamenii din subordine. Restul firmei nu apare aici."
      />

      {arbore.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Network}
          titlu="Ierarhia nu e configurată încă"
          descriere="Fișa ta nu are un manager direct înregistrat, iar nimeni nu te are pe tine ca manager. Anunță departamentul de resurse umane."
        />
      ) : (
        <Ramura noduri={arbore} nivel={1} idPropriu={idPropriu} />
      )}
    </div>
  );
}
