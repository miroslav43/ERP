// src/lib/documents/generator.ts
// Motorul comun de generare a documentelor din șablon: căutare șablon, randare
// {{variabile}}, numerotare pe serie cu retry pe coliziune, amprentă SHA-256,
// pagină de tipărit. Extras din `adeverinte.ts` ca să fie reutilizat și de
// contractul de muncă și de fișa postului (aceeași mecanică, alte variabile).
import { createHash, randomBytes } from "node:crypto";
import { escapeHtml } from "@/lib/email/templates/layout";
import { todayInBucharest } from "@/lib/format/date";
import { businessRule, notFound } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

export type ParametriDocument = {
  readonly organizationId: string;
  readonly employeeId: string;
  readonly codSablon: string;
  readonly emisDe: string;
  readonly valori: ReadonlyMap<string, string>;
  readonly scop?: string;
  readonly contractId?: string;
};
export type DocumentGenerat = {
  readonly id: string;
  readonly numarAfisat: string;
  readonly html: string;
  readonly hash: string;
  readonly codVerificare: string;
};

const RE_VARIABILA = /\{\{\s*([a-z_]+)\s*\}\}/g;

function randeaza(
  sablon: string,
  valori: ReadonlyMap<string, string>,
): { html: string; lipsa: readonly string[] } {
  const lipsa: string[] = [];
  const html = sablon.replace(RE_VARIABILA, (_potrivire, cheie: string) => {
    const valoare = valori.get(cheie);
    if (valoare === undefined || valoare.length === 0) {
      lipsa.push(cheie);
      return "";
    }
    return escapeHtml(valoare); // conținutul e HTML de șablon; valorile sunt mereu evadate
  });
  return { html, lipsa };
}

/** Numerotare pe (organizație, serie). Coliziunile sunt prinse de indexul unic și reîncercate. */
async function urmatorulNumar(
  supabase: ServerSupabase,
  organizationId: string,
  serie: string,
): Promise<number> {
  const { data } = await supabase
    .from("hr_issued_documents")
    .select("numar")
    .eq("organization_id", organizationId)
    .eq("serie", serie)
    .order("numar", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.numar ?? 0) + 1;
}

export async function genereazaDocument(
  supabase: ServerSupabase,
  parametri: ParametriDocument,
): Promise<DocumentGenerat> {
  const { organizationId, employeeId, codSablon } = parametri;

  const { data: sablon } = await supabase
    .from("hr_document_templates")
    .select("id, denumire, continut_html, serie")
    .eq("cod", codSablon)
    .eq("activ", true)
    .is("deleted_at", null)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("organization_id", { ascending: true, nullsFirst: false }) // varianta organizației are prioritate
    .limit(1)
    .maybeSingle();
  if (sablon === null)
    throw notFound(`Șablonul „${codSablon}” nu este configurat pentru organizația ta.`);

  const { html, lipsa } = randeaza(sablon.continut_html, parametri.valori);
  if (lipsa.length > 0) {
    throw businessRule(
      `Documentul nu poate fi emis: lipsesc date din fișă (${lipsa.join(", ")}). Completează-le și încearcă din nou.`,
    );
  }

  const hash = createHash("sha256").update(html, "utf8").digest("hex");
  const codVerificare = randomBytes(16).toString("base64url");
  const azi = todayInBucharest();
  const an = azi.slice(0, 4);

  for (let incercare = 0; incercare < 5; incercare += 1) {
    const numar = await urmatorulNumar(supabase, organizationId, sablon.serie);
    const numarAfisat = `${sablon.serie} ${an}/${String(numar).padStart(6, "0")}`;
    const { data, error } = await supabase
      .from("hr_issued_documents")
      .insert({
        organization_id: organizationId,
        template_id: sablon.id,
        employee_id: employeeId,
        serie: sablon.serie,
        numar,
        numar_afisat: numarAfisat,
        titlu: sablon.denumire,
        emis_la: azi,
        continut_html: html,
        continut_checksum: hash,
        cod_verificare: codVerificare,
        emis_de: parametri.emisDe,
        date_document: Object.fromEntries(parametri.valori),
        ...(parametri.scop === undefined ? {} : { scop: parametri.scop }),
        ...(parametri.contractId === undefined ? {} : { contract_id: parametri.contractId }),
      })
      .select("id")
      .single();

    if (error === null && data !== null) {
      return { id: data.id, numarAfisat, html, hash, codVerificare };
    }
    if (error?.code !== "23505") {
      throw businessRule("Documentul nu a putut fi înregistrat. Încearcă din nou.");
    }
    // 23505 = alt utilizator a luat între timp același număr: reluăm alocarea.
  }
  throw businessRule("Numerotarea documentelor este ocupată. Încearcă din nou peste câteva secunde.");
}

/** HTML complet, pregătit pentru tipărire din browser (Ctrl+P). Fără resurse externe. */
export function paginaTiparibila(document: DocumentGenerat, denumireOrganizatie: string): string {
  return [
    '<!doctype html><html lang="ro"><head><meta charset="utf-8">',
    `<title>${escapeHtml(document.numarAfisat)}</title>`,
    "<style>body{font-family:Georgia,serif;max-width:18cm;margin:2cm auto;line-height:1.6;color:#111}",
    "footer{margin-top:3cm;font-size:.8rem;color:#555;border-top:1px solid #ccc;padding-top:.5cm}",
    "@media print{body{margin:0}}</style></head><body>",
    `<p>${escapeHtml(denumireOrganizatie)} — nr. ${escapeHtml(document.numarAfisat)}</p>`,
    document.html,
    `<footer>Cod de verificare: ${escapeHtml(document.codVerificare)} · amprentă SHA-256: ${document.hash.slice(0, 16)}…</footer>`,
    "</body></html>",
  ].join("");
}
