// src/app/(app)/organigrama/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { Callout } from "@/components/ui/callout";
import { StareGoala } from "@/components/ui/stare-goala";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { arboreleManagerial, idFisaProprie, type NodManagerial } from "@/lib/queries/employees";

export const metadata: Metadata = { title: "Organigramă" };

const RADACINA = "radacina";

/**
 * Plafonul `max_rows` al PostgREST. `arboreleManagerial` nu cere o limită, deci
 * peste atâtea fișe active răspunsul se TAIE, fără eroare și fără antet care s-o
 * spună.
 *
 * Aici tăierea nu doar ascunde oameni, ci DEFORMEAZĂ ce rămâne: `grupeaza` pune
 * la rădăcină orice nod al cărui manager nu e în setul vizibil, deci fiecare
 * subordonat al cuiva rămas afară devine o rădăcină de sine stătătoare.
 * Organigrama arată atunci zeci de arbori paraleli — o ierarhie plauzibilă și
 * falsă, exact felul de greșeală pe care nimeni n-o observă. Pragul se compară
 * cu `>=`: la fix 1000 de rânduri nu se poate ști dacă al 1001-lea exista.
 */
const PLAFON_RANDURI = 1000;

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

/**
 * Listă imbricată simplă, fără `role="tree"`.
 *
 * Varianta veche marca fiecare nod cu `role="treeitem"` și `aria-expanded`,
 * deși: (1) în fiecare nod stă un `<a>` focusabil, iar pattern-ul ARIA de tip
 * tree interzice descendenți interactivi — cititorul de ecran anunța „element
 * de arbore”, dar Tab ateriza pe link, nu pe nod, iar săgețile nu făceau nimic;
 * (2) `aria-expanded` era `true` pe fiecare nod cu copii și nimic nu se putea
 * strânge, deci atributul PROMITEA o interacțiune inexistentă. O listă
 * imbricată obișnuită spune adevărul: ierarhia se citește din structura `ul`,
 * iar singurul lucru interactiv e linkul. Vezi aceeași notă în
 * `departamente/page.tsx`.
 */
function Arbore({
  noduri,
  nivel,
}: {
  readonly noduri: readonly NodArbore[];
  readonly nivel: number;
}) {
  return (
    <ul className={nivel === 1 ? "og-radacina" : "og-ramura"}>
      {noduri.map((nod) => (
        <li key={nod.id}>
          <Link
            href={`/angajati/${nod.id}`}
            className="border-border bg-background hover:bg-surface hover:border-primary/40 rounded-panou shadow-ridicat flex w-40 flex-col items-center gap-1.5 border px-3 py-3 text-center"
          >
            <AvatarAngajat url={nod.avatar_url} nume={nod.full_name} marime="sm" />
            <span className="text-corp leading-tight font-medium">{nod.full_name}</span>
            <span className="text-muted-foreground text-nota font-mono">{nod.marca}</span>
            <span className="text-muted-foreground text-nota leading-tight">
              {nod.job_position?.denumire ?? "fără funcție"}
              {nod.department === null ? "" : ` · ${nod.department.denumire}`}
            </span>
            {nod.copii.length > 0 ? (
              <span className="text-muted-foreground text-nota inline-flex items-center gap-1">
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "employees:read");

  if (scope === null || scope === "none") {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta organigrama. Solicitați administratorului organizației rolul potrivit." />
      </div>
    );
  }

  const propriaFisaId =
    scope === "all" ? null : await idFisaProprie(tenant.organizationId, utilizator.id);
  const noduri = await arboreleManagerial(tenant.organizationId, scope, propriaFisaId);
  const arbore = construieste(RADACINA, grupeaza(noduri));

  const posibilTrunchiat = noduri.length >= PLAFON_RANDURI;

  // Rădăcinile „artificiale”: noduri care AU un manager, dar al căror manager
  // nu e în setul vizibil. Una singură e normală cu scope „team”/„own” (vârful
  // subarborelui propriu). Mai multe înseamnă manageri inactivi sau șterși —
  // sau, dacă lista a fost tăiată, oameni pe care ecranul îi arată ca șefi de
  // sine stătători fără să fie.
  const radaciniFaraManagerVizibil = arbore.filter(
    (nod) => nod.manager_employee_id !== null,
  ).length;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Organigramă"
        descriere={`${
          scope === "all"
            ? "Ierarhia managerială a întregii organizații."
            : scope === "team"
              ? "Ierarhia managerială a echipei dumneavoastră."
              : "Locul dumneavoastră în ierarhia managerială."
        } ${String(noduri.length)} ${noduri.length === 1 ? "fișă activă" : "fișe active"}.`}
      />

      {posibilTrunchiat ? (
        <Callout fel="atentie" titlu="Organigrama este incompletă">
          Baza a întors {String(noduri.length)} de fișe, plafonul unei singure cereri. Peste această
          limită lipsesc oameni, iar subordonații celor lipsă apar drept rădăcini separate — deci și
          ierarhia afișată e greșită, nu doar parțială. Folosiți lista de angajați, filtrată pe
          departament, până când ecranul primește o limită proprie.
        </Callout>
      ) : radaciniFaraManagerVizibil > 1 && scope === "all" ? (
        <Callout fel="informativ">
          {String(radaciniFaraManagerVizibil)} persoane apar drept rădăcini fiindcă managerul lor
          direct nu e printre fișele active — fișă inactivă, plecată din firmă, sau manager
          nedesemnat. Corectați managerul direct pe fișa fiecăreia ca să intre în ierarhie.
        </Callout>
      ) : null}

      {arbore.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Users}
          titlu="Nimic de afișat"
          descriere="Ierarhia se completează pe măsură ce fișele angajaților primesc un manager direct."
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="w-fit min-w-full px-4">
            <Arbore noduri={arbore} nivel={1} />
          </div>
        </div>
      )}
    </div>
  );
}
