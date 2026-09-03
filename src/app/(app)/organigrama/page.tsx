// src/app/(app)/organigrama/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { Callout } from "@/components/ui/callout";
import { StareGoala } from "@/components/ui/stare-goala";
import { cn } from "@/lib/ui/cn";
import { construiesteOrganigrama, type NodOrganigrama } from "@/domain/hr/organigrama";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import {
  arboreleManagerial,
  idFisaProprie,
  toateRolurileConturilor,
  type NodManagerial,
} from "@/lib/queries/employees";

import { ETICHETE_ROL_CONT, rolAdministrativ } from "../angajati/etichete";

export const metadata: Metadata = { title: "Organigramă" };

/**
 * Plafonul `max_rows` al PostgREST. `arboreleManagerial` nu cere o limită, deci
 * peste atâtea fișe active răspunsul se TAIE, fără eroare și fără antet care s-o
 * spună.
 *
 * Aici tăierea nu doar ascunde oameni, ci DEFORMEAZĂ ce rămâne: cine are un
 * manager rămas în afara setului vizibil e tratat ca și cum n-ar avea manager
 * deloc, deci ajunge lipit de administrator sau, în lipsa lui, devine rădăcină
 * de sine stătătoare. Organigrama arată atunci o ierarhie plauzibilă și falsă,
 * exact felul de greșeală pe care nimeni n-o observă. Pragul se compară cu
 * `>=`: la fix 1000 de rânduri nu se poate ști dacă al 1001-lea exista.
 */
const PLAFON_RANDURI = 1000;

/**
 * Ce scrie pe nod în locul funcției, când fișa n-are una.
 *
 * ── DE CE ROLUL DE CONT ȘI NU O FUNCȚIE REALĂ ─────────────────────────────
 * Patronul primește fișă dintr-un trigger (`0099_invitatia_leaga_fisa.sql`),
 * care inserează marca, numele și `status`, atât. Nu-i pune funcție, iar
 * organigrama îl afișa drept „fără funcție" — corect față de bază, dar citit ca
 * o scăpare tocmai despre omul care conduce firma.
 *
 * Nu se creează o funcție „Administrator" în nomenclator, și motivul e greu:
 * `job_positions` are `cod_cor` și hrănește REVISAL/REGES. O funcție inventată
 * pentru cineva fără contract ar fi dată falsă trimisă la ITM. Aici se schimbă
 * un cuvânt de pe ecran, nu un rând din bază — același compromis ca la
 * `etichetaStare`, unde „Candidat" devine „Fără contract".
 *
 * Eticheta se scrie cu litere cursive: e o informație DERIVATĂ din rolul din
 * aplicație, nu o funcție aleasă de cineva. Dacă mai târziu i se atribuie o
 * funcție adevărată, ea are prioritate — asta rămâne doar plasa de siguranță.
 */
function etichetaFunctiei(
  nod: NodManagerial,
  roluri: ReadonlyMap<string, string>,
): { readonly text: string; readonly derivat: boolean } {
  if (nod.functie !== null) return { text: nod.functie, derivat: false };

  const rol = rolAdministrativ(nod.user_id === null ? null : roluri.get(nod.user_id));
  if (rol !== null) return { text: ETICHETE_ROL_CONT[rol], derivat: true };

  return { text: "fără funcție", derivat: false };
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
  roluri,
}: {
  readonly noduri: readonly NodOrganigrama<NodManagerial>[];
  readonly nivel: number;
  readonly roluri: ReadonlyMap<string, string>;
}) {
  // Trunchiul care coboară din nodul părinte e punctat doar când TOATE muchiile
  // rândului sunt deduse. La un rând mixt el e parcurs și de o legătură reală.
  const totImplicit = noduri.length > 0 && noduri.every((nod) => nod.implicit);

  return (
    // `cn(...)`, nu un template literal: varianta cu `${… ? " og-implicit" : ""}`
    // a fost scrisă corect și a ieșit din formatter fără spațiul din față, adică
    // `og-ramuraog-implicit` — o clasă inexistentă, deci conectorul punctat pur
    // și simplu nu se desena. Nici `tsc`, nici ESLint, nici testele n-au ce
    // spune despre un șir de caractere. Cu `cn` separatorul nu e al nostru.
    <ul className={cn(nivel === 1 ? "og-radacina" : "og-ramura", totImplicit && "og-implicit")}>
      {noduri.map((nod) => {
        const functie = etichetaFunctiei(nod.date, roluri);
        return (
          <li key={nod.date.id} className={nod.implicit ? "og-implicit" : undefined}>
            <Link
              href={`/angajati/${nod.date.id}`}
              className="border-border bg-background hover:bg-surface hover:border-primary/40 rounded-panou shadow-ridicat flex w-40 flex-col items-center gap-1.5 border px-3 py-3 text-center"
            >
              <AvatarAngajat url={nod.date.avatar_url} nume={nod.date.full_name} marime="sm" />
              <span className="text-corp leading-tight font-medium">{nod.date.full_name}</span>
              <span className="text-muted-foreground text-nota font-mono">{nod.date.marca}</span>
              <span className="text-muted-foreground text-nota leading-tight">
                <span className={functie.derivat ? "italic" : undefined}>{functie.text}</span>
                {nod.date.department === null ? "" : ` · ${nod.date.department.denumire}`}
              </span>
              {nod.implicit ? (
                <span className="text-muted-foreground text-nota border-border/70 w-full border-t pt-1.5 leading-tight italic">
                  {nod.date.manager_employee_id === null
                    ? "manager nedesemnat"
                    : "manager inactiv sau șters"}
                </span>
              ) : null}
              {nod.copii.length > 0 ? (
                <span className="text-muted-foreground text-nota inline-flex items-center gap-1">
                  <Users aria-hidden="true" className="size-3.5" />
                  <span>{nod.copii.length}</span>
                  <span className="sr-only">subordonați direcți</span>
                </span>
              ) : null}
            </Link>
            {nod.copii.length > 0 ? (
              <Arbore noduri={nod.copii} nivel={nivel + 1} roluri={roluri} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default async function PaginaOrganigrama() {
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  const scope = scopeFor(permisiuni, "employees:read");

  if (scope === null || scope === "none") {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta organigrama. Solicitați administratorului organizației rolul potrivit." />
      </div>
    );
  }

  // Rolurile din aplicație, pe TOATE conturile organizației — `toateRolurileConturilor`,
  // nu `rolurileConturilor`: fără filtrul pe id-uri, harta nu mai depinde de
  // arbore și poate pleca în același val cu fișa proprie. Fără cheie străină
  // între `employees` și `organization_members`, PostgREST refuză embed-ul.
  // Nu cere nicio permisiune în plus: politica cere doar apartenența la
  // organizație.
  const [propriaFisaId, roluri] = await Promise.all([
    scope === "all" ? null : idFisaProprie(tenant.organizationId, utilizator.id),
    toateRolurileConturilor(tenant.organizationId),
  ]);
  const noduri = await arboreleManagerial(tenant.organizationId, scope, propriaFisaId);

  const { arbore, administrator, atasatiImplicit, radaciniFaraManagerVizibil } =
    construiesteOrganigrama(noduri, roluri);

  const posibilTrunchiat = noduri.length >= PLAFON_RANDURI;

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
          limită lipsesc oameni, iar cine avea drept manager pe cineva rămas afară apare aici ca și
          cum n-ar avea manager deloc — deci și ierarhia afișată e greșită, nu doar parțială.
          Folosiți lista de angajați, filtrată pe departament, până când ecranul primește o limită
          proprie.
        </Callout>
      ) : administrator !== null && atasatiImplicit > 0 ? (
        <Callout fel="informativ" titlu="Legături deduse, nu configurate">
          {atasatiImplicit === 1
            ? "O persoană este atașată"
            : `${String(atasatiImplicit)} persoane sunt atașate`}{" "}
          administratorului cu linie punctată, fiindcă {atasatiImplicit === 1 ? "nu are" : "nu au"}{" "}
          manager direct pe fișă. Este doar felul în care desenăm ecranul: în baza de date legătura
          nu există, deci cererile de concediu și pontajul{" "}
          {atasatiImplicit === 1 ? "persoanei" : "persoanelor"} nu ajung la nimeni spre aprobare.
          Deschideți fișa fiecăreia și completați „Manager direct” ca ierarhia să devină reală.
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
            <Arbore noduri={arbore} nivel={1} roluri={roluri} />
          </div>
        </div>
      )}
    </div>
  );
}
