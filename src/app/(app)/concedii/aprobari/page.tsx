// src/app/(app)/concedii/aprobari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { Scadenta } from "@/components/ui/scadenta";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatAmount } from "@/lib/format/money";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { deAprobat } from "@/lib/queries/leave";
import { oreParaTermen, treaptaTermenDecizie } from "@/domain/leave/termen-aprobare";

import { ButonSetariConcedii } from "../buton-setari";
import { NavConcedii } from "../nav-concedii";
import { DecizieAprobare } from "./decizie-aprobare";

export const metadata: Metadata = { title: "Aprobări concedii" };

/**
 * Termenul, scris în raport cu ACUM.
 *
 * Înainte era `Termen de decizie: 12.03.2026, 17:00` — text neutru, aceeași
 * greutate pentru un termen depășit de trei zile și pentru unul de peste o
 * lună. Ordinea corectă exista deja în interogare (`order termen_la asc`); ce
 * lipsea era traducerea ei vizuală, adică singurul motiv pentru care sortarea
 * folosește cuiva.
 */
function textTermen(termenLa: string, acum: Date): string {
  const ore = oreParaTermen(termenLa, acum);
  const zile = Math.floor(Math.abs(ore) / 24);

  if (ore < 0) {
    if (zile >= 1) return `Depășit cu ${String(zile)} ${zile === 1 ? "zi" : "zile"}`;
    return "Depășit astăzi";
  }
  if (ore < 1) return "Expiră în mai puțin de o oră";
  if (ore < 24) return `Expiră în ${String(Math.floor(ore))} ore`;
  if (zile === 1) return "Expiră mâine";
  return `Expiră în ${String(zile)} zile`;
}

export default async function PaginaAprobariConcedii() {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "leave"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "leave:approve", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a aproba cereri de concediu. Această secțiune este rezervată managerilor și personalului de resurse umane." />
    );
  }

  const poateVedeaCalendar = can(permisiuni, "leave:read", "team");
  const poateConfigura = can(permisiuni, "leave:update", "all");
  const { sarcini, trunchiat } = await deAprobat(tenant.organizationId, user.id);
  const acum = new Date();

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Aprobări"
        // Numărul stă în subtitlu, nu în titlu: e cifra pentru care se deschide
        // ecranul. E lungimea listei randate, nu un `count` pe `approval_tasks`
        // — vezi nota din `deAprobat`, unde e explicat de ce al doilea ar rămâne
        // permanent mai mare decât primul.
        descriere={
          sarcini.length === 0
            ? "Cererile de concediu care așteaptă decizia dumneavoastră."
            : `${String(sarcini.length)} ${
                sarcini.length === 1 ? "cerere așteaptă" : "cereri așteaptă"
              } decizia dumneavoastră.`
        }
        {...(poateConfigura
          ? { actiuni: <ButonSetariConcedii poateConfigura={poateConfigura} /> }
          : {})}
        file={
          <NavConcedii
            poateVedeaEchipa={poateVedeaCalendar}
            poateAproba={true}
            poateVedeaCalendar={poateVedeaCalendar}
            deAprobat={sarcini.length}
          />
        }
      />

      {/* Plafonul exista de la început (100 de sarcini) și nu ieșea nicăieri:
          a 101-a cerere lipsea de pe ecran fără niciun semn. */}
      {trunchiat ? (
        <Callout fel="atentie" titlu="Coada e mai lungă decât ce se vede">
          Se afișează primele {sarcini.length} sarcini, cele mai apropiate de termen. Decideți-le și
          reîncărcați pagina ca să apară următoarele.
        </Callout>
      ) : null}

      {sarcini.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ClipboardCheck}
          titlu="Nimic de aprobat"
          descriere="Nu aveți nicio cerere de concediu în așteptarea deciziei dumneavoastră."
        />
      ) : (
        <ul className="space-y-3">
          {sarcini.map((sarcina) => (
            <li key={sarcina.taskId} className="border-border rounded-panou border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    <span
                      className="mr-2 inline-block size-2.5 rounded-full align-middle"
                      style={{
                        backgroundColor: sarcina.tip?.culoare ?? "var(--color-muted-foreground)",
                      }}
                      aria-hidden="true"
                    />
                    {sarcina.angajat === null
                      ? "Angajat"
                      : `${sarcina.angajat.fullName} (${sarcina.angajat.marca})`}
                    {" · "}
                    {sarcina.tip?.denumire ?? "Concediu"}
                  </p>
                  <p className="text-muted-foreground text-corp mt-1">
                    {formatDate(sarcina.cerere.dataInceput)} –{" "}
                    {formatDate(sarcina.cerere.dataSfarsit)} ·{" "}
                    {formatAmount(sarcina.cerere.zileLucratoare)} zile lucrătoare
                  </p>
                  {sarcina.termenLa === null ? null : (
                    <p className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Scadenta treapta={treaptaTermenDecizie(sarcina.termenLa, acum)}>
                        {textTermen(sarcina.termenLa, acum)}
                      </Scadenta>
                      <span className="text-muted-foreground text-nota">
                        termen: {formatDateTime(sarcina.termenLa)}
                      </span>
                    </p>
                  )}
                  <Link
                    href={`/concedii/${sarcina.cerere.id}`}
                    className="text-primary text-nota mt-1 inline-block underline-offset-2 hover:underline"
                  >
                    Vezi cererea completă
                  </Link>
                </div>
                <DecizieAprobare taskId={sarcina.taskId} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
