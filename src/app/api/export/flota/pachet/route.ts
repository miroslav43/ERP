// src/app/api/export/flota/pachet/route.ts
//
// Pachetul lunar pentru contabil (F8): un ZIP cu Excelul raportului la rădăcină și
// PDF-ul fiecărei foi de parcurs APROBATE a lunii, în `foi/`. Foile aprobate sunt
// documentele justificative ale combustibilului dedus; Excelul le însumează.
//
// ── PLAFONUL ────────────────────────────────────────────────────────────────
// PDF-urile se generează în cererea HTTP (~190 ms fiecare), deci numărul lor are
// un plafon (`PLAFON_FOI_PACHET`). Se numără ÎNAINTE de orice citire întreagă: o
// lună peste plafon primește 413 cu îndemnul de a alege un vehicul, nu un fișier
// tăiat la mijloc și nu o cerere care moare la 100 s pe Cloudflare.
//
// ── DE CE EXCELUL VINE DIN ACEEAȘI CITIRE CA PDF-URILE ──────────────────────
// `incarcaPachetLunar` calculează raportul pe EXACT foile din arhivă: o a doua
// citire ar fi putut prinde între timp o aprobare, iar lista din Excel n-ar mai
// fi fost cea din `foi/`.
import { formatDateTime } from "@/lib/format/date";
import { documentRaportFlota } from "@/lib/excel/raport-flota";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { pachetLunarFlota } from "@/lib/pdf/pachet-flota";
import { intervalLuna } from "@/domain/fleet/rapoarte";
import {
  incarcaPachetLunar,
  numarFoiAprobateLuna,
  PLAFON_FOI_PACHET,
} from "@/lib/queries/fleet-rapoarte";
import { createServerSupabase } from "@/lib/supabase/server";
import { curataDocument, numeFisierSigur } from "@/lib/unelte/document-tabelar";
import { ANTET_CACHE_DESCARCARE } from "@/lib/unelte/raspuns";
import { randeazaXlsx } from "@/lib/unelte/xlsx";

import { autorizeazaExport, raspunsText } from "../cerere";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(cerere: Request): Promise<Response> {
  const autorizat = await autorizeazaExport(cerere);
  if (autorizat instanceof Response) return autorizat;
  const { tenant, luna, vehicul, vehiculNr } = autorizat;

  const numar = await numarFoiAprobateLuna(tenant.organizationId, intervalLuna(luna), vehicul);
  if (numar === 0) {
    return raspunsText(
      "Luna aleasă nu are nicio foaie aprobată. Excelul raportului se poate descărca și singur.",
      404,
    );
  }
  if (numar > PLAFON_FOI_PACHET) {
    return raspunsText(
      `Luna are ${String(numar)} de foi aprobate, iar un pachet cuprinde cel mult ${String(PLAFON_FOI_PACHET)}. ` +
        "Alegeți un vehicul și descărcați pachetul pe fiecare mașină.",
      413,
    );
  }

  const pachet = await incarcaPachetLunar(tenant.organizationId, luna, vehicul);
  const generatLa = formatDateTime(new Date().toISOString());
  const document = documentRaportFlota({
    organizatie: tenant.legalName ?? tenant.name,
    raport: pachet.raport,
    vehicul: vehiculNr,
    generatLa,
  });
  const nume = numeFisierSigur(document.numeFisier);

  const db = await createServerSupabase();
  const octeti = await pachetLunarFlota({
    organizatie: await antetOrganizatie(db, tenant.organizationId, tenant.name),
    foi: pachet.foi,
    vehicule: pachet.vehicule,
    soferi: pachet.soferi,
    aprobatori: pachet.aprobatori,
    xlsx: { nume: `${nume}.xlsx`, octeti: await randeazaXlsx(curataDocument(document)) },
    generatLa,
  });

  return new Response(new Uint8Array(octeti), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${numeFisierSigur(`pachet-flota-${luna}${vehiculNr === null ? "" : `-${vehiculNr}`}`)}.zip"`,
      "cache-control": ANTET_CACHE_DESCARCARE,
    },
  });
}
