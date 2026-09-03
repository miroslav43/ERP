// src/app/(app)/mentenanta/page.tsx
import { TREPTE_MENTENANTA } from "@/domain/maintenance/scadente";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, ShieldAlert, Wrench, type LucideIcon } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Scadenta } from "@/components/ui/scadenta";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  angajatiDupaId,
  autorizatiiIscir,
  cheieContor,
  echipamenteDupaId,
  planuriScadente,
  sesizariDeschise,
  ultimeleCitiriContor,
  type PlanMentenanta,
} from "@/lib/queries/maintenance";
import {
  PRAG_MENTENANTA_AVERTIZARE_ZILE,
  cereActiune,
  stareScadentaData,
  stareScadentaPlan,
} from "@/domain/maintenance/scadente";
import type { TipContor } from "@/schemas/maintenance";

import {
  ETICHETE_STARE_SCADENTA,
  ETICHETE_STATUS_ECHIPAMENT,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_ECHIPAMENT,
  TONURI_URGENTA_SESIZARE,
  formatCifraContor,
  formatContor,
  textNumarat,
} from "./etichete";
import { NavMentenanta } from "./nav-mentenanta";
import { SesizarileMele } from "./sesizarile-mele";

export const metadata: Metadata = { title: "Mentenanță" };

/** Câte rânduri intră într-un panou. Restul se numără în antet, nu dispar tăcut. */
const MAXIM_PE_PANOU = 8;

interface EchipamentProblema {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly status: "in_reparatie" | "in_conservare" | "casat";
}

interface RezultatEchipamenteProblema {
  readonly randuri: readonly EchipamentProblema[];
  readonly total: number;
}

/** Echipamentele care nu sunt „în funcțiune” — inline, doar pentru panoul de organizație. */
async function echipamenteCuProbleme(organizationId: string): Promise<RezultatEchipamenteProblema> {
  const db = await createServerSupabase();
  // `count: "exact"` pe ACEEAȘI interogare: numărul din antetul panoului trebuie
  // să respecte aceleași politici RLS ca rândurile de sub el.
  const { data, error, count } = await db
    .from("equipment")
    .select("id, cod, denumire, status", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("status", "in_functiune")
    .order("cod", { ascending: true })
    .limit(MAXIM_PE_PANOU)
    .returns<EchipamentProblema[]>();
  if (error !== null) throw error;
  const randuri = data ?? [];
  return { randuri, total: count ?? randuri.length };
}

async function PanouOrganizatie({ organizationId }: { readonly organizationId: string }) {
  const azi = todayInBucharest();

  const [rezultatPlanuri, rezultatSesizari, iscirBrute, rezultatEchipamente] = await Promise.all([
    planuriScadente(organizationId),
    // Limita e a PANOULUI, nu a filtrării: interogarea întoarce deja numai
    // sesizările deschise, în ordinea corectă. Vezi `sesizariDeschise`.
    sesizariDeschise(organizationId, MAXIM_PE_PANOU),
    autorizatiiIscir(organizationId),
    echipamenteCuProbleme(organizationId),
  ]);

  /*
   * Citirile de contor se cer DUPĂ planuri, fiindcă depind de ele: numai
   * echipamentele cu plan pe contor și numai tipurile de contor chiar folosite.
   * Un `Promise.all` cu planurile ar fi cerut toate citirile organizației.
   */
  const planuriCuContor = rezultatPlanuri.randuri.filter(
    (p) => p.tip_contor !== null && p.urmatoarea_scadenta_contor !== null,
  );
  const citiri = await ultimeleCitiriContor(
    organizationId,
    planuriCuContor.map((p) => p.equipment_id),
    planuriCuContor.map((p) => p.tip_contor).filter((tip): tip is TipContor => tip !== null),
  );

  /*
   * `stareScadentaPlan`, NU `stareScadentaData`.
   *
   * Aici era defectul central al modulului: panoul calcula semaforul numai din
   * `urmatoarea_scadenta` (zile), deși planul poate fi scadent pe CONTOR. Un
   * plan la 500 de ore, cu utilajul la 700, apărea „În regulă” — și nu apărea
   * deloc în coada de dimineață, fiindcă filtrul de mai jos se face pe aceeași
   * stare. Fișa echipamentului o calcula corect de la început, deci cele două
   * ecrane spuneau lucruri diferite despre același plan.
   */
  const planuriCuStare = rezultatPlanuri.randuri.map((plan) => ({
    plan,
    stare: stareScadentaPlan(
      {
        urmatoareaScadenta: plan.urmatoarea_scadenta,
        urmatoareaScadentaContor: plan.urmatoarea_scadenta_contor,
        periodicitateContor: plan.periodicitate_contor,
        ultimaCitireContor:
          plan.tip_contor === null
            ? null
            : (citiri.get(cheieContor(plan.equipment_id, plan.tip_contor)) ?? null),
      },
      azi,
    ),
  }));

  const planuriInCoada = planuriCuStare.filter(({ stare }) => cereActiune(stare));
  const planuriScadenteAfisate = planuriInCoada.slice(0, MAXIM_PE_PANOU);

  const sesizariAfisate = rezultatSesizari.randuri;

  const iscirInCoada = iscirBrute.filter(
    (autorizatie) =>
      autorizatie.suspendata_la === null &&
      cereActiune(stareScadentaData(autorizatie.valabil_pana, azi)),
  );
  const iscirScadente = iscirInCoada.slice(0, MAXIM_PE_PANOU);

  /*
   * Cifra de sus se calculează din ACELEAȘI rânduri ca listele de dedesubt, cu
   * ACELAȘI predicat (`cereActiune`) ca badge-ul din meniu.
   *
   * Venea din `numarScadenteMentenanta`, care era o pereche de `count` în bază
   * și, tocmai de asta, nu putea vedea decât scadențele pe ZILE: indicatorul
   * spunea „7” peste o listă de nouă. Funcția aceea numără acum după aceeași
   * regulă, deci badge-ul din meniu și antetul de aici nu mai pot diverge — dar
   * rândurile sunt deja citite pentru liste, așa că nu se mai cere de la bază a
   * doua oară aceeași cifră.
   */
  const numarScadente = planuriInCoada.length + iscirInCoada.length;

  const idEchipamente = [
    ...planuriScadenteAfisate.map(({ plan }) => plan.equipment_id),
    ...sesizariAfisate.map((s) => s.equipment_id),
    ...iscirScadente.map((a) => a.equipment_id),
  ];
  const [echipamente, responsabili] = await Promise.all([
    echipamenteDupaId(organizationId, idEchipamente),
    angajatiDupaId(
      organizationId,
      planuriScadenteAfisate
        .map(({ plan }) => plan.responsabil_employee_id)
        .filter((id): id is string => id !== null),
    ),
  ]);

  const numeEchipament = (id: string) => {
    const e = echipamente.get(id);
    return e === undefined ? "Echipament necunoscut" : `${e.cod} — ${e.denumire}`;
  };

  return (
    <div className="space-y-6">
      <div className="border-border rounded-panou border p-4">
        {/* Eticheta ÎNTREAGĂ deasupra cifrei: „Scadențe în următoarele / 7 /
            Planuri … în 15 zile” se citea ca o frază ruptă în trei bucăți. */}
        <p className="text-muted-foreground text-corp">
          Scadențe în următoarele {PRAG_MENTENANTA_AVERTIZARE_ZILE} zile
        </p>
        <p className="text-3xl font-semibold tabular-nums">{numarScadente}</p>
        <p className="text-muted-foreground text-nota">
          {textNumarat(planuriInCoada.length, "plan de mentenanță", "planuri de mentenanță")} ·{" "}
          {textNumarat(iscirInCoada.length, "autorizație ISCIR", "autorizații ISCIR")}, scadente sau
          în întârziere. Planurile pe contor intră și ele, cu ultima citire cunoscută.
        </p>
      </div>

      {rezultatPlanuri.trunchiat ? (
        <Callout fel="atentie" titlu="Cifrele de mai sus sunt un minim">
          S-au citit {rezultatPlanuri.randuri.length} din{" "}
          {textNumarat(rezultatPlanuri.total, "plan activ", "planuri active")}, deci pot exista
          scadențe nenumărate. Deschideți lista de planuri pentru situația completă.
        </Callout>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panou
          icon={CalendarClock}
          titlu="Planuri de mentenanță scadente"
          total={planuriInCoada.length}
          afisate={planuriScadenteAfisate.length}
          href="/mentenanta/planuri"
          etichetaHref="Vezi toate planurile"
          gol="Niciun plan activ nu e scadent sau în întârziere."
        >
          {planuriScadenteAfisate.map(({ plan, stare }) => (
            <li key={plan.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <Link
                  href={`/mentenanta/echipamente/${plan.equipment_id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {plan.denumire}
                </Link>
                <p className="text-muted-foreground text-nota">
                  {numeEchipament(plan.equipment_id)}
                  {plan.responsabil_employee_id !== null
                    ? ` · ${responsabili.get(plan.responsabil_employee_id)?.full_name ?? "—"}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <Scadenta treapta={TREPTE_MENTENANTA[stare]}>
                  {ETICHETE_STARE_SCADENTA[stare]}
                </Scadenta>
                {/* Termenul care a produs starea, ca omul să nu caute pe fișă de
                    ce un plan cu dată în viitor e „În întârziere”. */}
                <span className="text-muted-foreground text-nota">{termenPlan(plan, citiri)}</span>
              </div>
            </li>
          ))}
        </Panou>

        <Panou
          icon={Wrench}
          titlu="Sesizări deschise"
          total={rezultatSesizari.total}
          afisate={sesizariAfisate.length}
          href="/mentenanta/sesizari"
          etichetaHref="Vezi toate sesizările"
          gol="Nicio sesizare deschisă în acest moment."
        >
          {sesizariAfisate.map((sesizare) => (
            <li key={sesizare.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <Link
                  href={`/mentenanta/sesizari/${sesizare.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {numeEchipament(sesizare.equipment_id)}
                </Link>
                <p className="text-muted-foreground text-nota">{sesizare.descriere}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {/* `opreste_functionarea` decide ordinea cozii, deci trebuie și
                    văzut: altfel primul rând pare că a sărit peste urgență. */}
                {sesizare.opreste_functionarea ? (
                  <Badge ton="pericol" cuAvertisment>
                    Utilaj oprit
                  </Badge>
                ) : null}
                <Badge ton={TONURI_URGENTA_SESIZARE[sesizare.urgenta]}>
                  {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                </Badge>
              </div>
            </li>
          ))}
        </Panou>

        <Panou
          icon={AlertTriangle}
          titlu="Echipamente care nu sunt în funcțiune"
          total={rezultatEchipamente.total}
          afisate={rezultatEchipamente.randuri.length}
          href="/mentenanta/echipamente"
          etichetaHref="Vezi parcul întreg"
          gol="Toate echipamentele sunt în funcțiune."
        >
          {rezultatEchipamente.randuri.map((echipament) => (
            <li key={echipament.id} className="flex items-center justify-between gap-3 py-2">
              <Link
                href={`/mentenanta/echipamente/${echipament.id}`}
                className="font-medium underline-offset-2 hover:underline"
              >
                {echipament.cod} — {echipament.denumire}
              </Link>
              <Badge className="shrink-0" ton={TONURI_STATUS_ECHIPAMENT[echipament.status]}>
                {ETICHETE_STATUS_ECHIPAMENT[echipament.status]}
              </Badge>
            </li>
          ))}
        </Panou>

        <Panou
          icon={ShieldAlert}
          titlu="Autorizații ISCIR ce expiră"
          total={iscirInCoada.length}
          afisate={iscirScadente.length}
          gol="Nicio autorizație ISCIR nu expiră în curând."
        >
          {iscirScadente.map((autorizatie) => {
            const stare = stareScadentaData(autorizatie.valabil_pana, azi);
            return (
              <li key={autorizatie.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <Link
                    href={`/mentenanta/echipamente/${autorizatie.equipment_id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {numeEchipament(autorizatie.equipment_id)}
                  </Link>
                  <p className="text-muted-foreground text-nota">
                    {autorizatie.tip} · {autorizatie.numar}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <Scadenta treapta={TREPTE_MENTENANTA[stare]}>
                    {ETICHETE_STARE_SCADENTA[stare]}
                  </Scadenta>
                  <span className="text-muted-foreground text-nota">
                    {formatDate(autorizatie.valabil_pana)}
                  </span>
                </div>
              </li>
            );
          })}
        </Panou>
      </div>
    </div>
  );
}

/**
 * Termenul cel mai apropiat al unui plan, în cuvinte — data, pragul de contor,
 * sau amândouă. Fără el, un plan scadent PE CONTOR arăta o dată calendaristică
 * din viitor lângă pastila „În întârziere”, ceea ce se citește ca o eroare.
 */
function termenPlan(plan: PlanMentenanta, citiri: ReadonlyMap<string, number>): string {
  const bucati: string[] = [];
  if (plan.urmatoarea_scadenta !== null) bucati.push(formatDate(plan.urmatoarea_scadenta));
  if (plan.tip_contor !== null && plan.urmatoarea_scadenta_contor !== null) {
    const prag = formatContor(plan.urmatoarea_scadenta_contor, plan.tip_contor);
    const citita = citiri.get(cheieContor(plan.equipment_id, plan.tip_contor));
    // „Fără citire” e o stare reală, nu o eroare: fără punct de pornire,
    // `stareScadentaContor` nu poate spune nimic, iar pastila arată doar zilele.
    bucati.push(
      citita === undefined
        ? `la ${prag} (fără citire)`
        : `la ${prag}, acum ${formatCifraContor(citita)}`,
    );
  }
  return bucati.length === 0 ? "Fără termen" : bucati.join(" · ");
}

function Panou({
  icon: Icon,
  titlu,
  total,
  afisate,
  href,
  etichetaHref,
  gol,
  children,
}: {
  readonly icon: LucideIcon;
  readonly titlu: string;
  /** Câte există CU TOTUL. Panoul tăia la opt fără să spună câte a ascuns. */
  readonly total: number;
  readonly afisate: number;
  readonly href?: string;
  readonly etichetaHref?: string;
  readonly gol: string;
  readonly children: ReactNode;
}) {
  const areConținut = Array.isArray(children) ? children.length > 0 : children !== null;
  return (
    <section className="border-border rounded-panou flex flex-col border p-4">
      <h2 className="text-corp mb-2 flex items-center gap-2 font-semibold">
        <Icon aria-hidden="true" className="text-muted-foreground size-4" />
        <span className="min-w-0 flex-1">{titlu}</span>
        <span className="text-muted-foreground shrink-0 tabular-nums">{total}</span>
      </h2>
      {areConținut ? (
        <ul className="divide-border divide-y">{children}</ul>
      ) : (
        <p className="text-muted-foreground text-corp py-4">{gol}</p>
      )}
      {href !== undefined && etichetaHref !== undefined && total > afisate ? (
        <p className="border-border text-nota mt-3 border-t pt-3">
          <Link href={href} className="text-primary underline-offset-2 hover:underline">
            {etichetaHref} ({total})
          </Link>
        </p>
      ) : null}
    </section>
  );
}

export default async function PaginaMentenanta() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // `can(..., "own")`, nu `scopeFor(...) !== null`: „none” e refuz explicit
  // ȘI e truthy, deci a doua formă ar lăsa poarta deschisă.
  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta mentenanța. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  // Cine are doar „own” ajunge aici prin QR/link direct — în meniu itemul are
  // minScope „team”, deci nu-l vede. Vede DOAR sesizările proprii, nu panoul
  // de organizație.
  if (!can(permisiuni, "maintenance:read", "team")) {
    return <SesizarileMele />;
  }

  const poateAdaugaEchipament = can(permisiuni, "maintenance:update", "team");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Mentenanță"
        descriere="Echipamente, planuri de mentenanță, intervenții și sesizări de defecțiune."
        actiuni={
          <>
            <Link href="/mentenanta/sesizari/noua" className={buton({ varianta: "secundar" })}>
              Sesizare nouă
            </Link>
            {poateAdaugaEchipament ? (
              <Link href="/mentenanta/echipamente/nou" className={buton({ varianta: "primar" })}>
                Echipament nou
              </Link>
            ) : null}
          </>
        }
        file={<NavMentenanta />}
      />

      <PanouOrganizatie organizationId={tenant.organizationId} />
    </div>
  );
}
