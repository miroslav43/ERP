// src/app/(app)/mentenanta/planuri/[id]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { ListaDefinitii, type Definitie } from "@/components/ui/lista-definitii";
import { Scadenta } from "@/components/ui/scadenta";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { pasiDinInstructiuni } from "@/domain/maintenance/instructiuni";
import {
  FEREASTRA_PROIECTIE_ZILE,
  contorInvechit,
  proiectieScadentaContor,
  urmatoareaPeGrila,
  type Proiectie,
} from "@/domain/maintenance/proiectie";
import { TREPTE_MENTENANTA, stareScadentaPlan } from "@/domain/maintenance/scadente";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import {
  angajatiDupaId,
  angajatiInactiviDintre,
  cheieContor,
  citestePlan,
  citiriPentruProiectie,
  echipamenteDupaId,
  interventii,
  optiuniAngajati,
  setariMentenanta,
  ultimeleCitiriCuData,
  type RandInterventie,
} from "@/lib/queries/maintenance";

import {
  ETICHETE_MOD_CALCUL,
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_STARE_SCADENTA,
  ETICHETE_TIP_MENTENANTA,
  TONURI_REZULTAT_INTERVENTIE,
  formatCifraContor,
  formatContor,
  formatPeriodicitate,
  textNumarat,
} from "../../etichete";
import { ActiuniPlan } from "./actiuni-plan";

export const metadata: Metadata = { title: "Plan de mentenanță" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/** Ziua ISO de peste `zile` zile (negativ = în urmă). */
function plusZile(azi: string, zile: number): string {
  const d = new Date(`${azi}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + zile);
  return d.toISOString().slice(0, 10);
}

function textProiectie(p: Proiectie | null, invechit: boolean): string {
  if (p === null)
    return "Nu se poate estima: sunt nevoie de cel puțin 3 citiri pe 7 zile, din ultimele 90.";
  const ritm = `~${formatCifraContor(Math.round(p.ritmPeZi * 10) / 10)} pe zi`;
  if (p.dataEstimata === null) return `Ținta e deja atinsă după ultima citire (${ritm}).`;
  const cand = `~${formatDate(p.dataEstimata)} (estimat, ${ritm})`;
  return invechit ? `${cand} — contorul nu s-a mai citit de mult, estimarea e nesigură.` : cand;
}

export default async function PaginaPlan({ params }: ProprietatiPagina) {
  const { id } = await params;
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta planurile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const plan = await citestePlan(tenant.organizationId, id);
  if (plan === null) notFound();

  const azi = todayInBucharest();
  const poateScrie = can(permisiuni, "maintenance:update", "team");

  const [
    echipamente,
    responsabili,
    inactivi,
    istoric,
    setari,
    citiriCuData,
    citiriProiectie,
    angajati,
  ] = await Promise.all([
    echipamenteDupaId(tenant.organizationId, [plan.equipment_id]),
    angajatiDupaId(
      tenant.organizationId,
      plan.responsabil_employee_id === null ? [] : [plan.responsabil_employee_id],
    ),
    angajatiInactiviDintre(
      tenant.organizationId,
      plan.responsabil_employee_id === null ? [] : [plan.responsabil_employee_id],
    ),
    interventii(tenant.organizationId, {
      tip: null,
      rezultat: null,
      echipament: null,
      plan: plan.id,
      cursor: null,
      limita: 50,
    }),
    setariMentenanta(tenant.organizationId),
    plan.tip_contor === null
      ? Promise.resolve(new Map())
      : ultimeleCitiriCuData(tenant.organizationId, [plan.equipment_id]),
    plan.tip_contor === null
      ? Promise.resolve([])
      : citiriPentruProiectie(
          tenant.organizationId,
          plan.equipment_id,
          plan.tip_contor,
          plusZile(azi, -FEREASTRA_PROIECTIE_ZILE),
        ),
    poateScrie ? optiuniAngajati(tenant.organizationId) : Promise.resolve([]),
  ]);

  const echipament = echipamente.get(plan.equipment_id);
  const responsabil =
    plan.responsabil_employee_id === null
      ? null
      : (responsabili.get(plan.responsabil_employee_id)?.full_name ?? "—");
  const responsabilInactiv =
    plan.responsabil_employee_id !== null && inactivi.has(plan.responsabil_employee_id);

  const ultimaCitire =
    plan.tip_contor === null
      ? null
      : (citiriCuData.get(cheieContor(plan.equipment_id, plan.tip_contor)) ?? null);
  const stare = stareScadentaPlan(
    {
      urmatoareaScadenta: plan.urmatoarea_scadenta,
      urmatoareaScadentaContor: plan.urmatoarea_scadenta_contor,
      periodicitateContor: plan.periodicitate_contor,
      ultimaCitireContor: ultimaCitire?.citire ?? null,
    },
    azi,
  );
  const invechit =
    plan.tip_contor !== null &&
    contorInvechit(ultimaCitire?.data_citirii ?? null, azi, setari.prag_contor_necitit_zile);
  const proiectie =
    plan.tip_contor === null
      ? null
      : proiectieScadentaContor(citiriProiectie, plan.urmatoarea_scadenta_contor, azi);
  const amanat = plan.amanat_pana !== null && plan.amanat_pana >= azi;
  const pasi = pasiDinInstructiuni(plan.instructiuni);

  // Pe grilă fixă, următoarea dată de pe grilă explică scadența — oglinda lui
  // `ssm_plan_calc`, calculată aici ca omul să vadă DE CE a sărit o perioadă.
  const peGrila =
    plan.mod_calcul === "fix" && plan.periodicitate_zile !== null && plan.data_ancora !== null
      ? urmatoareaPeGrila(plan.data_ancora, plan.periodicitate_zile, azi, plan.ultima_executie)
      : null;

  const identitate: Definitie[] = [
    { eticheta: "Tip", valoare: ETICHETE_TIP_MENTENANTA[plan.tip] },
    { eticheta: "Periodicitate", valoare: formatPeriodicitate(plan) },
    {
      eticheta: "Calculul pe zile",
      valoare:
        plan.periodicitate_zile === null
          ? null
          : `${ETICHETE_MOD_CALCUL[plan.mod_calcul]}${plan.data_ancora === null ? "" : ` · ancoră ${formatDate(plan.data_ancora)}`}`,
    },
    {
      eticheta: "Ultima execuție",
      valoare: plan.ultima_executie === null ? null : formatDate(plan.ultima_executie),
    },
    {
      eticheta: "Contorul la ultima execuție",
      valoare:
        plan.ultima_citire_contor === null || plan.tip_contor === null
          ? null
          : formatContor(plan.ultima_citire_contor, plan.tip_contor),
    },
    { eticheta: "Responsabil", valoare: responsabil },
    {
      eticheta: "Durată estimată",
      valoare:
        plan.durata_estimata_ore === null
          ? null
          : `${formatCifraContor(plan.durata_estimata_ore)} h`,
    },
    {
      eticheta: "Cost estimat",
      valoare: plan.cost_estimat === null ? null : formatLei(plan.cost_estimat),
    },
    {
      eticheta: "Oprirea utilajului",
      valoare: plan.oprire_necesara ? "Necesară" : "Nu e necesară",
    },
    { eticheta: "Temei legal", valoare: plan.temei_legal, lat: true },
    { eticheta: "Amânări", valoare: String(plan.numar_amanari) },
  ];

  const coloane: readonly Coloana<RandInterventie>[] = [
    {
      cheie: "data",
      antet: "Data",
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (i) => formatDate(i.data),
    },
    { cheie: "descriere", antet: "Descriere", peTelefon: "meta", celula: (i) => i.descriere },
    {
      cheie: "cost",
      antet: "Cost",
      numeric: true,
      peTelefon: "meta",
      celula: (i) => formatLei(i.cost_total ?? i.cost_piese + i.cost_manopera),
    },
    {
      cheie: "rezultat",
      antet: "Rezultat",
      peTelefon: "insigna",
      celula: (i) => (
        <Badge ton={TONURI_REZULTAT_INTERVENTIE[i.rezultat]}>
          {ETICHETE_REZULTAT_INTERVENTIE[i.rezultat]}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu={plan.denumire}
        descriere={
          echipament === undefined
            ? "Echipamentul planului nu vă este vizibil."
            : `${echipament.cod} — ${echipament.denumire}`
        }
        firimituri={[
          { eticheta: "Mentenanță", href: "/mentenanta" },
          { eticheta: "Planuri", href: "/mentenanta/planuri" },
          { eticheta: plan.denumire },
        ]}
        {...(poateScrie
          ? {
              actiuni: (
                <ActiuniPlan
                  plan={plan}
                  pasi={pasi}
                  angajati={angajati}
                  azi={azi}
                  numarInterventii={istoric.total}
                />
              ),
            }
          : {})}
      />

      {!plan.activ ? (
        <Callout fel="neutru" titlu="Plan inactiv">
          Planul nu intră în scadențe și în alertele zilnice. Îl puteți reactiva din „Activează”.
        </Callout>
      ) : null}

      {responsabilInactiv ? (
        <Callout fel="atentie" titlu="Responsabilul nu mai e activ în firmă">
          Alertele zilnice ale planului nu ajung la nimeni. Alegeți alt responsabil din „Editează”.
        </Callout>
      ) : null}

      <section aria-labelledby="scadenta" className="border-border rounded-panou border p-4">
        <h2 id="scadenta" className="text-sectiune mb-3 font-semibold">
          Scadența
        </h2>
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0">
            <p className="text-muted-foreground text-eticheta tracking-wide uppercase">Stare</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {plan.activ ? (
                <Scadenta treapta={TREPTE_MENTENANTA[stare]}>
                  {ETICHETE_STARE_SCADENTA[stare]}
                </Scadenta>
              ) : (
                <Badge ton="neutru">Inactiv</Badge>
              )}
              {amanat ? <Badge ton="neutru">Amânat</Badge> : null}
            </div>
          </div>
          {plan.periodicitate_zile !== null ? (
            <div className="min-w-0">
              <p className="text-muted-foreground text-eticheta tracking-wide uppercase">Pe zile</p>
              <p className="text-corp mt-1 tabular-nums">
                {plan.urmatoarea_scadenta === null ? "—" : formatDate(plan.urmatoarea_scadenta)}
              </p>
              {peGrila !== null && peGrila !== plan.urmatoarea_scadenta && !amanat ? (
                <p className="text-muted-foreground text-nota">
                  Pe grilă ar fi {formatDate(peGrila)}; scadența din bază o va ajunge la următoarea
                  recalculare.
                </p>
              ) : null}
            </div>
          ) : null}
          {plan.tip_contor !== null && plan.urmatoarea_scadenta_contor !== null ? (
            <div className="min-w-0">
              <p className="text-muted-foreground text-eticheta tracking-wide uppercase">
                Pe contor
              </p>
              <p className="text-corp mt-1 tabular-nums">
                la {formatContor(plan.urmatoarea_scadenta_contor, plan.tip_contor)}
                {ultimaCitire === null
                  ? " · fără citire"
                  : ` · acum ${formatCifraContor(ultimaCitire.citire)} (${formatDate(ultimaCitire.data_citirii)})`}
              </p>
              <p className="text-muted-foreground text-nota">
                {textProiectie(proiectie, invechit)}
              </p>
            </div>
          ) : null}
        </div>
        {amanat && plan.amanat_pana !== null ? (
          <p className="text-corp border-border mt-4 border-t pt-3">
            Amânat până la <strong>{formatDate(plan.amanat_pana)}</strong>
            {plan.motiv_amanare === null ? "." : `: ${plan.motiv_amanare}`}{" "}
            <span className="text-muted-foreground">
              (a {textNumarat(plan.numar_amanari, "amânare", "amânări")} în total; o execuție
              reușită o șterge)
            </span>
          </p>
        ) : null}
        {plan.tip_contor !== null && ultimaCitire === null ? (
          <Callout fel="atentie" titlu="Contor fără citire" className="mt-4">
            Planul are scadență pe contor, dar echipamentul n-are nicio citire de tipul ăsta.
            Înregistrați o citire din fișa echipamentului sau din „Contoare”; până atunci starea se
            calculează doar din zile.
          </Callout>
        ) : null}
        {invechit && ultimaCitire !== null ? (
          <Callout fel="atentie" titlu="Contor necitit de mult" className="mt-4">
            Ultima citire e din {formatDate(ultimaCitire.data_citirii)}, peste pragul de{" "}
            {textNumarat(setari.prag_contor_necitit_zile, "zi", "zile")} din setări. Starea pe
            contor poate fi depășită fără să se vadă.
          </Callout>
        ) : null}
      </section>

      <section aria-labelledby="date" className="border-border rounded-panou border p-4">
        <h2 id="date" className="text-sectiune mb-3 font-semibold">
          Date
        </h2>
        <ListaDefinitii definitii={identitate} textNecompletat="Necompletat" coloane={3} />
      </section>

      <section aria-labelledby="instructiuni" className="border-border rounded-panou border p-4">
        <h2 id="instructiuni" className="text-sectiune mb-3 font-semibold">
          Instrucțiuni
        </h2>
        {plan.instructiuni === null ? (
          <p className="text-muted-foreground text-corp">
            Fără instrucțiuni. Scrise câte un pas pe rând, început cu „- ”, apar ca listă de bifat
            la execuție.
          </p>
        ) : pasi.length > 0 ? (
          <ol className="text-corp list-decimal space-y-1 pl-5">
            {pasi.map((pas, i) => (
              <li key={`${String(i)}·${pas}`}>{pas}</li>
            ))}
          </ol>
        ) : (
          <p className="text-corp whitespace-pre-wrap">{plan.instructiuni}</p>
        )}
      </section>

      <section aria-labelledby="istoric" className="space-y-3">
        <h2 id="istoric" className="text-sectiune font-semibold">
          Istoricul execuțiilor
          <span className="text-muted-foreground ml-2 font-normal tabular-nums">
            {istoric.total}
          </span>
        </h2>
        <Tabel
          caption="Intervențiile înregistrate pe acest plan."
          coloane={coloane}
          randuri={istoric.randuri}
          cheieRand={(i) => i.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio execuție încă. „Execută” înregistrează prima și mută scadența.
            </p>
          }
        />
        {istoric.urmatorulCursor !== null ? (
          <p className="text-nota">
            <Link
              href={`/mentenanta/interventii?plan=${plan.id}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Vezi toate intervențiile planului ({istoric.total})
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
