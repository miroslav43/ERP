import type { NextRequest } from "next/server";

import { registruCondica } from "@/app/(marketing)/unelte/condica-de-prezenta/condica-xlsx";
import {
  condicaDocument,
  parametriCondica,
} from "@/app/(marketing)/unelte/condica-de-prezenta/model";
import { EroareIntrare, normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { raspunsBinar, raspunsDocument } from "@/lib/unelte/raspuns";
import { cuNumarare } from "@/lib/unelte/umami-server";

/**
 * Descărcarea condicii: `/api/unelte/condica-de-prezenta?format=pdf|docx|xlsx&…`.
 *
 * Rută statică, ca a foii de pontaj, și din același motiv: Excelul are
 * generatorul lui, cu formule (`condica-xlsx.ts`), pe care ruta comună
 * `[unealta]` nu-l știe. O rută statică are prioritate față de segmentul
 * dinamic, deci condica a ieșit din `UNELTE`. PDF-ul și Word-ul trec prin
 * randările comune. Fără sesiune și fără bază, ca toate uneltele publice.
 */
export const dynamic = "force-dynamic";

async function genereaza(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  try {
    const p = parametriCondica(q);
    const format = normalizeazaFormat(q.get("format"));
    const d = { ...condicaDocument(p), sursa: "/unelte/condica-de-prezenta" };
    if (format === "xlsx") return raspunsBinar(await registruCondica(p), "xlsx", d.numeFisier);
    return await raspunsDocument(d, format);
  } catch (eroare) {
    if (eroare instanceof EroareIntrare) return new Response(eroare.message, { status: 400 });
    throw eroare;
  }
}

/**
 * Descărcarea se numără pe server, după răspuns și fără IP (`src/lib/unelte/
 * masurare.ts`): Umami din browser nu-l vede pe cine blochează măsurarea.
 */
export const GET = cuNumarare(genereaza);
