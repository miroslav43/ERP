import type { NextRequest } from "next/server";

import {
  cerereDinParametri,
  PAGINA_CERERE,
} from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-model";
import { EroareIntrare, numeFisierSigur } from "@/lib/unelte/document-tabelar";
import { randeazaScrisoareDocx } from "@/lib/unelte/scrisoare-docx";
import { randeazaScrisoarePdf } from "@/lib/unelte/scrisoare-pdf";

/**
 * Descărcarea cererii de concediu: `/api/unelte/cerere-concediu?format=pdf|docx&…`.
 *
 * ── DE CE RUTĂ PROPRIE ─────────────────────────────────────────────────────
 * Ruta comună `/api/unelte/[unealta]` randează `DocumentTabelar`, adică un
 * formular. Cererea e o scrisoare (`src/lib/unelte/scrisoare.ts`), cu altă
 * randare. Ruta statică are prioritate față de cea dinamică, deci adresa
 * rămâne aceeași. Excel nu mai e servit: o cerere de semnat nu e un tabel, iar
 * pagina nu l-a oferit niciodată.
 *
 * ── ERORILE ────────────────────────────────────────────────────────────────
 * Butoanele „Descarcă” trimit formularul direct aici. O intrare greșită
 * întorcea omul pe o pagină goală, `text/plain`, fără formular (auditul din 8
 * oct 2026). Acum, pentru o navigare din browser, eroarea e un 303 înapoi la
 * pagina uneltei, cu aceiași parametri — pagina recitește parametrii și arată
 * problema lângă formular. Un client de API primește în continuare 400, cu
 * motivul în corp.
 *
 * ── FĂRĂ SESIUNE, FĂRĂ BAZĂ, FĂRĂ CACHE PUBLIC ─────────────────────────────
 * Intrările sunt parametri normalizați și plafonați. Răspunsul conține nume de
 * oameni, deci `private, no-store`: nici Cloudflare, nici un proxy nu-l
 * păstrează.
 */
export const dynamic = "force-dynamic";

type FormatCerere = "pdf" | "docx";

const TIP: Readonly<Record<FormatCerere, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const FARA_CACHE = "private, no-store";

/** Lipsa formatului înseamnă PDF; un format prezent dar necunoscut e o eroare. */
function citesteFormat(brut: string | null): FormatCerere | null {
  const valoare = (brut ?? "").trim().toLowerCase();
  if (valoare === "") return "pdf";
  return valoare === "pdf" || valoare === "docx" ? valoare : null;
}

/** O navigare din browser (formularul paginii), nu un `curl` sau un script. */
function esteNavigare(cerere: Request): boolean {
  return (
    cerere.headers.get("sec-fetch-mode") === "navigate" ||
    (cerere.headers.get("accept") ?? "").includes("text/html")
  );
}

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  try {
    const format = citesteFormat(q.get("format"));
    if (format === null) {
      throw new EroareIntrare(
        `Formatul „${(q.get("format") ?? "").slice(0, 20)}” nu există: pdf sau docx.`,
      );
    }
    const scrisoare = cerereDinParametri(q);
    const continut =
      format === "pdf"
        ? await randeazaScrisoarePdf(scrisoare)
        : await randeazaScrisoareDocx(scrisoare);
    return new Response(new Uint8Array(continut), {
      headers: {
        "content-type": TIP[format],
        "content-disposition": `attachment; filename="${numeFisierSigur(scrisoare.numeFisier)}.${format}"`,
        "cache-control": FARA_CACHE,
      },
    });
  } catch (eroare) {
    if (!(eroare instanceof EroareIntrare)) throw eroare;
    if (esteNavigare(cerere)) {
      const inapoi = new URLSearchParams(q);
      inapoi.delete("format");
      const sir = inapoi.toString();
      return new Response(null, {
        status: 303,
        headers: {
          location: `${PAGINA_CERERE}${sir === "" ? "" : `?${sir}`}#documentul`,
          "cache-control": FARA_CACHE,
        },
      });
    }
    return new Response(eroare.message, {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": FARA_CACHE },
    });
  }
}
