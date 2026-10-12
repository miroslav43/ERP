// src/app/api/export/mentenanta/verificari/route.ts
//
// „Dosarul de control” (M7): autorizațiile ISCIR CURENTE și planurile active de
// tip `verificare_legala`, într-un singur CSV, pentru un control ITM, ISCIR sau
// ISU. Rândurile înlocuite prin reînnoire nu intră — sunt istoric. Temeiurile
// marcate ⚠ sunt de confirmat cu juristul sau RSVTI (NOTES.md §3).
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures } from "@/lib/auth/features";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";
import { autorizatiiIscir, echipamenteDupaId, planuriScadente } from "@/lib/queries/maintenance";
import {
  ETICHETE_REGIM_ISCIR,
  ETICHETE_STARE_AUTORIZATIE,
  avertismentMaximLegal,
  etichetaTipIscir,
  stareAutorizatie,
} from "@/domain/maintenance/iscir";
import { categorieLegala } from "@/domain/maintenance/legal";
import { stareScadentaData } from "@/domain/maintenance/scadente";
import { ETICHETE_STARE_SCADENTA } from "@/app/(app)/mentenanta/etichete";

export const dynamic = "force-dynamic";

const ANTET: readonly string[] = [
  "Echipament",
  "Ce",
  "Categorie / tip",
  "Temei",
  "Număr / regim",
  "Emisă / ultima execuție",
  "Valabilă până la",
  "Următoarea verificare",
  "Stare",
  "Observații",
];

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** Excel interpretă „=", „+", „-", „@" ca formule: le prefixăm cu apostrof. */
const celula = (valoare: string): string => {
  const curat = valoare.replace(/\r?\n/g, " ");
  const protejat = /^[=+\-@\t]/.test(curat) ? `'${curat}` : curat;
  return `"${protejat.replace(/"/g, '""')}"`;
};

export async function GET(request: Request): Promise<Response> {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return raspunsText("Trebuie să vă autentificați.", 401);
  }
  if (rezolvare.status !== "ok") return raspunsText("Alegeți mai întâi o organizație.", 403);
  const { tenant } = rezolvare;
  const [permisiuni, features] = await Promise.all([
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);
  if (!features.has("maintenance")) {
    return raspunsText("Modulul de mentenanță nu este activ pentru organizație.", 403);
  }
  if (!can(permisiuni, "maintenance:export", "team")) {
    return raspunsText("Nu aveți dreptul de a exporta verificările legale.", 403);
  }

  // Organizația vine din tenant, nu din cerere; RLS restrânge oricum rândurile.
  const azi = todayInBucharest();
  const [autorizatii, planuri] = await Promise.all([
    autorizatiiIscir(tenant.organizationId),
    planuriScadente(tenant.organizationId),
  ]);
  const verificari = planuri.randuri.filter((p) => p.tip === "verificare_legala");
  const echipamente = await echipamenteDupaId(tenant.organizationId, [
    ...autorizatii.map((a) => a.equipment_id),
    ...verificari.map((p) => p.equipment_id),
  ]);
  const numeEchipament = (id: string): string => {
    const e = echipamente.get(id);
    return e === undefined ? "Echipament indisponibil" : `${e.cod} — ${e.denumire}`;
  };

  const liniiAutorizatii = autorizatii.map((a) => {
    const stare = stareAutorizatie(a, azi);
    const observatii = [
      a.suspendata_la === null
        ? null
        : `Suspendată la ${a.suspendata_la}${a.motiv_suspendare === null ? "" : `: ${a.motiv_suspendare}`}`,
      avertismentMaximLegal(a),
      a.conditii === null ? null : `Condiții: ${a.conditii}`,
    ].filter((v): v is string => v !== null);
    return [
      numeEchipament(a.equipment_id),
      "Autorizație ISCIR",
      etichetaTipIscir(a.tip),
      a.emitent,
      a.numar ?? ETICHETE_REGIM_ISCIR[a.regim],
      a.emis_la ?? "",
      a.valabil_pana,
      a.scadenta_verificare_tehnica ?? "",
      ETICHETE_STARE_AUTORIZATIE[stare],
      observatii.join(" · "),
    ];
  });

  const liniiPlanuri = verificari.map((p) => {
    const categorie = categorieLegala(p.categorie_legala);
    const stare = stareScadentaData(p.urmatoarea_scadenta, azi);
    return [
      numeEchipament(p.equipment_id),
      `Verificare legală: ${p.denumire}`,
      categorie?.eticheta ?? "",
      p.temei_legal ?? (categorie === null ? "" : categorie.temei),
      "",
      p.ultima_executie ?? "",
      "",
      p.urmatoarea_scadenta ?? "",
      ETICHETE_STARE_SCADENTA[stare],
      p.amanat_pana === null ? "" : `Amânată până la ${p.amanat_pana}`,
    ];
  });

  const continut = [
    ANTET.map(celula).join(";"),
    ...[...liniiAutorizatii, ...liniiPlanuri].map((l) => l.map(celula).join(";")),
  ].join("\r\n");
  const numeFisier = `dosar-control-verificari-${azi}.csv`;

  // Exportul e un eveniment auditabil, ca exportul de echipamente.
  const client = await createServerSupabase();
  const { error } = await client.rpc("log_audit_event", {
    p_action: "export",
    p_status: "success",
    p_organization_id: tenant.organizationId,
    p_entity_type: "iscir_authorization",
    p_after: {
      autorizatii: liniiAutorizatii.length,
      verificari_legale: liniiPlanuri.length,
      planuri_trunchiate: planuri.trunchiat,
    },
    p_user_agent: request.headers.get("user-agent"),
  });
  if (error !== null) {
    console.error("[mentenanță] nu am putut înregistra exportul dosarului de control", error);
  }

  return new Response(`﻿${continut}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${numeFisier}"`,
      "cache-control": "no-store",
    },
  });
}
