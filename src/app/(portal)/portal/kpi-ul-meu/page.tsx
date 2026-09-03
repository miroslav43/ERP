// src/app/(portal)/portal/kpi-ul-meu/page.tsx

/**
 * KPI-ul propriu, în portal.
 *
 * ── DE CE SE ARATĂ ȘI LUNA ÎN LUCRU ───────────────────────────────────────
 * Cerința e ca angajatul să-și vadă KPI-ul CONSTANT, nu o dată la sfârșit de
 * lună. Deci luna în draft e vizibilă, cu tot ce a apucat managerul să
 * completeze — dar marcată explicit „se mai poate schimba". Politica de SELECT
 * din 0119 o permite; cea de pe evaluarea ANUALĂ, dimpotrivă, a fost strânsă în
 * aceeași migrare tocmai ca o concluzie pe jumătate scrisă să nu ajungă aici.
 *
 * ── DE CE ȚINTELE VIN DIN SET CÂND LUNA NU E DESCHISĂ ─────────────────────
 * Rândul lunii apare abia când managerul o deschide, ceea ce se poate întâmpla
 * pe 20. Fără setul funcției, ecranul ar fi fost gol trei săptămâni pe lună —
 * exact pentru omul căruia i s-a promis vizibilitate constantă.
 */

import type { Metadata } from "next";
import { Gauge } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { Badge } from "@/components/ui/badge";
import { Nivel } from "@/components/ui/nivel";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { ETICHETE_SENS_KPI } from "@/domain/evaluations/kpi-vocabular";
import { fisaMea } from "@/lib/queries/portal";
import { kpiAngajat, tintaEfectivaAfisata } from "@/lib/queries/kpi";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import {
  ETICHETE_STATUS_KPI,
  TONURI_STATUS_KPI,
  formatValoare,
  numeLuna,
  tonKpi,
} from "../../../(app)/evaluari/kpi/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "KPI-ul meu" };

export default async function PaginaKpiulMeu() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "kpi");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "evaluations:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evaluările." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const acum = new Date();
  const an = acum.getFullYear();
  const lunaCurenta = acum.getMonth() + 1;
  const { luna, serie, aplicabil } = await kpiAngajat(
    tenant.organizationId,
    stare.fisa.id,
    an,
    lunaCurenta,
  );

  // Seria de sub luna curentă: lunile ÎNCHEIATE, fără cea afișată sus.
  const istoric = serie.filter((p) => !(p.an === an && p.luna === lunaCurenta));

  if (luna === null && aplicabil.set === null) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <StareGoala
          fel="initiala"
          pictograma={Gauge}
          titlu="Nu aveți încă indicatori"
          descriere={
            aplicabil.motiv === "fara_functie"
              ? "Fișa dumneavoastră nu are funcția completată, iar indicatorii se stabilesc pe funcție. Vorbiți cu managerul sau cu departamentul de personal."
              : "Funcția dumneavoastră nu are încă un set de indicatori. Managerul direct îl poate crea."
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">KPI-ul meu</h1>
        <p className="text-muted-foreground text-nota">
          Indicatorii lunii, puși de managerul direct pe funcția dumneavoastră.
        </p>
      </header>

      {/* ── Luna în curs ───────────────────────────────────────────────── */}
      <section className="border-foreground/15 bg-card space-y-3 rounded-lg border p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{numeLuna(an, lunaCurenta)}</h2>
          {luna === null ? (
            <Badge ton="neutru">Neîncepută</Badge>
          ) : (
            <Badge ton={TONURI_STATUS_KPI[luna.status]}>{ETICHETE_STATUS_KPI[luna.status]}</Badge>
          )}
        </header>

        {luna === null ? (
          <>
            <p className="text-muted-foreground text-nota">
              Managerul n-a deschis încă luna. Până atunci, astea sunt țintele funcției
              dumneavoastră:
            </p>
            <ul className="divide-foreground/10 divide-y">
              {(aplicabil.set?.indicatori ?? []).map((ind) => (
                <li key={ind.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="font-medium">{ind.denumire}</span>
                  <span className="text-muted-foreground text-nota">
                    {ind.tip === "masurat"
                      ? `țintă ${formatValoare(tintaEfectivaAfisata(ind, aplicabil.abateri), ind.unitate)}${
                          ind.sens === null ? "" : ` · ${ETICHETE_SENS_KPI[ind.sens].toLowerCase()}`
                        }`
                      : `scală 1–${String(ind.scala_max ?? 5)}`}
                  </span>
                  <span className="text-muted-foreground text-nota ms-auto tabular-nums">
                    {ind.pondere} %
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {luna.status === "draft" ? (
              <p className="text-muted-foreground text-nota">
                Luna e în lucru — cifrele se mai pot schimba până când managerul o închide.
              </p>
            ) : null}

            {luna.scor.procent === null ? (
              <p className="text-muted-foreground">Nicio linie completată încă.</p>
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-semibold tabular-nums">{luna.scor.procent} %</p>
                <Nivel
                  valoare={luna.scor.procent}
                  din={100}
                  eticheta="Scorul lunii în curs"
                  text={`${String(luna.scor.procent)} % din țintă`}
                  ton={tonKpi(luna.scor.procent)}
                />
              </div>
            )}

            <ul className="divide-foreground/10 divide-y">
              {luna.valori.map((v) => (
                <li key={v.cod} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="font-medium">{v.denumire}</span>
                  <span className="text-muted-foreground text-nota">
                    {v.tip === "masurat"
                      ? `${formatValoare(v.realizat, v.unitate)} din ${formatValoare(v.tinta, v.unitate)}`
                      : v.nota === null
                        ? "nenotat încă"
                        : `nota ${String(v.nota)} din ${String(v.scala_max ?? 5)}`}
                  </span>
                  <span className="ms-auto font-semibold tabular-nums">
                    {v.procent === null ? "—" : `${String(v.procent)} %`}
                  </span>
                  {v.comentariu === null ? null : (
                    <p className="text-muted-foreground text-nota w-full">{v.comentariu}</p>
                  )}
                </li>
              ))}
            </ul>

            {luna.concluzie === null ? null : (
              <p className="text-muted-foreground border-foreground/15 text-nota rounded-lg border p-3">
                {luna.concluzie}
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Lunile încheiate ───────────────────────────────────────────── */}
      {istoric.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-eticheta text-muted-foreground font-semibold tracking-wide uppercase">
            Lunile anterioare
          </h2>
          <ul className="divide-foreground/10 border-foreground/15 divide-y rounded-lg border">
            {istoric.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <span className="font-medium">{numeLuna(p.an, p.luna)}</span>
                <Badge ton={TONURI_STATUS_KPI[p.status]}>{ETICHETE_STATUS_KPI[p.status]}</Badge>
                <span className="ms-auto font-semibold tabular-nums">
                  {p.scor_procent === null ? "—" : `${String(p.scor_procent)} %`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
