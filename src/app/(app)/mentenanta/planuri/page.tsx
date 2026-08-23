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
import { angajatiDupaId, echipamenteDupaId, planuriScadente } from "@/lib/queries/maintenance";
import { stareScadentaData } from "@/domain/maintenance/scadente";

import { ETICHETE_STARE_SCADENTA, ETICHETE_TIP_CONTOR, ETICHETE_TIP_MENTENANTA } from "../etichete";
import { NavMentenanta } from "../nav-mentenanta";

export const metadata: Metadata = { title: "Planuri de mentenanță" };

export default async function PaginaPlanuri() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta planurile de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const azi = todayInBucharest();
  const planuri = await planuriScadente(tenant.organizationId);

  const [echipamente, responsabili] = await Promise.all([
    echipamenteDupaId(
      tenant.organizationId,
      planuri.map((p) => p.equipment_id),
    ),
    angajatiDupaId(
      tenant.organizationId,
      planuri.map((p) => p.responsabil_employee_id).filter((v): v is string => v !== null),
    ),
  ]);

  /*
   * Fără sortare și fără paginare: `planuriScadente` citește planurile active
   * întregi, cu o limită fixă și cu ordinea fixată pe scadență — n-are cursor
   * keyset, deci n-are cum să susțină o altă ordine fără să se rupă paginarea.
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
        <span className="text-muted-foreground text-nota">
          {plan.periodicitate_zile !== null ? `${plan.periodicitate_zile} zile` : ""}
          {plan.periodicitate_zile !== null && plan.periodicitate_contor !== null ? " · " : ""}
          {plan.periodicitate_contor !== null && plan.tip_contor !== null
            ? `${plan.periodicitate_contor} ${ETICHETE_TIP_CONTOR[plan.tip_contor]}`
            : ""}
        </span>
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
        const stare = stareScadentaData(plan.urmatoarea_scadenta, azi);
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
      celula: (plan) =>
        plan.urmatoarea_scadenta === null ? "—" : formatDate(plan.urmatoarea_scadenta),
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Planuri de mentenanță"
        descriere="Planurile ACTIVE ale organizației, cu cea mai apropiată scadență prima. Scadența pe contor se vede exact pe fișa fiecărui echipament, unde intră și ultima citire."
        file={<NavMentenanta />}
      />

      <Tabel
        caption="Planurile de mentenanță active, cu scadența lor."
        coloane={coloane}
        randuri={planuri}
        cheieRand={(plan) => plan.id}
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
