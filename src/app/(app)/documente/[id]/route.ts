// src/app/(app)/documente/[id]/route.ts
// Afișează un document generat (contract de muncă, fișa postului, adeverință)
// — HTML printabil, gata de „Salvează ca PDF" din dialogul de tipărire al
// browserului (aceeași alegere ca la înrolarea companiei: fără librărie PDF
// nouă). RLS (`hr_issued_select`, `app.can_see_employee`) decide singură cine
// vede documentul — nicio verificare suplimentară de permisiune aici.
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { paginaTiparibila, type DocumentGenerat } from "@/lib/documents/generator";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { numeFisier } from "@/lib/pdf/document";
import { pdfDinDocument } from "@/lib/pdf/din-html";

export const dynamic = "force-dynamic";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface ProprietatiRuta {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(request: Request, { params }: ProprietatiRuta): Promise<Response> {
  const { id } = await params;

  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") return raspunsText("Trebuie să te autentifici.", 401);
  if (rezolvare.status !== "ok") return raspunsText("Alege mai întâi o organizație.", 403);

  const db = await createServerSupabase();
  const { data: document, error } = await db
    .from("hr_issued_documents")
    .select("numar_afisat, titlu, continut_html, continut_checksum, cod_verificare")
    .eq("id", id)
    .eq("organization_id", rezolvare.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) return raspunsText("Documentul nu a putut fi citit.", 500);
  if (document === null)
    return raspunsText("Documentul nu a fost găsit sau nu îți este accesibil.", 404);

  const generat: DocumentGenerat = {
    id,
    numarAfisat: document.numar_afisat,
    html: document.continut_html ?? "",
    hash: document.continut_checksum ?? "",
    codVerificare: document.cod_verificare ?? "",
  };

  // Document oficial: forma juridică completă dacă a fost completată, altfel
  // denumirea uzuală.
  const denumireOrganizatie = rezolvare.tenant.legalName ?? rezolvare.tenant.name;

  /*
   * `?format=pdf` — aceeași citire, aceeași RLS (`hr_issued_select`), altă
   * randare.
   *
   * PDF-ul se compune din HTML-ul STOCAT, nu din date recompuse: rândul din
   * `hr_issued_documents` e documentul de referință, cu numărul lui pe serie și
   * cu amprenta SHA-256 care dovedește că textul n-a fost atins. Un PDF compus
   * separat ar fi un al doilea izvor de adevăr pentru același număr.
   */
  if (new URL(request.url).searchParams.get("format") === "pdf") {
    // Antetul se citește prin ajutorul comun, ca fluturașii și statele de
    // plată: un singur loc care știe ce coloane are firma.
    const octeti = await pdfDinDocument({
      html: generat.html,
      numarAfisat: generat.numarAfisat,
      titlu: document.titlu,
      organizatie: await antetOrganizatie(db, rezolvare.tenant.organizationId, denumireOrganizatie),
      codVerificare: generat.codVerificare,
      amprenta: generat.hash.slice(0, 16),
    });

    return new Response(octeti as BodyInit, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        // `inline`, nu `attachment`: cine vrea fișierul îl salvează din
        // vizualizatorul browserului, iar cine vrea doar să-l vadă nu adună
        // descărcări pe care nu le-a cerut.
        "content-disposition": `inline; filename="${numeFisier(`${document.titlu}-${generat.numarAfisat}`)}.pdf"`,
        "cache-control": "no-store",
      },
    });
  }

  return new Response(paginaTiparibila(generat, denumireOrganizatie), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
