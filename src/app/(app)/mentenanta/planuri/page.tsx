// src/app/(app)/mentenanta/planuri/page.tsx
import { TREPTE_MENTENANTA } from "@/domain/maintenance/scadente";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Scadenta } from "@/components/ui/scadenta";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import {
  angajatiDupaId,
  cheieContor,
  echipamenteDupaId,
  planuriScadente,
  ultimeleCitiriContor,
} from "@/lib/queries/maintenance";
import { stareScadentaPlan } from "@/domain/maintenance/scadente";
import type { TipContor } from "@/schemas/maintenance";

import {
  ETICHETE_STARE_SCADENTA,
  ETICHETE_TIP_MENTENANTA,
  formatCifraContor,
  formatContor,
  formatPeriodicitate,
  textNumarat,
} from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";

export const metadata: Metadata = { title: "Planuri de mentenanță" };

export default async function PaginaPlanuri() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta planurile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const azi = todayInBucharest();
  const { randuri: planuri, total, trunchiat } = await planuriScadente(tenant.organizationId);

  /*
   * Ultima citire pe fiecare (echipament, tip de contor) — numai pentru
   * planurile care chiar au scadență pe contor. Fără ea, coloana „Scadență”
   * putea spune numai jumătate din adevăr: `stareScadentaData` se uita doar la
   * `urmatoarea_scadenta`, deci un plan depășit cu 200 de ore apărea „În
   * regulă”, iar pagina își recunoștea lipsa în propriul subtitlu.
   */
  const planuriCuContor = planuri.filter(
    (p) => p.tip_contor !== null && p.urmatoarea_scadenta_contor !== null,
  );

  const [echipamente, responsabili, citiri] = await Promise.all([
    echipamenteDupaId(
      tenant.organizationId,
      planuri.map((p) => p.equipment_id),
    ),
    angajatiDupaId(
      tenant.organizationId,
      planuri.map((p) => p.responsabil_employee_id).filter((v): v is string => v !== null),
    ),
    ultimeleCitiriContor(
      tenant.organizationId,
      planuriCuContor.map((p) => p.equipment_id),
      planuriCuContor.map((p) => p.tip_contor).filter((tip): tip is TipContor => tip !== null),
    ),
  ]);

  /** Ultima citire relevantă pentru un plan, sau `null` dacă nu s-a citit nimic încă. */
  function citireaPlanului(plan: (typeof planuri)[number]): number | null {
    if (plan.tip_contor === null) return null;
    return citiri.get(cheieContor(plan.equipment_id, plan.tip_contor)) ?? null;
  }

  /*
   * Fără sortare și fără paginare: `planuriScadente` citește planurile active
   * întregi, cu o limită fixă și cu ordinea fixată pe scadență — n-are cursor
   * keyset, deci n-are cum să susțină o altă ordine fără să se rupă paginarea.
   * Tăierea nu mai e însă tăcută: `trunchiat` ajunge la `<Tabel>`.
   *
   * Pastila de scadență și data ei erau lipite în aceeași celulă. Despărțite,
   * data se poate compara pe verticală, iar pastila rămâne singurul lucru
   * colorat din coloana ei.
   */
  const coloane: readonly Coloana<(typeof planuri)[number]>[] = [
    {
      cheie: "plan",
      antet: "Plan",
      peTelefon: "titlu",
      celula: (plan) => (
        <span className="font-medium">
          {plan.denumire}
          <span className="text-muted-foreground text-nota ml-1">
            ({ETICHETE_TIP_MENTENANTA[plan.tip]})
          </span>
        </span>
      ),
    },
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "meta",
      celula: (plan) => {
        const echipament = echipamente.get(plan.equipment_id);
        return echipament === undefined ? (
          "—"
        ) : (
          <Link
            href={`/mentenanta/echipamente/${plan.equipment_id}`}
            className="underline-offset-2 hover:underline"
          >
            {echipament.cod} — {echipament.denumire}
          </Link>
        );
      },
    },
    {
      cheie: "periodicitate",
      antet: "Periodicitate",
      peTelefon: "meta",
      celula: (plan) => (
        <span className="text-muted-foreground text-nota">{formatPeriodicitate(plan)}</span>
      ),
    },
    {
      cheie: "responsabil",
      antet: "Responsabil",
      peTelefon: "meta",
      celula: (plan) =>
        plan.responsabil_employee_id === null
          ? "—"
          : (responsabili.get(plan.responsabil_employee_id)?.full_name ?? "—"),
    },
    {
      cheie: "scadenta",
      antet: "Scadență",
      peTelefon: "insigna",
      celula: (plan) => {
        const stare = stareScadentaPlan(
          {
            urmatoareaScadenta: plan.urmatoarea_scadenta,
            urmatoareaScadentaContor: plan.urmatoarea_scadenta_contor,
            periodicitateContor: plan.periodicitate_contor,
            ultimaCitireContor: citireaPlanului(plan),
          },
          azi,
        );
        return (
          <Scadenta treapta={TREPTE_MENTENANTA[stare]}>{ETICHETE_STARE_SCADENTA[stare]}</Scadenta>
        );
      },
    },
    {
      cheie: "scadenta_la",
      antet: "Scadentă la",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (plan) => {
        const citire = citireaPlanului(plan);
        return (
          <div className="flex flex-col">
            <span className="tabular-nums">
              {plan.urmatoarea_scadenta === null ? "—" : formatDate(plan.urmatoarea_scadenta)}
            </span>
            {/* Scadența pe contor, scrisă lângă cea pe zile: pastila de alături
                combină cele două stări, iar fără termenul care a produs-o un
                „În întârziere” lângă o dată din viitor pare o eroare. */}
            {plan.tip_contor !== null && plan.urmatoarea_scadenta_contor !== null ? (
              <span className="text-muted-foreground text-nota tabular-nums">
                la {formatContor(plan.urmatoarea_scadenta_contor, plan.tip_contor)}
                {citire === null ? " (fără citire)" : `, acum ${formatCifraContor(citire)}`}
              </span>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Planuri de mentenanță"
        descriere={`${textNumarat(total, "plan ACTIV", "planuri ACTIVE")}, cu cea mai apropiată scadență prima. Starea combină scadența pe zile cu cea pe contor, față de ultima citire cunoscută.`}
        file={<NavMentenanta />}
      />

      <Tabel
        caption="Planurile de mentenanță active, cu scadența lor."
        coloane={coloane}
        randuri={planuri}
        cheieRand={(plan) => plan.id}
        trunchiat={trunchiat}
        gol={
          <StareGoala
            fel="initiala"
            pictograma={CalendarClock}
            titlu="Niciun plan de mentenanță activ"
            descriere="Planurile se adaugă din fișa fiecărui echipament."
          />
        }
      />
    </div>
  );
}
