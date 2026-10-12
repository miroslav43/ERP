// src/app/(app)/mentenanta/planuri/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Paginare } from "@/components/ui/paginare";
import { Scadenta } from "@/components/ui/scadenta";
import { Schelet } from "@/components/ui/schelet";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { pasiDinInstructiuni } from "@/domain/maintenance/instructiuni";
import { TREPTE_MENTENANTA, stareScadentaPlan } from "@/domain/maintenance/scadente";
import { can, getPermissionMap, type PermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { scrieSortare } from "@/lib/queries/cursor";
import {
  angajatiDupaId,
  angajatiInactiviDintre,
  cheieContor,
  echipamenteDupaId,
  listeazaPlanuri,
  optiuniAngajati,
  optiuniEchipamente,
  ultimeleCitiriContor,
  type PlanMentenanta,
} from "@/lib/queries/maintenance";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { filtrePlanuriSchema, type TipContor } from "@/schemas/maintenance";

import { FormularPlan } from "../echipamente/[id]/formular-plan";
import {
  ETICHETE_STARE_SCADENTA,
  ETICHETE_TIP_MENTENANTA,
  formatCifraContor,
  formatContor,
  formatPeriodicitate,
  textNumarat,
} from "../etichete";
import { DialogAmanaPlan } from "./dialog-amana-plan";
import { DialogExecutaPlan } from "./dialog-executa-plan";
import { FiltrePlanuriForm } from "./filtre-planuri";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_MENTENANTA } from "@/config/file-module";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisaDinHarta } from "@/lib/navigare/fisa";

export const metadata: Metadata = { title: "Planuri de mentenanță" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** `activ` lipsă din adresă ⇒ „active”: lista se deschide pe planurile care contează azi. */
function cuImplicitActiv<T extends { readonly activ: "da" | "nu" | "toate" | null }>(
  filtre: T,
): T & { readonly activ: "da" | "nu" | "toate" } {
  return { ...filtre, activ: filtre.activ ?? "da" };
}

async function TabelPlanuri({
  organizationId,
  parametri,
  poateScrie,
  angajati,
  permisiuni,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly poateScrie: boolean;
  readonly angajati: readonly { readonly id: string; readonly nume: string }[];
  readonly permisiuni: PermissionMap;
}) {
  const azi = todayInBucharest();
  const filtre = cuImplicitActiv(filtreDinUrl(filtrePlanuriSchema, parametri));
  const { randuri, urmatorulCursor, total, sortare } = await listeazaPlanuri(
    organizationId,
    filtre,
    azi,
  );

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu trebuie să șteargă filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/mentenanta/planuri" : `/mentenanta/planuri?${p.toString()}`;
  }

  if (randuri.length === 0) {
    const areFiltre =
      filtre.echipament !== null ||
      filtre.tip !== null ||
      filtre.responsabil !== null ||
      filtre.scadenta !== null ||
      filtre.activ !== "da";
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={CalendarClock}
        titlu={areFiltre ? "Niciun plan pentru filtrele alese" : "Niciun plan de mentenanță activ"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate planurile active."
            : "Planurile se adaugă de aici, cu „Plan de mentenanță nou”, sau din fișa fiecărui echipament."
        }
        {...(areFiltre
          ? {
              actiune: {
                eticheta: "Șterge filtrele",
                href: adresa((p) => {
                  for (const c of [
                    "echipament",
                    "tip",
                    "responsabil",
                    "scadenta",
                    "activ",
                    "cursor",
                  ])
                    p.delete(c);
                }),
              },
            }
          : {})}
      />
    );
  }

  /*
   * Ultima citire pe fiecare (echipament, tip de contor) — numai pentru
   * planurile care chiar au scadență pe contor. Fără ea, coloana „Scadență”
   * spunea jumătate din adevăr: un plan depășit cu 200 de ore apărea „În regulă”.
   */
  const planuriCuContor = randuri.filter(
    (p) => p.tip_contor !== null && p.urmatoarea_scadenta_contor !== null,
  );
  const idResponsabili = randuri
    .map((p) => p.responsabil_employee_id)
    .filter((v): v is string => v !== null);

  const [echipamente, responsabili, citiri, inactivi] = await Promise.all([
    echipamenteDupaId(
      organizationId,
      randuri.map((p) => p.equipment_id),
    ),
    angajatiDupaId(organizationId, idResponsabili),
    ultimeleCitiriContor(
      organizationId,
      planuriCuContor.map((p) => p.equipment_id),
      planuriCuContor.map((p) => p.tip_contor).filter((tip): tip is TipContor => tip !== null),
    ),
    // Responsabilul plecat din firmă nu dă nicio eroare nicăieri: planul rămâne
    // al lui, alertele lui pleacă în gol. Lista îl marchează, panoul îl numără.
    angajatiInactiviDintre(organizationId, idResponsabili),
  ]);

  function citireaPlanului(plan: PlanMentenanta): number | null {
    if (plan.tip_contor === null) return null;
    return citiri.get(cheieContor(plan.equipment_id, plan.tip_contor)) ?? null;
  }

  const deReatribuit = randuri.filter(
    (p) => p.activ && p.responsabil_employee_id !== null && inactivi.has(p.responsabil_employee_id),
  ).length;

  const coloane: readonly Coloana<PlanMentenanta>[] = [
    {
      cheie: "denumire",
      antet: "Plan",
      sortabil: true,
      peTelefon: "titlu",
      celula: (plan) => (
        <span className="font-medium">
          {plan.denumire}
          <span className="text-muted-foreground text-nota ml-1">
            ({ETICHETE_TIP_MENTENANTA[plan.tip]})
          </span>
          {!plan.activ ? (
            <Badge ton="neutru" className="ml-2">
              Inactiv
            </Badge>
          ) : null}
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
          {formatPeriodicitate(plan)}
          {plan.mod_calcul === "fix" ? " · grilă fixă" : ""}
        </span>
      ),
    },
    {
      cheie: "responsabil",
      antet: "Responsabil",
      peTelefon: "meta",
      celula: (plan) => {
        if (plan.responsabil_employee_id === null) return "—";
        const nume = (
          <LinkEntitate
            href={hrefFisaDinHarta(plan.responsabil_employee_id, responsabili, permisiuni)}
          >
            {responsabili.get(plan.responsabil_employee_id)?.full_name ?? "—"}
          </LinkEntitate>
        );
        return inactivi.has(plan.responsabil_employee_id) ? (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {nume}
            <Badge ton="atentie">De reatribuit</Badge>
          </span>
        ) : (
          nume
        );
      },
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (plan) => {
        if (!plan.activ) return <span className="text-muted-foreground">—</span>;
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
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Scadenta treapta={TREPTE_MENTENANTA[stare]}>{ETICHETE_STARE_SCADENTA[stare]}</Scadenta>
            {plan.amanat_pana !== null && plan.amanat_pana >= azi ? (
              <Badge ton="neutru">Amânat</Badge>
            ) : null}
          </span>
        );
      },
    },
    {
      cheie: "scadenta",
      antet: "Scadent la",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (plan) => {
        const citire = citireaPlanului(plan);
        return (
          <div className="flex flex-col">
            <span className="tabular-nums">
              {plan.urmatoarea_scadenta === null ? "—" : formatDate(plan.urmatoarea_scadenta)}
            </span>
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
    ...(poateScrie
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            peTelefon: "actiuni",
            celula: (plan: PlanMentenanta) =>
              plan.activ ? (
                <span className="flex flex-wrap items-center gap-1">
                  <DialogExecutaPlan
                    planId={plan.id}
                    equipmentId={plan.equipment_id}
                    denumire={plan.denumire}
                    tip={plan.tip}
                    pasi={pasiDinInstructiuni(plan.instructiuni)}
                    angajati={angajati}
                    azi={azi}
                    compact
                  />
                  {plan.periodicitate_zile !== null ? (
                    <DialogAmanaPlan
                      planId={plan.id}
                      denumire={plan.denumire}
                      scadentaCurenta={plan.urmatoarea_scadenta}
                      numarAmanari={plan.numar_amanari}
                      azi={azi}
                      compact
                    />
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground text-nota">Inactiv</span>
              ),
          } satisfies Coloana<PlanMentenanta>,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {deReatribuit > 0 ? (
        <Callout fel="atentie" titlu="Planuri cu responsabil plecat din firmă">
          {textNumarat(deReatribuit, "plan de pe pagina asta are", "planuri de pe pagina asta au")}{" "}
          un responsabil care nu mai e activ. Alertele lor zilnice nu ajung la nimeni: deschideți
          planul și alegeți alt responsabil.
        </Callout>
      ) : null}
      <Tabel
        caption="Planurile de mentenanță ale organizației, cu scadența lor."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(plan) => plan.id}
        href={(plan) => `/mentenanta/planuri/${plan.id}`}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul nu supraviețuiește unei schimbări de sortare: ar continua
            // de la un rând care, în noua ordine, nu mai e acolo unde era.
            p.delete("cursor");
          })
        }
        gol={null}
      />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa((p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </div>
  );
}

export default async function PaginaPlanuri({ searchParams }: ProprietatiPagina) {
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

  const poateScrie = can(permisiuni, "maintenance:update", "team");
  const parametri = await searchParams;
  // Aceeași validare ca a tabelului, refăcută aici fiindcă e pură: bara de
  // filtre are nevoie de valorile CURENTE ca să-și scrie pastilele.
  const filtre = cuImplicitActiv(filtreDinUrl(filtrePlanuriSchema, parametri));

  // Listele pentru filtre și pentru „Plan nou” — aceleași două interogări,
  // cu limită scrisă (cea mai mare firmă reală are opt angajați).
  const [echipamente, angajati] = await Promise.all([
    optiuniEchipamente(tenant.organizationId),
    optiuniAngajati(tenant.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Planuri de mentenanță"
        descriere="Mentenanța periodică, cu cea mai apropiată scadență prima. Starea combină scadența pe zile cu cea pe contor, față de ultima citire cunoscută."
        {...(poateScrie
          ? {
              actiuni: (
                <FormularPlan
                  echipamente={echipamente.map((e) => ({ valoare: e.id, eticheta: e.nume }))}
                  angajati={angajati}
                />
              ),
            }
          : {})}
        file={<FileModul eticheta="Navigare mentenanță" file={FILE_MENTENANTA} tenant={tenant} />}
      />

      <FiltrePlanuriForm filtre={filtre} echipamente={echipamente} responsabili={angajati} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={7} />}>
        <TabelPlanuri
          organizationId={tenant.organizationId}
          parametri={parametri}
          poateScrie={poateScrie}
          angajati={angajati}
          permisiuni={permisiuni}
        />
      </Suspense>
    </div>
  );
}
