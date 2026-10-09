// src/lib/queries/announcements.ts
// Citirile avizierului. Filtrarea „doar publicate, doar pentru toată lumea”
// e impusă de RLS (`announcements_select`), nu reprodusă aici — un
// administrator vede și ciornele, un angajat obișnuit doar ce e publicat.

import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { citesteTot } from "./citeste-tot";

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

/**
 * Rândul din avizierul de administrare — cu conținut, spre deosebire de cel
 * din portal.
 *
 * `continut` nu era citit deloc, iar lista arăta doar titluri: ca să afli ce
 * scrie într-un anunț trebuia să-l deschizi, unul câte unul. Coloana intră aici
 * pentru extrasul de două rânduri din card.
 *
 * Costul e mărginit de `LIMITA_ANUNTURI` și de constrângerea
 * `announcements_continut_len` (10 000 de caractere): 200 × 10 KB e plafonul
 * teoretic al interogării, iar un anunț real are câteva sute de caractere.
 * Portalul rămâne pe `RandAnunt`, fără conținut — acolo lista e doar un cuprins
 * către fișa fiecărui anunț.
 */
export interface RandAnuntCuExtras extends RandAnunt {
  readonly continut: string;
}

export interface ListaAnunturi {
  readonly randuri: readonly RandAnuntCuExtras[];
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
    .select("id, titlu, continut, fixat, publicat_la, expira_la, created_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("fixat", { ascending: false })
    .order("publicat_la", { ascending: false, nullsFirst: true })
    // Un rând în plus: singurul mod de a deosebi „exact `limita`” de „mai
    // multe”. Cu `>= limita`, exact 200 de anunțuri afișau „mai sunt și altele”.
    .limit(limita + 1)
    .returns<RandAnuntCuExtras[]>();
  if (error !== null) throw error;
  const toate = data ?? [];
  return { randuri: toate.slice(0, limita), trunchiat: toate.length > limita };
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
  /** `null` = fișa e ascunsă de RLS pentru cine privește; `deleted_at` pentru `hrefFisa()`. */
  readonly angajat: Readonly<{
    full_name: string;
    marca: string;
    deleted_at: string | null;
  }> | null;
}

/** Cine a citit anunțul — vizibil doar pentru cine administrează avizierul (RLS). */
export async function cititoriAnunt(announcementId: string): Promise<readonly CititorAnunt[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("announcement_reads")
    .select("employee_id, citit_la, angajat:employees!employee_id(full_name, marca, deleted_at)")
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

/** Angajații activi cu cont — cei care POT confirma; lista lui „neconfirmat încă". */
export async function angajatiCuCont(
  organizationId: string,
): Promise<readonly Readonly<{ id: string; full_name: string; deleted_at: string | null }>[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, deleted_at")
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .not("user_id", "is", null)
    .is("deleted_at", null)
    .order("full_name")
    .limit(1000);
  if (error !== null) throw error;
  // `full_name` e generat din prenume + nume și poate fi `null` în tip, nu în practică.
  return (data ?? []).map((a) => ({ ...a, full_name: a.full_name ?? "—" }));
}

/**
 * Câte confirmări are FIECARE anunț al firmei — pentru „Citit de X din Y" pe
 * cardurile din lista de administrare.
 *
 * Prin `citesteTot`, nu printr-un singur `select`: 8 angajați × 200 de
 * anunțuri trec de `max_rows = 1000`, iar tăierea e tăcută — cardurile ar fi
 * arătat cifre mai mici pentru anunțurile vechi, fără nicio eroare.
 */
export async function numarConfirmariPeAnunt(
  organizationId: string,
): Promise<ReadonlyMap<string, number>> {
  const db = await createServerSupabase();
  const randuri = await citesteTot<{ id: string; announcement_id: string }>(
    (dupa, pas) => {
      let q = db
        .from("announcement_reads")
        .select("id, announcement_id")
        .eq("organization_id", organizationId)
        .order("id")
        .limit(pas);
      if (dupa !== null) q = q.gt("id", dupa);
      return q;
    },
    (r) => r.id,
    { nume: "confirmările de citire" },
  );
  const contor = new Map<string, number>();
  for (const r of randuri) contor.set(r.announcement_id, (contor.get(r.announcement_id) ?? 0) + 1);
  return contor;
}
