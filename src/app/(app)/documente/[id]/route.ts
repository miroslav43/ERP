// src/app/(app)/documente/[id]/route.ts
// Afișează un document generat (contract de muncă, fișa postului, adeverință)
// — HTML printabil, gata de „Salvează ca PDF" din dialogul de tipărire al
// browserului (aceeași alegere ca la înrolarea companiei: fără librărie PDF
// nouă). RLS (`hr_issued_select`, `app.can_see_employee`) decide singură cine
// vede documentul — nicio verificare suplimentară de permisiune aici.
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { paginaTiparibila, type DocumentGenerat } from "@/lib/documents/generator";

export const dynamic = "force-dynamic";

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

interface ProprietatiRuta {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, { params }: ProprietatiRuta): Promise<Response> {
  const { id } = await params;

  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") return raspunsText("Trebuie să te autentifici.", 401);
  if (rezolvare.status !== "ok") return raspunsText("Alege mai întâi o organizație.", 403);

  const db = await createServerSupabase();
  const { data: document, error } = await db
    .from("hr_issued_documents")
    .select("numar_afisat, continut_html, continut_checksum, cod_verificare")
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
  return new Response(paginaTiparibila(generat, denumireOrganizatie), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
