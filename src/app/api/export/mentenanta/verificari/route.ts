// src/app/api/export/mentenanta/verificari/route.ts
//
// „Dosarul de control” (M7): autorizațiile ISCIR CURENTE și planurile active de
// tip `verificare_legala`, pentru un control ITM, ISCIR sau ISU — CSV implicit,
// PDF cu `?format=pdf`. Rândurile înlocuite prin reînnoire nu intră — sunt
// istoric. Temeiurile marcate ⚠ sunt de confirmat cu juristul sau RSVTI
// (NOTES.md §3). Liniile le compune `liniiDosarControl`, o singură dată pentru
// ambele formate.
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures } from "@/lib/auth/features";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime, todayInBucharest } from "@/lib/format/date";
import { autorizatiiIscir, echipamenteDupaId, planuriScadente } from "@/lib/queries/maintenance";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { numeFisier } from "@/lib/pdf/document";
import { genereazaDosarControl } from "@/lib/pdf/dosar-control";
import { textNumarat } from "@/app/(app)/mentenanta/etichete";
import {
  ANTET_DOSAR_CONTROL,
  coloaneLinie,
  liniiDosarControl,
} from "@/app/(app)/mentenanta/iscir/dosar-control";

export const dynamic = "force-dynamic";
// Fonturile PDF se citesc de pe disc (`src/lib/pdf/document.ts`).
export const runtime = "nodejs";

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
  const { tenant, user } = rezolvare;
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

  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "csv";

  // Organizația vine din tenant, nu din cerere; RLS restrânge oricum rândurile.
  const azi = todayInBucharest();
  const [autorizatii, planuri] = await Promise.all([
    autorizatiiIscir(tenant.organizationId),
    planuriScadente(tenant.organizationId),
  ]);
  const echipamente = await echipamenteDupaId(tenant.organizationId, [
    ...autorizatii.map((a) => a.equipment_id),
    ...planuri.randuri.filter((p) => p.tip === "verificare_legala").map((p) => p.equipment_id),
  ]);
  const numeEchipament = (id: string): string => {
    const e = echipamente.get(id);
    return e === undefined ? "Echipament indisponibil" : `${e.cod} — ${e.denumire}`;
  };

  const liniiAutorizatii = liniiDosarControl({
    autorizatii,
    planuri: [],
    numeEchipament,
    azi,
  });
  const liniiPlanuri = liniiDosarControl({
    autorizatii: [],
    planuri: planuri.randuri,
    numeEchipament,
    azi,
  });

  // Exportul e un eveniment auditabil, ca exportul de echipamente.
  const client = await createServerSupabase();
  const { error } = await client.rpc("log_audit_event", {
    p_action: "export",
    p_status: "success",
    p_organization_id: tenant.organizationId,
    p_entity_type: "iscir_authorization",
    p_after: {
      format,
      autorizatii: liniiAutorizatii.length,
      verificari_legale: liniiPlanuri.length,
      planuri_trunchiate: planuri.trunchiat,
    },
    p_user_agent: request.headers.get("user-agent"),
  });
  if (error !== null) {
    console.error("[mentenanță] nu am putut înregistra exportul dosarului de control", error);
  }

  if (format === "pdf") {
    const deRezolvat = [...liniiAutorizatii, ...liniiPlanuri].filter((l) => l.rosu).length;
    const pdf = await genereazaDosarControl({
      organizatie: await antetOrganizatie(client, tenant.organizationId, tenant.name),
      azi,
      autorizatii: liniiAutorizatii,
      verificari: liniiPlanuri,
      rezumat: [
        textNumarat(liniiAutorizatii.length, "autorizație ISCIR", "autorizații ISCIR"),
        textNumarat(liniiPlanuri.length, "verificare legală", "verificări legale"),
        `de rezolvat: ${String(deRezolvat)}`,
      ].join(" · "),
      intocmitDe: user.fullName ?? user.email,
      generatLa: formatDateTime(new Date().toISOString()),
    });
    return new Response(pdf as BodyInit, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${numeFisier(`dosar-control-verificari-${azi}`)}.pdf"`,
        "cache-control": "no-store",
      },
    });
  }

  const continut = [
    ANTET_DOSAR_CONTROL.map(celula).join(";"),
    ...[...liniiAutorizatii, ...liniiPlanuri].map((l) => coloaneLinie(l).map(celula).join(";")),
  ].join("\r\n");

  return new Response(`﻿${continut}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="dosar-control-verificari-${azi}.csv"`,
      "cache-control": "no-store",
    },
  });
}
