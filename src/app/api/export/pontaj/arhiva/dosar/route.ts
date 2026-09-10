// src/app/api/export/pontaj/arhiva/dosar/route.ts
//
// Dosarul de pontaj pe un interval de luni, ca un singur XLSX: o filă de
// cuprins plus câte o filă pe lună.
//
// ── DE CE UN SINGUR FIȘIER, ȘI NU ȘAIZECI ───────────────────────────────────
// Cinci ani înseamnă șaizeci de luni. Un control care cere „pontajul pe ultimii
// ani" primește altfel șaizeci de descărcări și tot atâtea fișiere de pus în
// ordine. Cuprinsul din prima filă e lista pe care o parcurge inspectorul: ce
// luni sunt acoperite, cu ce număr de înregistrare, cu ce amprentă.
//
// ── DE CE INTERVALUL E MĂRGINIT ─────────────────────────────────────────────
// `MAX_LUNI_DOSAR` = 60, adică exact fereastra de păstrare. Fără plafon, un
// `de_la=1900-01` ar cere bazei toate arhivele firmei și ar construi un registru
// de lucru pe care nu-l deschide nimeni. Tăierea se face pe citire, nu aici.
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { arhivePontajInInterval } from "@/lib/queries/pontaj-arhiva";
import { etichetaLuna, registruDosar, TIP_XLSX } from "@/lib/excel/foaie-colectiva";
import { formatDateTime } from "@/lib/format/date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** „2026-08" → `{ an: 2026, luna: 8 }`, sau `null` dacă nu e forma asta. */
function citesteLuna(brut: string | null): { readonly an: number; readonly luna: number } | null {
  if (brut === null) return null;
  const potrivire = /^(\d{4})-(\d{2})$/.exec(brut);
  if (potrivire === null) return null;
  const an = Number(potrivire[1]);
  const luna = Number(potrivire[2]);
  if (luna < 1 || luna > 12 || an < 2000 || an > 2100) return null;
  return { an, luna };
}

export async function GET(cerere: Request): Promise<Response> {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "attendance:export", "all")) {
    return raspunsText("Nu aveți dreptul de a exporta pontajul arhivat.", 403);
  }

  const parametri = new URL(cerere.url).searchParams;
  const deLa = citesteLuna(parametri.get("de_la"));
  const panaLa = citesteLuna(parametri.get("pana_la"));
  if (deLa === null || panaLa === null) {
    return raspunsText("Intervalul se dă ca `de_la=2022-01&pana_la=2026-08`.", 400);
  }
  if (deLa.an * 12 + deLa.luna > panaLa.an * 12 + panaLa.luna) {
    return raspunsText("Luna de început e după cea de sfârșit.", 400);
  }

  const arhive = await arhivePontajInInterval(tenant.organizationId, deLa, panaLa);
  if (arhive.length === 0) {
    return raspunsText("Nu există nicio lună arhivată în intervalul ales.", 404);
  }

  const octeti = await registruDosar(
    arhive.map((a) => ({
      continut: a.continut,
      an: a.an,
      luna: a.luna,
      numarAngajati: a.numar_angajati,
      totalOre: a.total_ore,
      antet: {
        numarAfisat: a.numarAfisat,
        checksum: a.checksum,
        generatLa: formatDateTime(a.generat_la),
        versiune: a.versiune,
        faraBlocare: a.status_perioada !== "blocata",
      },
    })),
  );

  const nume = `dosar-pontaj-${etichetaLuna(deLa.an, deLa.luna)}-${etichetaLuna(panaLa.an, panaLa.luna)}.xlsx`;

  return new Response(octeti, {
    headers: {
      "content-type": TIP_XLSX,
      "content-disposition": `attachment; filename="${nume}"`,
      "cache-control": "no-store",
    },
  });
}
