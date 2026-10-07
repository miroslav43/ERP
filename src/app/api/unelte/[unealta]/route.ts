import type { NextRequest } from "next/server";

import { EroareIntrare, normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { constructorPentru } from "@/lib/unelte/registru";
import { raspunsDocument } from "@/lib/unelte/raspuns";

/**
 * Descărcarea uneltelor gratuite: `/api/unelte/<slug>?format=pdf|docx|xlsx&…`.
 *
 * Fără sesiune și fără bază, din același motiv ca ruta foii de pontaj: intrările
 * sunt parametri normalizați cu limite, iar generarea e mărginită prin
 * construcție. `src/proxy.ts` lasă `/api/` să treacă neatins.
 */
export const dynamic = "force-dynamic";

export async function GET(
  cerere: NextRequest,
  { params }: { params: Promise<{ unealta: string }> },
): Promise<Response> {
  const { unealta } = await params;
  const construieste = constructorPentru(unealta);
  if (construieste === undefined) return new Response("Unealtă necunoscută.", { status: 404 });
  const q = cerere.nextUrl.searchParams;
  try {
    return await raspunsDocument(
      { ...construieste(q), sursa: `/unelte/${unealta}` },
      normalizeazaFormat(q.get("format")),
    );
  } catch (eroare) {
    if (eroare instanceof EroareIntrare) return new Response(eroare.message, { status: 400 });
    throw eroare;
  }
}
