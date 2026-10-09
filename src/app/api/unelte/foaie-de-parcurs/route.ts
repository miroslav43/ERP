import type { NextRequest } from "next/server";

import { randeazaFoaieParcursXlsx } from "@/app/(marketing)/unelte/foaie-de-parcurs/excel";
import {
  construiesteFoaieParcurs,
  parametriFoaieParcurs,
} from "@/app/(marketing)/unelte/foaie-de-parcurs/model";
import { normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { raspunsBinar, raspunsDocument } from "@/lib/unelte/raspuns";

/**
 * Descărcarea foii de parcurs: `/api/unelte/foaie-de-parcurs?format=pdf|docx|xlsx&…`.
 *
 * Rută statică, ca foaia de pontaj, fiindcă Excel-ul are randarea lui, cu
 * formule (`excel.ts`); PDF-ul și Word-ul trec prin modelul comun. Ruta statică
 * are prioritate față de `[unealta]`, deci adresa rămâne aceeași ca până acum.
 *
 * Fără sesiune și fără bază: intrările sunt parametri normalizați cu limite în
 * `model.ts`, iar generarea e mărginită prin construcție (cel mult 31 × 4 curse).
 * Implicitul rămâne PDF, ca înainte: linkurile vechi fără `format` dau același
 * tip de fișier.
 */
export const dynamic = "force-dynamic";

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  const p = parametriFoaieParcurs(q);
  const d = { ...construiesteFoaieParcurs(p), sursa: "/unelte/foaie-de-parcurs" };
  const format = normalizeazaFormat(q.get("format"));
  if (format !== "xlsx") return raspunsDocument(d, format);
  return raspunsBinar(await randeazaFoaieParcursXlsx(p, d), "xlsx", d.numeFisier);
}
