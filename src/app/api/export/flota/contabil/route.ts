// src/app/api/export/flota/contabil/route.ts
//
// Exportul costurilor flotei pentru programul de contabilitate (F12g): jurnalul
// de verificat, articolele contabile simple (CSV), notele WinMentor (ZIP) sau
// fișierele Saga C (ZIP), pentru o lună. Formatele de import sunt verificate pe
// documentația producătorilor, NEÎNCERCATE într-un import real (decizia B4).
//
// ── POARTA (L15) ────────────────────────────────────────────────────────────
// `vehicles:export` la `all` ȘI `vehicles:read` + `trip_sheets:read` la `all`.
// Citirea trece prin RLS: un rol cu `team` ar primi doar o parte din lună, fără
// eroare — o notă incompletă care arată completă. Refuzul explicit e singura
// variantă onestă. Clientul admin NU se folosește.
//
// ── CE NU FACE ──────────────────────────────────────────────────────────────
// Nu scrie nimic în bază: nici audit, nici număr de registru (L16), nici setări
// (L1). O configurare invalidă dă 400 cu motivele, nu revine la implicite (L17).
// O problemă blocantă (o cotă de TVA necunoscută) dă 409 și nicio descărcare,
// ca poarta de echilibru a notei de salarii.
import JSZip from "jszip";

import { poateVedeaRapoarte } from "@/app/(app)/flota/rapoarte/acces";
import { construiesteArticole } from "@/domain/fleet/contabil/articole";
import { iesireExport } from "@/domain/fleet/contabil/fisiere";
import { intervalLuna } from "@/domain/fleet/rapoarte";
import { getEnabledFeatures } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { todayInBucharest } from "@/lib/format/date";
import { firmaPentruExport, liniiDeCostPeLuna } from "@/lib/queries/fleet-contabil";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { ANTET_CACHE_DESCARCARE } from "@/lib/unelte/raspuns";
import {
  configurareDinCerere,
  motiveZod,
  optiuniCsvDinCerere,
  schemaExportLa,
} from "@/schemas/fleet-contabil";

import { raspunsText } from "../cerere";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(cerere: Request): Promise<Response> {
  // `resolveTenant`, nu `requireTenant`: o descărcare răspunde cu un cod de stare,
  // nu cu o redirecționare (ca exporturile F8 din `../cerere.ts`).
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
  if (!can(permisiuni, "vehicles:export", "all")) {
    return raspunsText(
      "Nu aveți dreptul de a exporta datele flotei. Exportul îl poate face administratorul organizației.",
      403,
    );
  }
  if (!poateVedeaRapoarte(permisiuni)) {
    return raspunsText(
      "Exportul contabil cere acces la tot parcul și la toate foile: cu acces doar la echipă, nota ar ieși incompletă fără să se vadă.",
      403,
    );
  }

  const azi = todayInBucharest();
  const parsat = schemaExportLa(azi).safeParse(
    Object.fromEntries(new URL(cerere.url).searchParams),
  );
  if (!parsat.success) {
    return raspunsText(`Exportul nu a pornit:\n${motiveZod(parsat.error)}`, 400);
  }
  const parametri = parsat.data;
  const configurare = configurareDinCerere(parametri);

  const [firma, linii] = await Promise.all([
    firmaPentruExport(tenant.organizationId),
    liniiDeCostPeLuna(tenant.organizationId, parametri.luna),
  ]);
  if (linii.length === 0) {
    return raspunsText("Nicio cheltuială a flotei în luna aleasă.", 404);
  }

  const rezultat = construiesteArticole(linii, configurare, firma);
  if (rezultat.probleme.length > 0) {
    const motive = rezultat.probleme.map((p) => `· ${p.detalii}`).join("\n");
    return raspunsText(
      `Exportul nu a fost generat: ${String(rezultat.probleme.length)} ${rezultat.probleme.length === 1 ? "document are" : "documente au"} o problemă care nu se poate rezolva automat.\n\n${motive}`,
      409,
    );
  }

  const { deLa, panaLa } = intervalLuna(parametri.luna);
  const iesire = iesireExport(parametri.format, rezultat, {
    luna: parametri.luna,
    deLa,
    panaLa,
    azi,
    configurare,
    firma,
    csv: optiuniCsvDinCerere(parametri),
    partenerDupaCui: parametri.wm_partener_dupa_cui === "da",
  });

  if (iesire.fel === "csv") {
    return new Response(iesire.continut, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${iesire.nume}"`,
        "cache-control": ANTET_CACHE_DESCARCARE,
      },
    });
  }

  const zip = new JSZip();
  for (const f of iesire.fisiere) zip.file(f.nume, f.continut);
  const octeti = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return new Response(new Uint8Array(octeti), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${iesire.nume}"`,
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
  });
}
