// src/app/api/export/mentenanta/rapoarte/route.ts
//
// Raportul de mentenanță (M8) ca CSV: un rând pe echipament, pentru perioada din
// adresă (`?de_la=&pana_la=`, aceeași schemă și aceeași normalizare ca pagina
// `/mentenanta/rapoarte`). Cifrele vin din `incarcaRaport`, deci CSV-ul și
// ecranul nu pot diverge. Poarta: `maintenance:export` / team.
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures } from "@/lib/auth/features";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { normalizeazaPerioada } from "@/domain/maintenance/indicatori";
import { filtreRapoarteSchema } from "@/schemas/maintenance";
import { continutCsvRaport } from "@/app/(app)/mentenanta/rapoarte/csv-raport";
import { incarcaRaport } from "@/app/(app)/mentenanta/rapoarte/date-raport";

export const dynamic = "force-dynamic";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

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
    return raspunsText("Nu aveți dreptul de a exporta raportul de mentenanță.", 403);
  }

  const filtre = filtreDinUrl(
    filtreRapoarteSchema,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  const { perioada } = normalizeazaPerioada(filtre.de_la, filtre.pana_la, todayInBucharest());

  // Organizația vine din tenant, nu din cerere; RLS restrânge oricum rândurile.
  const date = await incarcaRaport(tenant.organizationId, perioada);

  // Exportul e un eveniment auditabil, ca exportul de echipamente.
  const client = await createServerSupabase();
  const { error } = await client.rpc("log_audit_event", {
    p_action: "export",
    p_status: "success",
    p_organization_id: tenant.organizationId,
    p_entity_type: "maintenance_report",
    p_after: {
      de_la: perioada.deLa,
      pana_la: perioada.panaLa,
      randuri: date.raport.echipamente.length,
      trunchiat: [...date.trunchiate],
    },
    p_user_agent: request.headers.get("user-agent"),
  });
  if (error !== null) {
    console.error("[mentenanță] nu am putut înregistra exportul raportului", error);
  }

  return new Response(continutCsvRaport(date.raport, date.echipamente), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="raport-mentenanta-${perioada.deLa}-${perioada.panaLa}.csv"`,
      "cache-control": "no-store",
    },
  });
}
