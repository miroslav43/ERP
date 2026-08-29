// src/lib/queries/sabloane-documente.ts
// Citirea șabloanelor de documente HR, cu aceeași precedență ca la emitere.
//
// ── DE CE PRECEDENȚA SE OGLINDEȘTE, NU SE REINVENTEAZĂ ──────────────────────
// `genereazaDocument` alege șablonul cu
// `.or(organization_id.eq.X, organization_id.is.null)` urmat de
// `.order("organization_id", { nullsFirst: false })` — adică varianta firmei
// bate seed-ul de platformă (`generator.ts:70-79`). Dacă pagina de administrare
// ar lista altfel, ar arăta un text pe care emiterea nu-l folosește: cel mai
// prost fel de ecran de configurare, unul care minte despre ce e în vigoare.
//
// De aceea aici se citesc AMBELE variante și se păstrează, per `cod`, exact pe
// cea pe care ar alege-o generatorul.
import type { ServerSupabase } from "@/lib/supabase/server";

export type SablonDocument = Readonly<{
  id: string;
  /** `null` = seed de platformă, comun tuturor firmelor și needitabil. */
  organization_id: string | null;
  cod: string;
  denumire: string;
  descriere: string | null;
  continut_html: string;
  serie: string;
  activ: boolean;
}>;

const COLOANE = "id, organization_id, cod, denumire, descriere, continut_html, serie, activ";

/**
 * Șabloanele în vigoare pentru o organizație, câte unul per `cod`.
 *
 * `.order("organization_id", { nullsFirst: false })` pune întâi rândurile
 * firmei, deci primul rând văzut pentru un `cod` e cel care câștigă — aceeași
 * regulă ca în generator, scrisă o singură dată aici.
 */
export async function listeazaSabloaneDocumente(
  supabase: ServerSupabase,
  organizationId: string,
): Promise<readonly SablonDocument[]> {
  const { data, error } = await supabase
    .from("hr_document_templates")
    .select(COLOANE)
    .is("deleted_at", null)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("organization_id", { ascending: true, nullsFirst: false })
    .order("cod", { ascending: true })
    .returns<SablonDocument[]>();
  if (error !== null) throw new Error("Șabloanele de documente nu au putut fi citite.");

  const peCod = new Map<string, SablonDocument>();
  for (const sablon of data) {
    if (!peCod.has(sablon.cod)) peCod.set(sablon.cod, sablon);
  }
  return [...peCod.values()].sort((a, b) => a.cod.localeCompare(b.cod, "ro"));
}

/**
 * Un singur șablon, în varianta pe care ar folosi-o emiterea.
 *
 * Întoarce și rândul de platformă când firma n-are copie proprie — pagina de
 * editare pornește de la textul acela, iar prima salvare îl clonează.
 */
export async function citesteSablonDocument(
  supabase: ServerSupabase,
  organizationId: string,
  cod: string,
): Promise<SablonDocument | null> {
  const { data, error } = await supabase
    .from("hr_document_templates")
    .select(COLOANE)
    .eq("cod", cod)
    .is("deleted_at", null)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("organization_id", { ascending: true, nullsFirst: false })
    .limit(1)
    .returns<SablonDocument[]>();
  if (error !== null) throw new Error("Șablonul de document nu a putut fi citit.");
  return data[0] ?? null;
}
