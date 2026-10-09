import type { NextRequest } from "next/server";

import { EroareIntrare, normalizeazaFormat, type Format } from "@/lib/unelte/document-tabelar";
import { constructorPentru, formatePentru } from "@/lib/unelte/registru";
import { raspunsDocument } from "@/lib/unelte/raspuns";

/**
 * Descărcarea uneltelor gratuite: `/api/unelte/<slug>?format=pdf|docx|xlsx&…`.
 *
 * Fără sesiune și fără bază, din același motiv ca ruta foii de pontaj: intrările
 * sunt parametri normalizați cu limite, iar generarea e mărginită prin
 * construcție. `src/proxy.ts` lasă `/api/` să treacă neatins.
 */
export const dynamic = "force-dynamic";

const NUME_FORMAT: Readonly<Record<Format, string>> = { pdf: "PDF", docx: "Word", xlsx: "Excel" };

export async function GET(
  cerere: NextRequest,
  { params }: { params: Promise<{ unealta: string }> },
): Promise<Response> {
  const { unealta } = await params;
  const construieste = constructorPentru(unealta);
  if (construieste === undefined) return new Response("Unealtă necunoscută.", { status: 404 });
  const q = cerere.nextUrl.searchParams;
  const format = normalizeazaFormat(q.get("format"));
  const permise = formatePentru(unealta);
  if (!permise.includes(format)) {
    return new Response(
      `Unealta asta se descarcă doar în ${permise.map((f) => NUME_FORMAT[f]).join(" sau ")}.`,
      { status: 400 },
    );
  }
  try {
    return await raspunsDocument({ ...construieste(q), sursa: `/unelte/${unealta}` }, format);
  } catch (eroare) {
    if (eroare instanceof EroareIntrare) return new Response(eroare.message, { status: 400 });
    throw eroare;
  }
}
