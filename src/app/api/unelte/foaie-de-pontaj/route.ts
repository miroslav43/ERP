import type { NextRequest } from "next/server";

import { documenteleFoii } from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie-document";
import { registruPontaj } from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie-xlsx";
import {
  construiestePontaj,
  numeFisierPontaj,
  parametriPontaj,
} from "@/app/(marketing)/unelte/foaie-de-pontaj/pontaj";
import { EroareIntrare, type Format } from "@/lib/unelte/document-tabelar";
import { raspunsBinar, raspunsDocumente } from "@/lib/unelte/raspuns";
import { cuNumarare } from "@/lib/unelte/umami-server";

/**
 * Descărcarea foii de pontaj gratuite: colectivă sau câte o fișă pe om, în
 * Excel cu formule, PDF sau Word.
 *
 * ── DE CE E RUTĂ DE API, NU SERVER ACTION ─────────────────────────────────
 * Rezultatul e un FIȘIER, iar o Server Action întoarce date, nu un răspuns cu
 * antete proprii. Ca rută, exportul e un `<form>` GET: merge fără JavaScript și
 * se poate pune la favorite, exact ca pagina care îl generează.
 *
 * ── DE CE NU CERE SESIUNE ─────────────────────────────────────────────────
 * E o unealtă publică. `src/proxy.ts` lasă `/api/` să treacă neatins, cu nota
 * că rutele „își verifică singure sesiunea” — asta decide că n-are nevoie de
 * una: nu citește și nu scrie nimic din baza de date. Intrările sunt parametri
 * din adresă, normalizați și mărginiți în `pontaj.ts` și `foaie.ts` (cel mult
 * 60 de oameni, 31 de zile, antet de 120/14/60 de caractere). Fără limitare de
 * rată: nu există nimic de epuizat în afară de CPU, iar generarea e mărginită
 * prin construcție.
 */

export const dynamic = "force-dynamic";

/**
 * `?format=pdf|docx` trece prin randările comune. Excel rămâne implicitul aici,
 * nu PDF-ul ca în restul uneltelor: linkurile vechi, fără `format`, trebuie să
 * dea tot fișierul cu formule pe care îl dădeau.
 */
function normalizeazaFormatFoaie(brut: string | null): Format {
  // Ca la B8: „DOCX” sau „ docx ” înseamnă tot Word.
  const format = brut?.trim().toLowerCase();
  return format === "pdf" || format === "docx" ? format : "xlsx";
}

async function genereaza(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  try {
    const pontaj = construiestePontaj(parametriPontaj(q));
    const format = normalizeazaFormatFoaie(q.get("format"));
    const nume = numeFisierPontaj(pontaj);
    if (format === "xlsx") return raspunsBinar(await registruPontaj(pontaj), "xlsx", nume);
    const documente = documenteleFoii(pontaj).map((d) => ({
      ...d,
      sursa: "/unelte/foaie-de-pontaj",
    }));
    return await raspunsDocumente(documente, format, nume);
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
