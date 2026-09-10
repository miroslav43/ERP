// src/app/api/export/pontaj/arhiva/route.ts
//
// Foaia colectivă de prezență a unei luni arhivate, ca XLSX.
//
// ── DE CE RUTĂ DE API, NU SERVER ACTION ─────────────────────────────────────
// Rezultatul e un FIȘIER, iar o Server Action întoarce date, nu un răspuns cu
// antete proprii. Aici sunt necesare și `content-type`, și
// `content-disposition`. Ca rută, descărcarea e și un simplu `<a href>`: merge
// fără JavaScript, exact ca celelalte exporturi ale proiectului.
//
// ── POARTA ──────────────────────────────────────────────────────────────────
// `attendance:export` la scope `all`, adică `org_admin` și `hr`. Aceeași cheie
// pe care o cere politica `pontaj_arhive_lunare_select` din 0134 — verificarea
// de aici nu ține loc de RLS, o dublează ca să dea 403 în loc de 404.
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { arhivaPontajDupaId } from "@/lib/queries/pontaj-arhiva";
import { numeFisierArhiva, registruLunar, TIP_XLSX } from "@/lib/excel/foaie-colectiva";
import { formatDateTime } from "@/lib/format/date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(cerere: Request): Promise<Response> {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:export", "all")) {
    return raspunsText("Nu aveți dreptul de a exporta pontajul arhivat.", 403);
  }

  const id = new URL(cerere.url).searchParams.get("id");
  if (id === null) return raspunsText("Lipsește identificatorul arhivei.", 400);

  const arhiva = await arhivaPontajDupaId(tenant.organizationId, id);
  if (arhiva === null) {
    return raspunsText("Arhiva nu există sau nu vă este accesibilă.", 404);
  }

  const octeti = await registruLunar(arhiva.continut, {
    numarAfisat: arhiva.numarAfisat,
    checksum: arhiva.checksum,
    generatLa: formatDateTime(arhiva.generat_la),
    versiune: arhiva.versiune,
    faraBlocare: arhiva.status_perioada !== "blocata",
  });

  return new Response(octeti, {
    headers: {
      "content-type": TIP_XLSX,
      "content-disposition": `attachment; filename="${numeFisierArhiva(arhiva.an, arhiva.luna)}"`,
      "cache-control": "no-store",
    },
  });
}
