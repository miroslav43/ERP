// src/app/(portal)/portal/cursurile-mele/[id]/adeverinta/route.ts
// Adeverința de parcurgere: HTML printabil, gata de „Salvează ca PDF" din
// dialogul de tipărire al browserului. Aceeași alegere ca la documentele de
// personal — fără librărie PDF nouă, fără Chromium în imaginea Docker.
//
// Conținutul vine din `course_completion_records`, tabela IMUTABILĂ scrisă de
// trigger la finalizare, nu din starea curentă a cursului: dacă materialul se
// schimbă mâine, adeverința de azi rămâne ce a fost.

import { escapeHtml } from "@/lib/email/templates/layout";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

export const dynamic = "force-dynamic";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface Lectie {
  readonly ordine?: number;
  readonly titlu?: string;
  readonly treapta?: string;
  readonly finalizat_la?: string | null;
  readonly semnatura?: string | null;
  readonly amprenta?: string | null;
}

interface Continut {
  readonly curs?: { readonly cod?: string; readonly denumire?: string };
  readonly angajat?: { readonly nume?: string };
  readonly lectii?: readonly Lectie[];
}

const ETICHETA_TREAPTA: Readonly<Record<string, string>> = {
  bifa: "bifă",
  parcurgere: "parcurgere măsurată",
  test: "test grilă",
  declaratie: "declarație asumată",
};

export async function GET(
  _cerere: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<Response> {
  const { id } = await params;

  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") return raspunsText("Trebuie să vă autentificați.", 401);
  if (rezolvare.status !== "ok") return raspunsText("Alegeți mai întâi o organizație.", 403);

  const db = await createServerSupabase();
  // `course_completion_records` NU are `deleted_at` — un `.is("deleted_at", null)`
  // pe ea ar da 42703. Deliberat, ca la dovada de integrare.
  const { data: dovada, error } = await db
    .from("course_completion_records")
    .select("ciclu, finalizat_la, expira_la, total_materiale, materiale_finalizate, continut, continut_checksum")
    .eq("enrollment_id", id)
    .eq("organization_id", rezolvare.tenant.organizationId)
    .maybeSingle();
  if (error !== null) return raspunsText("Adeverința nu a putut fi citită.", 500);
  if (dovada === null) {
    return raspunsText("Nu există încă o adeverință pentru acest curs.", 404);
  }

  const continut = (dovada.continut ?? {}) as Continut;
  const lectii = continut.lectii ?? [];

  const randuri = lectii
    .map(
      (l) =>
        `<tr><td>${escapeHtml(String(l.ordine ?? ""))}</td>` +
        `<td>${escapeHtml(l.titlu ?? "—")}</td>` +
        `<td>${escapeHtml(ETICHETA_TREAPTA[l.treapta ?? ""] ?? l.treapta ?? "—")}</td>` +
        `<td>${l.finalizat_la == null ? "—" : escapeHtml(formatDateTime(l.finalizat_la))}</td>` +
        `<td>${l.semnatura == null ? "—" : escapeHtml(l.semnatura)}</td></tr>`,
    )
    .join("");

  const html = [
    '<!doctype html><html lang="ro"><head><meta charset="utf-8">',
    `<title>Adeverință — ${escapeHtml(continut.curs?.denumire ?? "curs")}</title>`,
    "<style>body{font-family:Georgia,serif;max-width:18cm;margin:2cm auto;line-height:1.6;color:#111}",
    "table{width:100%;border-collapse:collapse;margin-top:1cm}",
    "th,td{border:1px solid #ccc;padding:.3cm;text-align:left;font-size:.9rem}",
    "th{background:#f4f4f4}",
    "footer{margin-top:2cm;font-size:.8rem;color:#555;border-top:1px solid #ccc;padding-top:.5cm}",
    "@media print{body{margin:0}}</style></head><body>",
    `<p>${escapeHtml(rezolvare.tenant.name)}</p>`,
    "<h1>Adeverință de parcurgere</h1>",
    `<p>Prin prezenta se confirmă că <strong>${escapeHtml(continut.angajat?.nume ?? "—")}</strong> ` +
      `a parcurs cursul <strong>${escapeHtml(continut.curs?.denumire ?? "—")}</strong> ` +
      `(cod ${escapeHtml(continut.curs?.cod ?? "—")}), ciclul ${escapeHtml(String(dovada.ciclu))}, ` +
      `finalizat la ${escapeHtml(formatDateTime(dovada.finalizat_la))}.</p>`,
    dovada.expira_la == null
      ? "<p>Parcurgerea nu are termen de valabilitate.</p>"
      : `<p>Valabil până la <strong>${escapeHtml(formatDate(dovada.expira_la))}</strong>.</p>`,
    `<p>Lecții parcurse: ${escapeHtml(String(dovada.materiale_finalizate))} din ${escapeHtml(String(dovada.total_materiale))}.</p>`,
    "<table><thead><tr><th>#</th><th>Lecție</th><th>Dovadă</th><th>Parcursă la</th><th>Semnătură</th></tr></thead>",
    `<tbody>${randuri}</tbody></table>`,
    // Amprenta face vizibilă orice atingere ulterioară a conținutului: dacă
    // rândul s-ar modifica, md5-ul nu s-ar mai potrivi. Triggerul îl blochează
    // oricum, dar amprenta e verificabilă din afara aplicației.
    `<footer>Amprenta conținutului: ${escapeHtml(dovada.continut_checksum)}<br>`,
    "Document generat de aplicație. Nu necesită semnătură olografă.</footer>",
    "</body></html>",
  ].join("");

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
