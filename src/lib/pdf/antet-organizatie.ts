// src/lib/pdf/antet-organizatie.ts
// Datele de identificare ale firmei emitente, citite o singură dată și de
// aceeași manieră pentru toate documentele oficiale.
//
// Denumirea preferată e cea LEGALĂ (`legal_name`), nu cea uzuală: pe un stat de
// plată sau pe un fluturaș apare firma așa cum e înregistrată la Registrul
// Comerțului, nu cum îi spun angajații. Aceeași alegere ca la
// `documente/[id]/route.ts`, care generează contractul de muncă.
//
// CE se scrie nu se decide aici, ci în `src/lib/documents/bloc-firma.ts` —
// funcție pură, cu teste per formă juridică. Aici se face doar CITIREA: două
// tabele și, dacă firma a încărcat o siglă, un fișier din Storage.
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { AntetOrganizatie, SiglaOrganizatie } from "@/lib/documents/bloc-firma";

export const BUCKET_BRANDING = "org-branding";

/** Doar formatele pe care `pdf-lib` le încorporează (`embedPng`/`embedJpg`). */
const TIPURI_SIGLA: Readonly<Record<string, SiglaOrganizatie["tip"]>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** Tipul siglei, dedus din extensia căii. `null` pentru orice altceva. */
export function tipSigla(cale: string): SiglaOrganizatie["tip"] | null {
  const extensie = cale.split(".").pop()?.toLowerCase() ?? "";
  return TIPURI_SIGLA[extensie] ?? null;
}

type RandOrganizatie = {
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

type RandBranding = {
  antet_pozitie: Database["public"]["Enums"]["pozitie_antet"];
  antet_arata_logo: boolean;
  logo_light_path: string | null;
};

/**
 * Sigla, adusă din bucket-ul privat `org-branding`.
 *
 * Întoarce `null` la ORICE eșec — fișier șters manual din bucket, RLS care
 * refuză, format pe care `pdf-lib` nu-l știe. Un contract fără siglă e un
 * contract valabil; un contract care nu se mai generează fiindcă lipsește o
 * imagine decorativă nu e.
 */
async function citesteSigla(
  db: SupabaseClient<Database>,
  cale: string,
): Promise<SiglaOrganizatie | null> {
  const tip = tipSigla(cale);
  if (tip === null) return null;

  const { data, error } = await db.storage.from(BUCKET_BRANDING).download(cale);
  if (error !== null || data === null) return null;

  const octeti = new Uint8Array(await data.arrayBuffer());
  return octeti.byteLength === 0 ? null : { octeti, tip };
}

export async function antetOrganizatie(
  db: SupabaseClient<Database>,
  organizationId: string,
  denumireUzuala: string,
): Promise<AntetOrganizatie> {
  // Două tabele fără legătură de citire între ele: serial ar fi două
  // dus-întorsuri spre PostgREST pentru nimic.
  const [organizatie, branding] = await Promise.all([
    db
      .from("organizations")
      .select(
        "name, legal_name, forma_juridica, cui, reg_com, adresa, oras, judet, " +
          "capital_social, capital_social_varsat, sistem_dualist, telefon_contact, email_contact",
      )
      .eq("id", organizationId)
      .maybeSingle<RandOrganizatie>(),
    db
      .from("organization_branding")
      .select("antet_pozitie, antet_arata_logo, logo_light_path")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle<RandBranding>(),
  ]);

  const data = organizatie.data;

  // Fără rând (RLS, organizație ștearsă între timp) documentul se generează
  // oricum, cu denumirea din sesiune: un stat de plată fără antet e mai bun
  // decât un stat de plată inexistent.
  if (data === null) {
    return {
      denumire: denumireUzuala,
      formaJuridica: null,
      cui: null,
      regCom: null,
      adresa: null,
      capitalSocial: null,
      capitalVarsat: null,
      sistemDualist: false,
      telefon: null,
      email: null,
      pozitie: "antet",
      sigla: null,
    };
  }

  const adresa = [data.adresa, data.oras, data.judet]
    .filter((v): v is string => v !== null && v.trim().length > 0)
    .join(", ");

  // Firma n-are neapărat rând de branding: tabela e 1:1 și se creează la prima
  // configurare, deci lipsa ei înseamnă implicitele — antet, fără siglă.
  const configurare = branding.data;
  const caleaSigla =
    configurare !== null && configurare.antet_arata_logo ? configurare.logo_light_path : null;

  return {
    denumire: data.legal_name ?? data.name,
    formaJuridica: data.forma_juridica,
    cui: data.cui,
    regCom: data.reg_com,
    adresa: adresa.length > 0 ? adresa : null,
    capitalSocial: data.capital_social,
    capitalVarsat: data.capital_social_varsat,
    sistemDualist: data.sistem_dualist,
    telefon: data.telefon_contact,
    email: data.email_contact,
    pozitie: configurare?.antet_pozitie ?? "antet",
    sigla: caleaSigla === null ? null : await citesteSigla(db, caleaSigla),
  };
}
