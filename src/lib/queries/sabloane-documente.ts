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
import "server-only";

import type { AntetOrganizatie } from "@/lib/documents/bloc-firma";
import { BUCKET_BRANDING } from "@/lib/pdf/antet-organizatie";
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

/**
 * Antetul documentelor, pentru ecranul de configurare.
 *
 * ── DE CE NU REFOLOSEȘTE `antetOrganizatie()` ──────────────────────────────
 * Aceea citește sigla ca OCTEȚI, ca s-o încorporeze în PDF. Un ecran are nevoie
 * de un URL pe care să-l pună în `<img>`, iar bucket-ul `org-branding` e privat:
 * URL-ul trebuie semnat. Datele textuale sunt aceleași și vin din același loc —
 * `randuriBlocFirma` le compune identic în ambele capete, deci previzualizarea
 * din ecran nu poate diverge de hârtie.
 */
type RandOrganizatieAntet = {
  name: string;
  legal_name: string | null;
  forma_juridica: string | null;
  cui: string | null;
  reg_com: string | null;
  adresa: string | null;
  oras: string | null;
  judet: string | null;
  capital_social: number | null;
  capital_social_varsat: number | null;
  sistem_dualist: boolean;
  telefon_contact: string | null;
  email_contact: string | null;
};

type RandBrandingAntet = {
  antet_pozitie: "antet" | "subsol";
  antet_arata_logo: boolean;
  logo_light_path: string | null;
};

export type AntetDocumenteConfigurat = Readonly<{
  antet: AntetOrganizatie;
  /** URL semnat, valabil o oră. `null` dacă firma n-a încărcat nicio siglă. */
  urlSigla: string | null;
}>;

export async function citesteAntetDocumente(
  supabase: ServerSupabase,
  organizationId: string,
  denumireUzuala: string,
): Promise<AntetDocumenteConfigurat> {
  const [organizatie, branding] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name, legal_name, forma_juridica, cui, reg_com, adresa, oras, judet, " +
          "capital_social, capital_social_varsat, sistem_dualist, telefon_contact, email_contact",
      )
      .eq("id", organizationId)
      // Tip explicit: `select` primit ca EXPRESIE (concatenare), nu ca literal,
      // nu poate fi dedus de PostgREST — vezi același tipar în
      // `lib/pdf/antet-organizatie.ts`.
      .maybeSingle<RandOrganizatieAntet>(),
    supabase
      .from("organization_branding")
      .select("antet_pozitie, antet_arata_logo, logo_light_path")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle<RandBrandingAntet>(),
  ]);

  const o = organizatie.data;
  const b = branding.data;

  const adresa =
    o === null
      ? ""
      : [o.adresa, o.oras, o.judet]
          .filter((v): v is string => v !== null && v.trim().length > 0)
          .join(", ");

  const antet: AntetOrganizatie = {
    denumire: o === null ? denumireUzuala : (o.legal_name ?? o.name),
    formaJuridica: o?.forma_juridica ?? null,
    cui: o?.cui ?? null,
    regCom: o?.reg_com ?? null,
    adresa: adresa.length > 0 ? adresa : null,
    capitalSocial: o?.capital_social ?? null,
    capitalVarsat: o?.capital_social_varsat ?? null,
    sistemDualist: o?.sistem_dualist ?? false,
    telefon: o?.telefon_contact ?? null,
    email: o?.email_contact ?? null,
    pozitie: b?.antet_pozitie ?? "antet",
    // Ecranul nu încorporează nimic: sigla se arată prin `urlSigla`.
    sigla: null,
  };

  const cale = b?.antet_arata_logo === true ? (b.logo_light_path ?? null) : null;
  if (cale === null) return { antet, urlSigla: null };

  const semnat = await supabase.storage.from(BUCKET_BRANDING).createSignedUrl(cale, 3600);
  return { antet, urlSigla: semnat.data?.signedUrl ?? null };
}
