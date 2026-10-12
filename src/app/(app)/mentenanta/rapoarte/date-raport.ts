// src/app/(app)/mentenanta/rapoarte/date-raport.ts
//
// Citirile raportului de mentenanță, adunate o singură dată pentru ecran ȘI
// pentru exportul CSV: aceleași rânduri, același calcul, deci CSV-ul nu poate
// spune altceva decât pagina.
import "server-only";

import { todayInBucharest } from "@/lib/format/date";
import {
  calculeazaRaport,
  citiriRestante,
  contoareCuPlan,
  fereastraCitire,
  type EchipamentRaport,
  type Perioada,
  type RaportMentenanta,
} from "@/domain/maintenance/indicatori";
import { cheieContor, setariMentenanta, ultimeleCitiriCuData } from "@/lib/queries/maintenance";
import {
  echipamentePentruRaport,
  executiiPlanuriPanaLa,
  interventiiInPerioada,
  opririInPerioada,
  planuriPentruRaport,
  sesizariInPerioada,
} from "@/lib/queries/maintenance-rapoarte";

export interface DateRaport {
  readonly raport: RaportMentenanta;
  readonly echipamente: ReadonlyMap<string, EchipamentRaport>;
  /** Contoarele cu plan necitite peste prag — starea de AZI, nu a perioadei. */
  readonly citiriRestante: number;
  readonly pragContorNecititZile: number;
  readonly costOraOprireSetat: boolean;
  /** Ce citiri au atins plafonul: cifrele lor sunt un minim (cazul 45). */
  readonly trunchiate: readonly string[];
}

export async function incarcaRaport(
  organizationId: string,
  perioada: Perioada,
): Promise<DateRaport> {
  const azi = todayInBucharest();
  const fereastra = fereastraCitire(perioada);

  const [echipamente, interventii, executii, planuri, sesizari, opriri, setari] = await Promise.all(
    [
      echipamentePentruRaport(organizationId),
      interventiiInPerioada(organizationId, fereastra),
      executiiPlanuriPanaLa(organizationId, perioada.panaLa),
      planuriPentruRaport(organizationId),
      sesizariInPerioada(organizationId, fereastra),
      opririInPerioada(organizationId, perioada),
      setariMentenanta(organizationId),
    ],
  );

  const contoare = contoareCuPlan(planuri.randuri);
  const ultimele = await ultimeleCitiriCuData(
    organizationId,
    contoare.map((c) => c.equipmentId),
  );

  const raport = calculeazaRaport({
    perioada,
    azi,
    acum: new Date().toISOString(),
    program: {
      orePeZi: setari.ore_functionare_pe_zi,
      zilePeSaptamana: setari.zile_pe_saptamana,
      costOraOprire: setari.cost_ora_oprire,
    },
    echipamente: echipamente.randuri,
    interventii: interventii.randuri,
    executiiPlanuri: executii.randuri,
    planuri: planuri.randuri,
    sesizari: sesizari.randuri,
    opriri: opriri.randuri,
  });

  const trunchiate = [
    echipamente.trunchiat ? "echipamentele" : null,
    interventii.trunchiat ? "intervențiile" : null,
    executii.trunchiat ? "execuțiile planurilor" : null,
    planuri.trunchiat ? "planurile" : null,
    sesizari.trunchiat ? "sesizările" : null,
    opriri.trunchiat ? "opririle" : null,
  ].filter((x): x is string => x !== null);

  return {
    raport,
    echipamente: new Map(echipamente.randuri.map((e) => [e.id, e] as const)),
    citiriRestante: citiriRestante(
      contoare.map((c) => ultimele.get(cheieContor(c.equipmentId, c.tip))?.data_citirii ?? null),
      azi,
      setari.prag_contor_necitit_zile,
    ),
    pragContorNecititZile: setari.prag_contor_necitit_zile,
    costOraOprireSetat: setari.cost_ora_oprire !== null,
    trunchiate,
  };
}
