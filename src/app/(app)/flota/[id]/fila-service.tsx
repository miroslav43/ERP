// src/app/(app)/flota/[id]/fila-service.tsx
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Paginare } from "@/components/ui/paginare";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { scadentaPlan, stareaPlanului } from "@/domain/fleet/service";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import {
  intrariService,
  LIMITA_IMPLICITA_PAGINA,
  planuriService,
  type IntrareService,
  type PlanService,
} from "@/lib/queries/fleet-service";

import {
  ETICHETE_ANVELOPE,
  ETICHETE_STARE_PLAN,
  ETICHETE_TIP_SERVICE,
  TONURI_STARE_PLAN,
} from "../etichete-service";
import { ButonStergeService } from "./buton-sterge-service";
import { DialogIntrareService } from "./dialog-intrare-service";
import { DialogPlanService } from "./dialog-plan-service";

const fmtKm = (n: number): string => n.toLocaleString("ro-RO");

/**
 * Fila „Service” a fișei vehiculului (0203): planurile cu scadența lor și
 * intervențiile făcute.
 *
 * Citirea nu are filtre de scope: `vsp_select` / `vse_select` judecă prin
 * `app.poate_vedea_costurile_vehiculului` (`update = all`, `read = all`, sau
 * `team` pe mașina echipei care nu e în pool). Cine nu le poate citi primește
 * zero rânduri; pagina nu deschide fila pentru el (vezi `poateVedeaService`).
 * Scrierea (butoanele) cere `vehicles:update = all`, `poateAdministra`.
 */
export async function FilaService({
  organizationId,
  vehiculId,
  kmCurent,
  pragSalt,
  azi,
  poateAdministra,
  vehiculInParc,
  cursor,
}: Readonly<{
  organizationId: string;
  vehiculId: string;
  kmCurent: number;
  pragSalt: number;
  azi: string;
  poateAdministra: boolean;
  /** Un vehicul vândut sau casat nu mai primește planuri (baza refuză). */
  vehiculInParc: boolean;
  cursor: string | null;
}>): Promise<ReactElement> {
  const [planuri, pagina] = await Promise.all([
    planuriService(organizationId, vehiculId),
    intrariService(organizationId, vehiculId, { cursor, limita: LIMITA_IMPLICITA_PAGINA }),
  ]);
  const planuriActive = planuri.filter((p) => p.activ);
  const numePlan = new Map(planuri.map((p) => [p.id, p.denumire]));

  const coloanePlanuri: readonly Coloana<PlanService>[] = [
    {
      cheie: "plan",
      antet: "Plan",
      peTelefon: "titlu",
      celula: (p) => (
        <>
          {p.denumire}
          <span className="text-muted-foreground text-nota block">
            {ETICHETE_TIP_SERVICE[p.tip]}
          </span>
          {p.observatii === null ? null : (
            <span className="text-muted-foreground text-nota block">{p.observatii}</span>
          )}
        </>
      ),
    },
    {
      cheie: "interval",
      antet: "La fiecare",
      peTelefon: "meta",
      celula: (p) =>
        [
          p.interval_km === null ? null : `${fmtKm(p.interval_km)} km`,
          p.interval_luni === null ? null : `${String(p.interval_luni)} luni`,
        ]
          .filter((x) => x !== null)
          .join(" sau "),
    },
    {
      cheie: "ultima",
      antet: "Ultima",
      peTelefon: "meta",
      celula: (p) => `${formatDate(p.ultima_data)} · ${fmtKm(p.ultimii_km)} km`,
    },
    {
      cheie: "urmatoarea",
      antet: "Următoarea",
      peTelefon: "meta",
      celula: (p) => scadentaPlan(p),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (p) => {
        const v = stareaPlanului(p, azi, kmCurent);
        const detaliu =
          v.stare === "oprit" || v.stare === "fara_scadenta"
            ? null
            : v.motiv === "km" && v.kmRamasi !== null
              ? v.kmRamasi <= 0
                ? `cu ${fmtKm(-v.kmRamasi)} km peste țintă`
                : `mai sunt ${fmtKm(v.kmRamasi)} km`
              : v.zileRamase !== null
                ? v.zileRamase < 0
                  ? `de ${String(-v.zileRamase)} zile`
                  : v.zileRamase === 0
                    ? "azi"
                    : `peste ${String(v.zileRamase)} zile`
                : null;
        return (
          <>
            <Badge ton={TONURI_STARE_PLAN[v.stare]}>{ETICHETE_STARE_PLAN[v.stare]}</Badge>
            {detaliu === null ? null : (
              <span className="text-muted-foreground text-nota ml-1">{detaliu}</span>
            )}
          </>
        );
      },
    },
    ...(poateAdministra
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            peTelefon: "meta",
            // `<span inline-flex>`, nu `<div>`: pe telefon celula se randează într-un `<p>`.
            celula: (p: PlanService) => (
              <span className="inline-flex items-center gap-1">
                {p.activ ? (
                  <DialogIntrareService
                    vehiculId={vehiculId}
                    kmCurent={kmCurent}
                    pragSalt={pragSalt}
                    azi={azi}
                    planuri={planuriActive}
                    planImplicit={p}
                  />
                ) : null}
                <DialogPlanService vehiculId={vehiculId} kmCurent={kmCurent} azi={azi} plan={p} />
              </span>
            ),
          } satisfies Coloana<PlanService>,
        ]
      : []),
  ];

  const coloaneIntrari: readonly Coloana<IntrareService>[] = [
    {
      cheie: "data",
      antet: "Data",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (i) => formatDate(i.data_interventiei),
    },
    {
      cheie: "lucrare",
      antet: "Lucrare",
      peTelefon: "titlu",
      celula: (i) => (
        <>
          {i.descriere}
          <span className="text-muted-foreground text-nota block">
            {ETICHETE_TIP_SERVICE[i.tip]}
            {i.plan_id === null ? "" : ` · ${numePlan.get(i.plan_id) ?? "plan șters"}`}
            {i.furnizor === null ? "" : ` · ${i.furnizor}`}
            {i.numar_factura === null ? "" : ` · factura ${i.numar_factura}`}
            {i.anvelope_montate === null
              ? ""
              : ` · montate: ${ETICHETE_ANVELOPE[i.anvelope_montate]}`}
          </span>
        </>
      ),
    },
    {
      cheie: "km",
      antet: "Km",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (i) => `${fmtKm(i.km)} km`,
    },
    {
      cheie: "piese",
      antet: "Piese",
      numeric: true,
      latime: "ingusta",
      peTelefon: "ascuns",
      celula: (i) => formatLei(i.cost_piese),
    },
    {
      cheie: "manopera",
      antet: "Manoperă",
      numeric: true,
      latime: "ingusta",
      peTelefon: "ascuns",
      celula: (i) => formatLei(i.cost_manopera),
    },
    {
      cheie: "total",
      antet: "Total",
      numeric: true,
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (i) => formatLei(i.cost_total),
    },
    ...(poateAdministra
      ? [
          {
            cheie: "actiuni",
            antet: "Acțiuni",
            antetAscuns: true,
            latime: "ingusta",
            peTelefon: "meta",
            celula: (i: IntrareService) => (
              <ButonStergeService
                fel="intrare"
                id={i.id}
                vehiculId={vehiculId}
                descriere={`intervenția din ${formatDate(i.data_interventiei)}`}
                legataDePlan={i.plan_id !== null}
                cifre={[
                  { eticheta: "Data", valoare: formatDate(i.data_interventiei) },
                  { eticheta: "Lucrare", valoare: i.descriere },
                  { eticheta: "Total", valoare: formatLei(i.cost_total) },
                ]}
              />
            ),
          } satisfies Coloana<IntrareService>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="planuri-service" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="planuri-service" className="text-sectiune font-semibold">
            Planuri de service
          </h2>
          {poateAdministra && vehiculInParc ? (
            <DialogPlanService vehiculId={vehiculId} kmCurent={kmCurent} azi={azi} />
          ) : null}
        </div>
        <p className="text-muted-foreground text-corp">
          Scadența pe dată primește alerte înainte de termen și intră în rezumatul de dimineață; cea
          pe kilometri trimite o alertă când se apropie ținta și una când a fost depășită.
        </p>
        <Tabel
          caption="Planurile de service ale vehiculului, cu ultima intervenție, următoarea scadență și starea ei."
          coloane={coloanePlanuri}
          randuri={planuri}
          cheieRand={(p) => p.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Niciun plan de service. Adăugați unul ca să primiți alerte înainte de revizie.
            </p>
          }
        />
      </section>

      <section aria-labelledby="intrari-service" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="intrari-service" className="text-sectiune font-semibold">
            Intervenții făcute
          </h2>
          {poateAdministra ? (
            <DialogIntrareService
              vehiculId={vehiculId}
              kmCurent={kmCurent}
              pragSalt={pragSalt}
              azi={azi}
              planuri={planuriActive}
            />
          ) : null}
        </div>
        <Tabel
          caption="Intervențiile de service ale vehiculului, cele mai noi întâi, cu costul pe piese și manoperă."
          coloane={coloaneIntrari}
          randuri={pagina.randuri}
          cheieRand={(i) => i.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Nicio intervenție înregistrată pentru acest vehicul.
            </p>
          }
        />
        {pagina.randuri.length === 0 && cursor === null ? null : (
          <Paginare
            afisate={pagina.randuri.length}
            cursorUrmator={pagina.urmatorulCursor}
            limita={LIMITA_IMPLICITA_PAGINA}
            marimiPosibile={[LIMITA_IMPLICITA_PAGINA]}
            construiesteHref={({ cursor: c }) =>
              `/flota/${vehiculId}?fila=service${c === null ? "" : `&cursor=${encodeURIComponent(c)}`}`
            }
          />
        )}
      </section>
    </div>
  );
}
