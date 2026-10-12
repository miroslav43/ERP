// src/app/(app)/mentenanta/rapoarte/page.tsx
import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { BarChart3, FileDown } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { FileModul } from "@/components/ui/file-modul";
import { Indicator } from "@/components/ui/indicator";
import { Schelet } from "@/components/ui/schelet";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_MENTENANTA } from "@/config/file-module";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  PRAG_COST_VALOARE_INLOCUIRE,
  TOP_PARETO,
  ZILE_DEFECT_REPETAT,
  formatOreIndicator,
  formatOreProgram,
  formatProcent,
  imparte,
  normalizeazaPerioada,
  type EchipamentRaport,
  type Perioada,
  type PlanRaport,
  type RandEchipamentIndicatori,
  type RandPareto,
} from "@/domain/maintenance/indicatori";
import { filtreRapoarteSchema } from "@/schemas/maintenance";

import { ETICHETE_TIP_MENTENANTA, textNumarat } from "../etichete";
import { incarcaRaport } from "./date-raport";
import { FiltreRapoarteForm } from "./filtre-rapoarte";

export const metadata: Metadata = { title: "Rapoarte de mentenanță" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function numeEchipament(id: string, echipamente: ReadonlyMap<string, EchipamentRaport>): string {
  const e = echipamente.get(id);
  return e === undefined ? "Echipament indisponibil" : `${e.cod} — ${e.denumire}`;
}

/** Fișa există doar pentru echipamentele citite; altfel rândul rămâne text. */
function hrefEchipament(
  id: string,
  echipamente: ReadonlyMap<string, EchipamentRaport>,
): string | null {
  return echipamente.has(id) ? `/mentenanta/echipamente/${id}` : null;
}

function Sectiune({ titlu, children }: { readonly titlu: string; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sectiune font-semibold">{titlu}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function TabelPareto({
  titlu,
  randuri,
  echipamente,
  formatValoare,
  gol,
}: {
  readonly titlu: string;
  readonly randuri: readonly RandPareto[];
  readonly echipamente: ReadonlyMap<string, EchipamentRaport>;
  readonly formatValoare: (valoare: number) => string;
  readonly gol: string;
}) {
  const coloane: readonly Coloana<RandPareto>[] = [
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "titlu",
      celula: (r) => numeEchipament(r.equipmentId, echipamente),
    },
    {
      cheie: "valoare",
      antet: "Valoare",
      numeric: true,
      peTelefon: "insigna",
      celula: (r) => formatValoare(r.valoare),
    },
    {
      cheie: "procent",
      antet: "Din total",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatProcent(r.procent),
    },
    {
      cheie: "cumulat",
      antet: "Cumulat",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatProcent(r.cumulat),
    },
  ];
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-corp font-semibold">{titlu}</h3>
      <Tabel
        caption={titlu}
        coloane={coloane}
        randuri={randuri}
        cheieRand={(r) => r.equipmentId}
        href={(r) => hrefEchipament(r.equipmentId, echipamente)}
        densitate="compact"
        gol={<p className="text-muted-foreground text-corp py-4">{gol}</p>}
      />
    </section>
  );
}

async function Raport({
  organizationId,
  perioada,
  poateSetari,
}: {
  readonly organizationId: string;
  readonly perioada: Perioada;
  /** Poarta lui `/mentenanta/setari` (`porti-ruta.ts`): `maintenance:update` all. */
  readonly poateSetari: boolean;
}) {
  const date = await incarcaRaport(organizationId, perioada);
  const { raport, echipamente } = date;
  const t = raport.totaluri;
  const parametriPerioada = `de_la=${perioada.deLa}&pana_la=${perioada.panaLa}`;

  if (raport.echipamente.length === 0 && raport.amanari.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={BarChart3}
        titlu="Nimic de raportat încă"
        descriere="Raportul se umple din echipamentele din evidență, intervențiile înregistrate, sesizări și opriri."
        actiune={{ eticheta: "Deschide echipamentele", href: "/mentenanta/echipamente" }}
      />
    );
  }

  const coloaneEchipamente: readonly Coloana<RandEchipamentIndicatori>[] = [
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "titlu",
      celula: (r) => numeEchipament(r.equipmentId, echipamente),
    },
    {
      cheie: "semnal",
      antet: "Semnal",
      antetAscuns: true,
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (r) =>
        r.semnalInlocuire ? (
          <Badge ton="pericol" cuAvertisment>
            De înlocuit?
          </Badge>
        ) : null,
    },
    {
      cheie: "interventii",
      antet: "Intervenții",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => String(r.numarInterventii),
    },
    {
      cheie: "suportat",
      antet: "Cost suportat",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.costuri.suportat),
    },
    {
      cheie: "defalcare",
      antet: "Prev. / corect. / legal",
      numeric: true,
      peTelefon: "ascuns",
      celula: (r) =>
        `${formatLei(r.costuri.preventiv)} / ${formatLei(r.costuri.corectiv)} / ${formatLei(r.costuri.legal)}`,
    },
    {
      cheie: "garantie",
      antet: "În garanție",
      numeric: true,
      peTelefon: "ascuns",
      celula: (r) => (r.costuri.garantie === 0 ? "—" : formatLei(r.costuri.garantie)),
    },
    {
      cheie: "cost_valoare",
      antet: "Cost / valoare (12 luni)",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatProcent(r.raportCostValoare),
    },
    {
      cheie: "sesizari",
      antet: "Sesizări",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => String(r.sesizari),
    },
    {
      cheie: "disponibilitate",
      antet: "Disponibilitate",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatProcent(r.disponibilitate),
    },
    {
      cheie: "mtbf",
      antet: "MTBF",
      numeric: true,
      peTelefon: "ascuns",
      celula: (r) => formatOreProgram(r.mtbfOre === null ? null : Math.round(r.mtbfOre * 10) / 10),
    },
    {
      cheie: "cost_opriri",
      antet: "Costul opririlor",
      numeric: true,
      peTelefon: "ascuns",
      celula: (r) => (r.costOpriri === null ? "—" : formatLei(r.costOpriri)),
    },
  ];

  const coloaneAmanari: readonly Coloana<PlanRaport>[] = [
    { cheie: "plan", antet: "Plan", peTelefon: "titlu", celula: (p) => p.denumire },
    {
      cheie: "amanari",
      antet: "Amânări",
      numeric: true,
      peTelefon: "insigna",
      celula: (p) => String(p.numar_amanari),
    },
    {
      cheie: "echipament",
      antet: "Echipament",
      peTelefon: "meta",
      celula: (p) => numeEchipament(p.equipment_id, echipamente),
    },
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "meta",
      celula: (p) => ETICHETE_TIP_MENTENANTA[p.tip],
    },
    {
      cheie: "scadenta",
      antet: "Scadența",
      peTelefon: "meta",
      celula: (p) => (p.urmatoarea_scadenta === null ? "—" : formatDate(p.urmatoarea_scadenta)),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {date.trunchiate.length > 0 ? (
        // Cazul 45: citirea s-a oprit la plafon. Cifrele de mai jos sunt un minim.
        <Callout fel="atentie" titlu="Cifrele de mai jos sunt un minim">
          S-au citit cel mult 5.000 de rânduri pentru {date.trunchiate.join(", ")}. Restrângeți
          perioada pentru cifre complete.
        </Callout>
      ) : null}

      <Sectiune titlu="Costuri">
        <Indicator
          eticheta="Cost suportat"
          valoare={formatLei(t.costuri.suportat)}
          nota={`preventiv ${formatLei(t.costuri.preventiv)} · corectiv ${formatLei(t.costuri.corectiv)} · legal ${formatLei(t.costuri.legal)}`}
          href={`/mentenanta/interventii?${parametriPerioada}`}
        />
        <Indicator
          eticheta="Intern / extern"
          valoare={formatProcent(imparte(t.costuri.intern, t.costuri.suportat))}
          nota={`intern ${formatLei(t.costuri.intern)} · extern ${formatLei(t.costuri.extern)}`}
        />
        <Indicator
          eticheta="Acoperit de garanție"
          valoare={formatLei(t.costuri.garantie)}
          nota="Raportat separat; nu intră în costul suportat."
        />
        <Indicator
          eticheta="Semnale de înlocuire"
          valoare={raport.semnaleInlocuire.length}
          ton={raport.semnaleInlocuire.length > 0 ? "pericol" : "neutru"}
          nota={`Cost pe 12 luni peste ${formatProcent(PRAG_COST_VALOARE_INLOCUIRE)} din valoarea de achiziție.`}
        />
      </Sectiune>

      <Sectiune titlu="Disponibilitate și opriri">
        <Indicator
          eticheta="Disponibilitate"
          valoare={formatProcent(t.disponibilitate)}
          ton={t.disponibilitate !== null && t.disponibilitate < 0.9 ? "atentie" : "neutru"}
          nota={`${formatOreProgram(t.oreOprire)} de oprire din ${formatOreProgram(t.oreProgram)} de program.`}
        />
        <Indicator
          eticheta="Timp mediu de reparație (MTTR)"
          valoare={formatOreIndicator(t.mttrOre)}
          nota="Opririle neplanificate încheiate în perioadă."
        />
        <Indicator
          eticheta="Timp mediu între defecțiuni (MTBF)"
          valoare={formatOreProgram(t.mtbfOre === null ? null : Math.round(t.mtbfOre * 10) / 10)}
          nota="Ore de program funcționate pe oprire neplanificată."
        />
        <Indicator
          eticheta="Costul opririlor"
          valoare={t.costOpriri === null ? "—" : formatLei(t.costOpriri)}
          nota={
            date.costOraOprireSetat
              ? "Ore de oprire în program × costul unei ore de oprire."
              : poateSetari
                ? "Setați costul unei ore de oprire în setările mentenanței."
                : "Costul unei ore de oprire nu e setat; îl setează administratorul organizației."
          }
          // Linkul doar spre o țintă care se deschide: setările cer `maintenance:update` all.
          {...(date.costOraOprireSetat || !poateSetari ? {} : { href: "/mentenanta/setari" })}
        />
      </Sectiune>

      <Sectiune titlu="Sesizări">
        <Indicator
          eticheta="Sesizări raportate"
          valoare={t.sesizari}
          nota="Fără cele respinse sau retrase."
          href="/mentenanta/sesizari"
        />
        <Indicator
          eticheta="Timp mediu de atribuire"
          valoare={formatOreIndicator(t.timpAtribuireOre)}
          nota="De la raportare până la tehnicianul atribuit."
        />
        <Indicator
          eticheta="Timp mediu de rezolvare"
          valoare={formatOreIndicator(t.timpRezolvareOre)}
          nota="De la raportare până la „rezolvat”."
        />
        <Indicator
          eticheta="Defecte repetate"
          valoare={formatProcent(t.defecteRepetate.rata)}
          ton={t.defecteRepetate.repetate > 0 ? "atentie" : "neutru"}
          nota={`${textNumarat(t.defecteRepetate.repetate, "sesizare", "sesizări")} pe același echipament în ${String(ZILE_DEFECT_REPETAT)} de zile.`}
        />
      </Sectiune>

      <Sectiune titlu="Planuri și verificări legale">
        <Indicator
          eticheta="Planuri executate la timp"
          valoare={formatProcent(t.planuriLaTimp.rata)}
          nota={`${String(t.planuriLaTimp.laTimp)} din ${String(t.planuriLaTimp.evaluate)}: execuțiile judecate față de scadența lor${t.planuriLaTimp.restante > 0 ? ` și ${textNumarat(t.planuriLaTimp.restante, "plan depășit neexecutat", "planuri depășite neexecutate")}` : ""}.`}
          href="/mentenanta/planuri"
        />
        <Indicator
          eticheta="Verificări legale la timp"
          valoare={formatProcent(t.legaleLaTimp.rata)}
          ton={t.legaleLaTimp.rata !== null && t.legaleLaTimp.rata < 1 ? "atentie" : "neutru"}
          nota={`Zile de depășire: ${String(t.zileDepasire.total)}${t.zileDepasire.numar > 0 ? ` (cel mult ${String(t.zileDepasire.maxim)} la o verificare)` : ""}.`}
          href="/mentenanta/planuri?tip=verificare_legala&scadenta=actiune"
        />
        <Indicator
          eticheta="Planuri amânate acum"
          valoare={t.amanari.inCurs}
          nota={`${textNumarat(t.amanari.total, "amânare", "amânări")} în istoric, pe ${textNumarat(t.amanari.planuri, "plan activ", "planuri active")}.`}
        />
        <Indicator
          eticheta="Citiri de contor restante"
          valoare={date.citiriRestante}
          ton={date.citiriRestante > 0 ? "atentie" : "neutru"}
          nota={`Contoare cu plan necitite de peste ${textNumarat(date.pragContorNecititZile, "zi", "zile")} (starea de azi).`}
          href="/mentenanta/contoare"
        />
      </Sectiune>

      <div className="grid gap-6 lg:grid-cols-2">
        <TabelPareto
          titlu={`Top ${String(TOP_PARETO)} după sesizări`}
          randuri={raport.paretoSesizari}
          echipamente={echipamente}
          formatValoare={(v) => String(v)}
          gol="Nicio sesizare în perioadă."
        />
        <TabelPareto
          titlu={`Top ${String(TOP_PARETO)} după cost`}
          randuri={raport.paretoCost}
          echipamente={echipamente}
          formatValoare={(v) => formatLei(v)}
          gol="Niciun cost suportat în perioadă."
        />
      </div>

      <section className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sectiune font-semibold">Pe echipament</h2>
        <Tabel
          caption="Indicatorii fiecărui echipament în perioada aleasă, cele mai costisitoare primele."
          coloane={coloaneEchipamente}
          randuri={raport.echipamente}
          cheieRand={(r) => r.equipmentId}
          href={(r) => hrefEchipament(r.equipmentId, echipamente)}
          densitate="compact"
          gol={null}
        />
      </section>

      {raport.amanari.length > 0 ? (
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="text-sectiune font-semibold">Planuri amânate</h2>
          <p className="text-muted-foreground text-corp">
            Contorul numără toate amânările planului, și pe cele dinaintea ultimei execuții; doar
            amânarea în curs se golește la execuția reușită.
          </p>
          <Tabel
            caption="Planurile active amânate cel puțin o dată, cele mai amânate primele."
            coloane={coloaneAmanari}
            randuri={raport.amanari}
            cheieRand={(p) => p.id}
            href={(p) => `/mentenanta/planuri/${p.id}`}
            densitate="compact"
            gol={null}
          />
        </section>
      ) : null}
    </div>
  );
}

export default async function PaginaRapoarteMentenanta({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta rapoartele de mentenanță. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;
  const filtre = filtreDinUrl(filtreRapoarteSchema, parametri);
  const azi = todayInBucharest();
  const { perioada, avertisment } = normalizeazaPerioada(filtre.de_la, filtre.pana_la, azi);
  const poateExporta = can(permisiuni, "maintenance:export", "team");
  const poateSetari = can(permisiuni, "maintenance:update", "all");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Rapoarte de mentenanță"
        descriere={`Costuri, disponibilitate, sesizări și planuri, între ${formatDate(perioada.deLa)} și ${formatDate(perioada.panaLa)}.`}
        file={<FileModul eticheta="Navigare mentenanță" file={FILE_MENTENANTA} tenant={tenant} />}
        {...(poateExporta
          ? {
              actiuni: (
                <a
                  href={`/api/export/mentenanta/rapoarte?de_la=${perioada.deLa}&pana_la=${perioada.panaLa}`}
                  aria-label="Exportă raportul pe echipamente (CSV)"
                  className={buton({ varianta: "secundar" })}
                >
                  <FileDown aria-hidden="true" className="size-4" />
                  CSV
                </a>
              ),
            }
          : {})}
      />

      <FiltreRapoarteForm perioada={perioada} azi={azi} />

      {avertisment === null ? null : (
        <Callout fel="atentie" titlu="Perioada a fost ajustată">
          {avertisment}
        </Callout>
      )}

      <Suspense
        key={`${perioada.deLa}:${perioada.panaLa}`}
        fallback={<Schelet forma="tabel" coloane={6} />}
      >
        <Raport
          organizationId={tenant.organizationId}
          perioada={perioada}
          poateSetari={poateSetari}
        />
      </Suspense>
    </div>
  );
}
