// src/app/(app)/onboarding/sabloane/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteSablon, etapeleSablonului, pasiiSablonului } from "@/lib/queries/checklist";

import { stareDinSablon } from "../../_formulare/citire";
import {
  ETICHETE_FEL_PAS,
  ETICHETE_RESPONSABIL_TIP,
  ETICHETE_ROL,
  ETICHETE_TIP,
} from "../../etichete";
import { AsistentSablon } from "../_componente/asistent-sablon";
import { optiuniAsistent } from "../_componente/optiuni";
import { buton } from "@/components/ui/buton";
import { poateDeschide, type ContextPorti } from "@/config/porti-ruta";

export const metadata: Metadata = { title: "Șablon de checklist" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaSablon({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni, module] = await Promise.all([
    requireFeature(tenant.organizationId, "onboarding"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);
  const contextPorti: ContextPorti = { features: module, permissions: permisiuni };

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta șabloanele de checklist. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const sablon = await citesteSablon(tenant.organizationId, id);
  if (sablon === null) notFound();

  const [etape, pasi] = await Promise.all([
    etapeleSablonului(tenant.organizationId, sablon.id),
    pasiiSablonului(tenant.organizationId, sablon.id),
  ]);

  // Editarea cere `all` pe amândouă: `checklist_salveaza_sablon` inserează ȘI
  // actualizează, iar politicile din 0014 cer scope `all` pentru fiecare.
  const poateEditare =
    can(permisiuni, "checklists:update", "all") && can(permisiuni, "checklists:create", "all");

  const antet = (
    <div className="space-y-1">
      <p className="text-muted-foreground text-corp">
        <Link href="/onboarding/sabloane" className="underline-offset-2 hover:underline">
          Șabloane
        </Link>
      </p>
      <AntetPagina
        titlu={sablon.denumire}
        descriere={`${ETICHETE_TIP[sablon.tip]} · Valabil de la ${formatDate(sablon.valabil_de_la)}${
          sablon.valabil_pana_la === null ? "" : ` până la ${formatDate(sablon.valabil_pana_la)}`
        } · ${sablon.activ ? "Activ" : "Dezactivat"} · ${String(pasi.length)} pași`}
        // Pasul firesc după ce vezi (sau tocmai ai creat) un șablon: pornești
        // o instanță din el. Poarta e a paginii-țintă (`checklists:create` all).
        actiuni={
          <span className="flex flex-wrap items-center gap-3">
            {/* Sensul invers: de pe șablon la parcursurile pornite din el. */}
            <Link
              href={`/onboarding?sablon=${sablon.id}`}
              className="text-nota underline-offset-2 hover:underline"
            >
              Parcursurile pornite din el
            </Link>
            {sablon.activ && can(permisiuni, "checklists:create", "all") ? (
              <Link
                href={`/onboarding/noua?sablon=${sablon.id}`}
                className={buton({ varianta: "primar" })}
              >
                Pornește o instanță
              </Link>
            ) : null}
          </span>
        }
      />
    </div>
  );

  if (!poateEditare) {
    // Fără drept de editare, șablonul se CITEȘTE. Varianta veche randa oricum
    // lista cu butoane inerte; un control care nu poate reuși e mai rău decât
    // absența lui. Cursul, materialul și responsabilul se NUMESC (și se
    // leagă, prin poarta țintei), nu doar „Curs de parcurs".
    const optiuniCitire = await optiuniAsistent(tenant.organizationId);
    const numeCurs = new Map(optiuniCitire.cursuri.map((c) => [c.id, c.denumire]));
    const numeMaterial = new Map(optiuniCitire.materiale.map((m) => [m.id, m.denumire]));
    const numeAngajat = new Map(optiuniCitire.angajati.map((a) => [a.id, a.nume]));
    const leagaCurs = poateDeschide("/cursuri/[id]", contextPorti);
    const leagaMaterial = poateDeschide("/cursuri/biblioteca/[id]", contextPorti);
    const leagaFisa = poateDeschide("/angajati/[id]", contextPorti);
    const legatura = (href: string, text: string, poate: boolean) =>
      poate ? (
        <Link href={href} className="underline-offset-2 hover:underline">
          {text}
        </Link>
      ) : (
        <span>{text}</span>
      );
    return (
      <div className={`${LATIMI.detaliu} space-y-6`}>
        {antet}
        <ol className="space-y-2">
          {pasi.map((p) => {
            const etapa = etape.find((e) => e.id === p.etapa_id);
            return (
              <li key={p.id} className="border-border rounded-panou border p-3">
                <p className="font-medium">
                  {p.titlu}
                  {p.obligatoriu ? (
                    <span className="text-muted-foreground text-nota ml-1">(obligatoriu)</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-nota mt-1 flex flex-wrap items-center gap-2">
                  {etapa === undefined ? null : <Badge ton="neutru">{etapa.titlu}</Badge>}
                  <span>{ETICHETE_FEL_PAS[p.fel]}</span>
                  <span>·</span>
                  <span>
                    {ETICHETE_RESPONSABIL_TIP[p.responsabil_tip]}
                    {p.responsabil_tip === "rol" && p.responsabil_rol !== null
                      ? `: ${ETICHETE_ROL[p.responsabil_rol]}`
                      : ""}
                    {p.responsabil_employee_id !== null ? (
                      <>
                        {": "}
                        {legatura(
                          `/angajati/${p.responsabil_employee_id}`,
                          numeAngajat.get(p.responsabil_employee_id) ?? "un angajat anume",
                          leagaFisa && numeAngajat.has(p.responsabil_employee_id),
                        )}
                      </>
                    ) : null}
                  </span>
                  {p.curs_id === null ? null : (
                    <>
                      <span>·</span>
                      <span>
                        Curs:{" "}
                        {legatura(
                          `/cursuri/${p.curs_id}`,
                          numeCurs.get(p.curs_id) ?? "curs nevizibil",
                          leagaCurs && numeCurs.has(p.curs_id),
                        )}
                      </span>
                    </>
                  )}
                  {p.material_id === null ? null : (
                    <>
                      <span>·</span>
                      <span>
                        Material:{" "}
                        {legatura(
                          `/cursuri/biblioteca/${p.material_id}`,
                          numeMaterial.get(p.material_id) ?? "material nevizibil",
                          leagaMaterial && numeMaterial.has(p.material_id),
                        )}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span>{p.termen_zile_relativ} zile</span>
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const optiuni = await optiuniAsistent(tenant.organizationId);

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      {antet}
      {/* Același asistent ca la creare, cu salt liber între etape: cine intră
          să schimbe un termen n-are de ce să reparcurgă tot. */}
      <AsistentSablon
        departamente={optiuni.departamente}
        cursuri={optiuni.cursuri}
        materiale={optiuni.materiale}
        angajati={optiuni.angajati}
        astazi={sablon.valabil_de_la}
        initial={stareDinSablon(sablon, etape, pasi)}
      />
    </div>
  );
}
