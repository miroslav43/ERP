// src/lib/queries/announcements.ts
// Citirile avizierului. Filtrarea „doar publicate, doar pentru toată lumea”
// e impusă de RLS (`announcements_select`), nu reprodusă aici — un
// administrator vede și ciornele, un angajat obișnuit doar ce e publicat.

import { createServerSupabase } from "@/lib/supabase/server";

export interface RandAnunt {
  readonly id: string;
  readonly titlu: string;
  readonly fixat: boolean;
  readonly publicat_la: string | null;
  readonly expira_la: string | null;
  readonly created_at: string;
}

/**
 * Câte anunțuri aduce ecranul de administrare într-o pagină.
 *
 * Interogarea nu avea NICIUN `.limit()`, deci se sprijinea pe `max_rows = 1000`
 * al PostgREST — care taie TĂCUT: nicio eroare, niciun antet, doar mai puține
 * rânduri. Un avizier vechi de câțiva ani trece de 1000 fără să anunțe pe
 * nimeni, iar anunțurile lipsă erau exact cele mai vechi. Limita explicită e
 * mai mică și, mai ales, CUNOSCUTĂ de ecran, care poate spune că lista e tăiată.
 */
export const LIMITA_ANUNTURI = 200;

export interface ListaAnunturi {
  readonly randuri: readonly RandAnunt[];
  /** Adevărat când s-a atins limita, deci pe disc mai există anunțuri neafișate. */
  readonly trunchiat: boolean;
}

export async function listeazaAnunturi(
  organizationId: string,
  limita: number = LIMITA_ANUNTURI,
): Promise<ListaAnunturi> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("announcements")
    .select("id, titlu, fixat, publicat_la, expira_la, created_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("fixat", { ascending: false })
    .order("publicat_la", { ascending: false, nullsFirst: true })
    .limit(limita)
    .returns<RandAnunt[]>();
  if (error !== null) throw error;
  const randuri = data ?? [];
  return { randuri, trunchiat: randuri.length >= limita };
}

/**
 * Avizierul, așa cum îl vede un angajat: doar publicate, doar neexpirate.
 *
 * `announcements_select` (`0028_announcements.sql:71-83`) arată ciornele și
 * anunțurile expirate oricui are `announcements:update = all`. Portalul e al
 * angajatului, dar filtrul stă AICI, nu în politică: e regula scrisă în capul
 * lui `queries/portal.ts` — citirile portalului nu se sprijină pe scope-ul
 * cititorului, fiindcă „ale mele” trebuie să însemne același lucru indiferent
 * cine deschide ecranul.
 *
 * `acum` vine ca argument: o citire nu atinge ceasul, ca să rămână determinsită
 * la test.
 */
export async function anunturiPublicate(
  organizationId: string,
  acum: string,
  limita = 100,
): Promise<readonly RandAnunt[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("announcements")
    .select("id, titlu, fixat, publicat_la, expira_la, created_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("publicat_la", "is", null)
    .lte("publicat_la", acum)
    // `or()` primește o listă separată prin virgulă: fără încadrare, un
    // `timestamptz` ar putea rupe filtrul. Marca temporală n-are virgule azi,
    // dar formatul ei nu e contractul nostru.
    .or(`expira_la.is.null,expira_la.gt."${acum}"`)
    .order("fixat", { ascending: false })
    .order("publicat_la", { ascending: false })
    .limit(limita)
    .returns<RandAnunt[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface DetaliuAnunt extends RandAnunt {
  readonly continut: string;
}

export async function citesteAnunt(
  organizationId: string,
  id: string,
): Promise<DetaliuAnunt | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("announcements")
    .select("id, titlu, continut, fixat, publicat_la, expira_la, created_at")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<DetaliuAnunt>();
  if (error !== null) throw error;
  return data;
}

/** ID-urile anunțurilor deja citite de angajatul curent — pentru marcaje „nou”. */
export async function idAnunturiCitite(
  organizationId: string,
  employeeId: string,
): Promise<ReadonlySet<string>> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("announcement_reads")
    .select("announcement_id")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .returns<{ announcement_id: string }[]>();
  if (error !== null) throw error;
  return new Set((data ?? []).map((r) => r.announcement_id));
}

export interface CititorAnunt {
  readonly employee_id: string;
  readonly citit_la: string;
  readonly angajat: Readonly<{ full_name: string; marca: string }> | null;
}

/** Cine a citit anunțul — vizibil doar pentru cine administrează avizierul (RLS). */
export async function cititoriAnunt(announcementId: string): Promise<readonly CititorAnunt[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("announcement_reads")
    .select("employee_id, citit_la, angajat:employees!employee_id(full_name, marca)")
    .eq("announcement_id", announcementId)
    .order("citit_la", { ascending: false })
    .returns<CititorAnunt[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Numitorul confirmărilor de citire: angajații activi care AU cont.
 *
 * `numarAngajatiActivi` (mai jos, folosit de panou) numără toți angajații
 * activi — inclusiv pe cei fără `user_id`, care nu se pot autentifica, deci nu
 * pot confirma niciodată nimic. Cu el ca numitor, „3 / 47” era un raport
 * imposibil de dus la 47/47, iar ecranul spunea despre firmă că nu-și citește
 * anunțurile când, de fapt, 40 de oameni nici măcar nu aveau unde.
 *
 * `announcement_reads.employee_id` se completează din `idFisaProprie`, care
 * caută fișa după `user_id` — de aici filtrul.
 */
export async function numarAngajatiCuCont(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .not("user_id", "is", null)
    .is("deleted_at", null);
  if (error !== null) throw error;
  return count ?? 0;
}

export async function numarAngajatiActivi(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .is("deleted_at", null);
  if (error !== null) throw error;
  return count ?? 0;
}
