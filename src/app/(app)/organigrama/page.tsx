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
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import {
  arboreleManagerial,
  fiseDupaId,
  idFisaProprie,
  toateRolurileConturilor,
  type NodManagerial,
} from "@/lib/queries/employees";

import { ETICHETE_ROL_CONT, rolAdministrativ } from "../angajati/etichete";
import { poateDeschide, type ContextPorti } from "@/config/porti-ruta";

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
  evidentiat,
  poateEdita,
  scope,
  manageriAscunsi,
  poateSchimbaRoluri,
}: {
  readonly noduri: readonly NodOrganigrama<NodManagerial>[];
  readonly nivel: number;
  readonly roluri: ReadonlyMap<string, string>;
  /** `?angajat=<id>`: nodul la care a trimis alt ecran, evidențiat pe server. */
  readonly evidentiat: string | null;
  /** `employees:update` all: nodul cu manager dedus primește „Setează managerul". */
  readonly poateEdita: boolean;
  readonly scope: string;
  /** Managerii rădăcinilor care NU sunt printre fișele active: numiți, nu doar „inactiv sau șters". */
  readonly manageriAscunsi: ReadonlyMap<string, Readonly<{ full_name: string; status: string }>>;
  /** `users:update` all: eticheta de rol duce la pagina de permisiuni. */
  readonly poateSchimbaRoluri: boolean;
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
        // Rădăcină cu manager pe fișă, dar nevizibil ca fișă activă: aceeași
        // consecință ca legătura dedusă (nimeni nu-i aprobă nimic), deci același
        // marcaj. Doar sub `all` — sub `team` managerul poate fi pur și simplu
        // în afara echipei.
        const managerAscuns =
          !nod.implicit && nivel === 1 && scope === "all" && nod.date.manager_employee_id !== null;
        const managerNumit =
          nod.date.manager_employee_id === null
            ? null
            : (manageriAscunsi.get(nod.date.manager_employee_id) ?? null);
        return (
          <li
            key={nod.date.id}
            id={`angajat-${nod.date.id}`}
            className={cn("scroll-mt-24", nod.implicit && "og-implicit")}
          >
            {/* Cardul rămâne apăsabil în întregime (linkul numelui se întinde
                peste el), dar departamentul și funcția au linkurile LOR, deasupra
                (`relative z-10`): un `<a>` în alt `<a>` nu e permis. */}
            <div
              className={cn(
                "border-border bg-background hover:bg-surface hover:border-primary/40 rounded-panou shadow-ridicat relative flex w-40 flex-col items-center gap-1.5 border px-3 py-3 text-center",
                evidentiat === nod.date.id && "ring-primary ring-2",
              )}
            >
              <AvatarAngajat url={nod.date.avatar_url} nume={nod.date.full_name} marime="sm" />
              <Link
                href={`/angajati/${nod.date.id}`}
                className="text-corp leading-tight font-medium after:absolute after:inset-0"
              >
                {nod.date.full_name}
              </Link>
              <span className="text-muted-foreground text-nota font-mono">{nod.date.marca}</span>
              <span className="text-muted-foreground text-nota leading-tight">
                {functie.derivat && poateSchimbaRoluri ? (
                  // Eticheta e derivată din rolul de cont: duce unde se schimbă rolul.
                  <Link
                    href={`/angajati/${nod.date.id}/permisiuni`}
                    className="relative z-10 italic hover:underline"
                  >
                    {functie.text}
                  </Link>
                ) : nod.date.functie === null || functie.derivat ? (
                  <span className={functie.derivat ? "italic" : undefined}>{functie.text}</span>
                ) : (
                  <Link
                    href={`/angajati?functie=${encodeURIComponent(nod.date.functie)}&status=activ`}
                    className="relative z-10 hover:underline"
                  >
                    {functie.text}
                  </Link>
                )}
                {nod.date.department === null ? null : (
                  <>
                    {" · "}
                    <Link
                      href={`/angajati?department_id=${nod.date.department.id}&status=activ`}
                      className="relative z-10 hover:underline"
                    >
                      {nod.date.department.denumire}
                    </Link>
                  </>
                )}
              </span>
              {nod.implicit || managerAscuns ? (
                <span className="text-muted-foreground text-nota border-border/70 w-full border-t pt-1.5 leading-tight italic">
                  {nod.date.manager_employee_id === null ? (
                    "manager nedesemnat"
                  ) : managerNumit === null ? (
                    "manager inactiv sau șters"
                  ) : (
                    <>
                      manager {managerNumit.status === "activ" ? "din afara ierarhiei" : "inactiv"}:{" "}
                      <Link
                        href={`/angajati/${nod.date.manager_employee_id}`}
                        className="relative z-10 hover:underline"
                      >
                        {managerNumit.full_name}
                      </Link>
                    </>
                  )}
                  {/* Corectarea pornește de aici și se întoarce tot aici, pe nod. */}
                  {poateEdita ? (
                    <>
                      {" · "}
                      <Link
                        href={`/angajati/${nod.date.id}/editeaza?inapoi=organigrama`}
                        className="relative z-10 not-italic hover:underline"
                      >
                        Setează managerul
                      </Link>
                    </>
                  ) : null}
                </span>
              ) : null}
              {nod.copii.length > 0 ? (
                <span className="text-muted-foreground text-nota inline-flex items-center gap-1">
                  <Users aria-hidden="true" className="size-3.5" />
                  <span>{nod.copii.length}</span>
                  <span className="sr-only">subordonați direcți</span>
                </span>
              ) : null}
            </div>
            {nod.copii.length > 0 ? (
              <Arbore
                noduri={nod.copii}
                nivel={nivel + 1}
                roluri={roluri}
                evidentiat={evidentiat}
                poateEdita={poateEdita}
                scope={scope}
                manageriAscunsi={manageriAscunsi}
                poateSchimbaRoluri={poateSchimbaRoluri}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default async function PaginaOrganigrama({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const utilizator = await requireUser();
  // `?angajat=<id>` (de pe fișă, după corectarea managerului): nodul evidențiat
  // pe server — `:target` nu se aprinde după o navigare din client.
  const parametriAdresa = await searchParams;
  const angajatBrut = parametriAdresa["angajat"];
  const evidentiat = typeof angajatBrut === "string" ? angajatBrut : null;
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni, module] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);
  const scope = scopeFor(permisiuni, "employees:read");
  const contextPorti: ContextPorti = { features: module, permissions: permisiuni };

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

  // Managerii rădăcinilor care nu sunt printre fișele active (inactivi, încetați
  // sau în afara scope-ului): se citesc O DATĂ, ca nodul să-i poată numi.
  const idNoduri = new Set(noduri.map((n) => n.id));
  const manageriAscunsi =
    scope === "all"
      ? await fiseDupaId(
          tenant.organizationId,
          arbore
            .map((n) => n.date.manager_employee_id)
            .filter((id): id is string => id !== null && !idNoduri.has(id)),
        )
      : new Map<string, Readonly<{ full_name: string; status: string }>>();
  const poateCreaAngajat = can(permisiuni, "employees:create", "all");

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
        actiuni={
          <span className="text-nota flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/angajati?status=activ" className="underline-offset-2 hover:underline">
              Vezi fișele active
            </Link>
            {/* Cealaltă organigramă a produsului: cea STRUCTURALĂ, din `parent_id`. */}
            {poateDeschide("/departamente", contextPorti) ? (
              <Link
                href="/departamente?vizualizare=organigrama"
                className="underline-offset-2 hover:underline"
              >
                Organigrama departamentelor
              </Link>
            ) : null}
          </span>
        }
      />

      {posibilTrunchiat ? (
        <Callout fel="atentie" titlu="Organigrama este incompletă">
          Baza a întors {String(noduri.length)} de fișe, plafonul unei singure cereri. Peste această
          limită lipsesc oameni, iar cine avea drept manager pe cineva rămas afară apare aici ca și
          cum n-ar avea manager deloc — deci și ierarhia afișată e greșită, nu doar parțială.
          Folosiți{" "}
          <Link href="/angajati?status=activ" className="underline underline-offset-2">
            lista de angajați
          </Link>
          , filtrată pe departament, până când ecranul primește o limită proprie.
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
          nedesemnat. Nodurile lor sunt marcate mai jos, cu managerul numit unde se mai găsește;
          corectați managerul direct pe fișa fiecăreia ca să intre în ierarhie.
        </Callout>
      ) : null}

      {arbore.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Users}
          titlu="Nimic de afișat"
          descriere={
            noduri.length === 0
              ? "Organigrama se desenează din fișele active ale angajaților. Nu există încă niciuna."
              : "Ierarhia se completează pe măsură ce fișele angajaților primesc un manager direct."
          }
          actiune={
            noduri.length === 0 && poateCreaAngajat
              ? { eticheta: "Adaugă primul angajat", href: "/angajati/nou" }
              : { eticheta: "Vezi lista de angajați", href: "/angajati" }
          }
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="w-fit min-w-full px-4">
            <Arbore
              noduri={arbore}
              nivel={1}
              roluri={roluri}
              evidentiat={evidentiat}
              poateEdita={can(permisiuni, "employees:update", "all")}
              scope={scope}
              manageriAscunsi={manageriAscunsi}
              poateSchimbaRoluri={can(permisiuni, "users:update", "all")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
