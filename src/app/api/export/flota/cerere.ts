// src/app/api/export/flota/cerere.ts
//
// Citirea și autorizarea cererii de export al flotei (F8), comună Excelului și
// pachetului lunar. Nu e o rută: Next ignoră orice fișier din `app/` care nu se
// numește `route.ts` sau `page.tsx`.
//
// ── POARTA ──────────────────────────────────────────────────────────────────
// `vehicles:export` la `all` PLUS drepturile pe toată flota (`poateExportaFlota`).
// Fără a doua condiție, un rol cu cheia de export dar cu foile tăiate la `team`
// ar descărca un fișier cu cifre parțiale, fără nicio eroare. Organizația vine
// din tenant, niciodată din parametrii cererii; luna e obligatorie și validată
// (`max_rows` taie tăcut un răspuns fără filtru de lună).
import { z } from "zod";

import { lunaValida } from "@/domain/fleet/rapoarte";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { vehiculeDupaId } from "@/lib/queries/fleet";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import type { Tenant } from "@/lib/tenant/types";

import { poateExportaFlota } from "@/app/(app)/flota/rapoarte/acces";

export const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export interface CerereAutorizata {
  readonly tenant: Tenant;
  readonly luna: string;
  /** `null` = toată flota. */
  readonly vehicul: string | null;
  /** Numărul vehiculului ales, pentru titlu și numele fișierului. */
  readonly vehiculNr: string | null;
}

/**
 * Cererea autorizată sau răspunsul care o oprește (403, 400, 404). Apelantul
 * verifică `instanceof Response` și îl întoarce ca atare.
 */
export async function autorizeazaExport(cerere: Request): Promise<CerereAutorizata | Response> {
  // `resolveTenant`, nu `requireTenant`: o descărcare răspunde cu un cod de stare,
  // nu cu o redirecționare spre pagina de autentificare (cum fac și exporturile
  // de mentenanță și de salarizare).
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return raspunsText("Trebuie să vă autentificați.", 401);
  }
  if (rezolvare.status !== "ok") return raspunsText("Alegeți mai întâi o organizație.", 403);
  const { tenant } = rezolvare;
  if (!(await getEnabledFeatures(tenant.organizationId)).has("fleet")) {
    return raspunsText("Modulul Parc auto nu este activ pentru organizație.", 404);
  }
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  if (!poateExportaFlota(permisiuni)) {
    return raspunsText(
      "Nu aveți dreptul de a exporta datele flotei. Exportul îl poate face administratorul organizației.",
      403,
    );
  }

  const parametri = new URL(cerere.url).searchParams;
  const luna = parametri.get("luna");
  if (!lunaValida(luna)) {
    return raspunsText("Luna se dă în forma `luna=2026-09`, între 2000 și 2199.", 400);
  }
  const vehiculBrut = parametri.get("vehicul");
  let vehicul: string | null = null;
  if (vehiculBrut !== null && vehiculBrut !== "") {
    if (!z.uuid().safeParse(vehiculBrut).success) {
      return raspunsText("Vehiculul se dă prin identificatorul lui, `vehicul=<uuid>`.", 400);
    }
    vehicul = vehiculBrut;
  }

  if (vehicul === null) return { tenant, luna, vehicul, vehiculNr: null };
  const gasit = (await vehiculeDupaId(tenant.organizationId, [vehicul])).get(vehicul);
  if (gasit === undefined) {
    return raspunsText("Vehiculul ales nu există sau nu vă este accesibil.", 404);
  }
  return { tenant, luna, vehicul, vehiculNr: gasit.nr_inmatriculare };
}
