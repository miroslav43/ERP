import type { NextRequest } from "next/server";

import { randeazaXlsxEvaluare } from "@/app/(marketing)/unelte/fisa-evaluare/excel";
import {
  construiesteFisaEvaluare,
  parametriFisaEvaluare,
} from "@/app/(marketing)/unelte/fisa-evaluare/model";
import { curataDocument, normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { raspunsBinar, raspunsDocument } from "@/lib/unelte/raspuns";

/**
 * Descărcarea fișei de evaluare: `/api/unelte/fisa-evaluare?format=pdf|docx|xlsx&…`.
 *
 * Rută statică, ca foaia de pontaj și condica: are prioritate față de
 * `[unealta]`, iar Excelul ei e un registru cu FORMULE (`excel.ts`), nu foaia
 * de text a randării comune. PDF-ul și Word-ul trec în continuare prin
 * `raspunsDocument`, deci prin aceeași curățare a textului ca restul uneltelor.
 *
 * Fără sesiune și fără bază: intrările sunt parametri normalizați cu limite
 * (`model.ts`: 15 criterii, 120 de caractere, rubrici de 500), iar generarea e
 * mărginită prin construcție. `src/proxy.ts` lasă `/api/` să treacă neatins.
 */
export const dynamic = "force-dynamic";

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  const parametri = parametriFisaEvaluare(q);
  const document = { ...construiesteFisaEvaluare(parametri), sursa: "/unelte/fisa-evaluare" };
  const format = normalizeazaFormat(q.get("format"));
  if (format !== "xlsx") return raspunsDocument(document, format);
  // Textul din document trece prin aceeași curățare ca în `raspunsDocument`;
  // cifrele vin din parametri, deja validate.
  const curat = curataDocument(document);
  return raspunsBinar(await randeazaXlsxEvaluare(curat, parametri), "xlsx", curat.numeFisier);
}
