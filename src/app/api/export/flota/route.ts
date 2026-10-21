// src/app/api/export/flota/route.ts
//
// Raportul lunar al flotei ca Excel (F8): costul pe vehicul, consumul față de
// normă, kilometrii pe șofer și registrul foilor aprobate. Același fișier intră
// în pachetul lunar pentru contabil (`pachet/route.ts`).
//
// `?luna=AAAA-LL` e obligatoriu; `?vehicul=<uuid>` restrânge la o mașină. Poarta
// și motivele ei sunt în `cerere.ts`. Fișierul se randează prin `xlsxRaportFlota`:
// randarea comună, cu celule numerice și fără subsolul uneltelor publice.
import { documentRaportFlota, xlsxRaportFlota } from "@/lib/excel/raport-flota";
import { formatDateTime } from "@/lib/format/date";
import { incarcaRaportLunar } from "@/lib/queries/fleet-rapoarte";
import { raspunsBinar } from "@/lib/unelte/raspuns";

import { autorizeazaExport } from "./cerere";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(cerere: Request): Promise<Response> {
  const autorizat = await autorizeazaExport(cerere);
  if (autorizat instanceof Response) return autorizat;
  const { tenant, luna, vehicul, vehiculNr } = autorizat;

  const raport = await incarcaRaportLunar(tenant.organizationId, luna, vehicul);
  const document = documentRaportFlota({
    organizatie: tenant.legalName ?? tenant.name,
    raport,
    vehicul: vehiculNr,
    generatLa: formatDateTime(new Date().toISOString()),
  });

  const octeti = await xlsxRaportFlota(document);
  return raspunsBinar(octeti, "xlsx", document.numeFisier);
}
