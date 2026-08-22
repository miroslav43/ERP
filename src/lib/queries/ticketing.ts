// src/lib/queries/ticketing.ts
// Citirile modulului de ticketing. Toate merg prin clientul legat de RLS:
// politicile din 0045 decid ce vede fiecare, iar interogările de aici NU repetă
// filtrele de vizibilitate — le-ar putea scrie greșit, iar dublarea ar ascunde
// o eventuală gaură în politică în loc s-o expună.
//
// Excepție: `deleted_at is null` se repetă explicit. Politica îl are doar pe
// ramura de tenant, iar administratorul de platformă vede și rândurile șterse
// logic — vezi 0043, unde exact omisiunea asta a dat o listă cu rânduri care
// n-ar fi trebuit să apară.
import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type { StatusTichet, TipTichet } from "@/domain/ticketing/stari";
import type { Prioritate } from "@/domain/ticketing/prioritate";
import type { FiltreTichete } from "@/schemas/ticketing";

/** Câte rânduri se cer într-o pagină de listă. */
export const LIMITA_PAGINA = 25;

const COLOANE_LISTA = `
  id, numar_afisat, tip, titlu, status, prioritate, created_at, updated_at,
  solicitant:employees!tickets_solicitant_employee_id_fkey (id, full_name),
  asignat:employees!tickets_asignat_employee_id_fkey (id, full_name)
` as const;

export type RandTichet = Readonly<{
  id: string;
  numar_afisat: string;
  tip: TipTichet;
  titlu: string;
  status: StatusTichet;
  prioritate: Prioritate;
  created_at: string;
  updated_at: string;
  solicitant: Readonly<{ id: string; full_name: string }> | null;
  asignat: Readonly<{ id: string; full_name: string }> | null;
}>;

export type PaginaTichete = Readonly<{
  randuri: readonly RandTichet[];
  /** `true` dacă mai există rânduri dincolo de pagina curentă. */
  maiSunt: boolean;
}>;

/**
 * Paginare keyset pe `created_at desc, id desc`, ca în restul aplicației:
 * offset-ul ar sări rânduri când apar tichete noi în timpul răsfoirii.
 */
export async function listeazaTichete(
  organizationId: string,
  filtre: FiltreTichete,
  cursor?: Readonly<{ createdAt: string; id: string }>,
): Promise<PaginaTichete> {
  const db = await createServerSupabase();

  let interogare = db
    .from("tickets")
    .select(COLOANE_LISTA)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMITA_PAGINA + 1);

  if (filtre.tip !== undefined) interogare = interogare.eq("tip", filtre.tip);
  if (filtre.status !== undefined) interogare = interogare.eq("status", filtre.status);
  if (filtre.prioritate !== undefined) interogare = interogare.eq("prioritate", filtre.prioritate);
  if (filtre.asignat_employee_id !== undefined) {
    interogare = interogare.eq("asignat_employee_id", filtre.asignat_employee_id);
  }
  if (filtre.department_id !== undefined) {
    interogare = interogare.eq("department_id", filtre.department_id);
  }
  if (filtre.cauta !== undefined && filtre.cauta !== "") {
    // Numărul afișat e cel pe care omul îl are la îndemână („IT-2026-00042”),
    // deci căutarea îl acoperă alături de titlu.
    const termen = `%${filtre.cauta}%`;
    interogare = interogare.or(`titlu.ilike.${termen},numar_afisat.ilike.${termen}`);
  }
  if (cursor !== undefined) {
    interogare = interogare.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await interogare.returns<RandTichet[]>();
  if (error !== null) throw error;

  const randuri = data ?? [];
  return {
    randuri: randuri.slice(0, LIMITA_PAGINA),
    maiSunt: randuri.length > LIMITA_PAGINA,
  };
}

const COLOANE_FISA = `
  *,
  solicitant:employees!tickets_solicitant_employee_id_fkey (id, full_name, department_id),
  asignat:employees!tickets_asignat_employee_id_fkey (id, full_name),
  aprobator:employees!tickets_aprobat_de_employee_id_fkey (id, full_name),
  obiect:inventory_items (id, denumire, numar_inventar, serie, model, garantie_expira)
` as const;

/**
 * Tichetele deschise de un angajat anume, cu filtru EXPLICIT pe solicitant.
 *
 * `listeazaTichete` se sprijină pe RLS, ceea ce e corect în aplicația mare —
 * acolo, cine are drepturi mai largi TREBUIE să vadă mai mult. Sub eticheta
 * „tichetele mele” însă, același comportament ar arăta unui `org_admin` coada
 * întregii firme ca fiind a lui. Vezi avertismentul din capul lui
 * `queries/portal.ts`.
 *
 * Fără cursor: un angajat obișnuit are zeci de tichete, nu mii, iar paginarea pe
 * telefon nu-și merită complexitatea. Limita e explicită și sub `max_rows`, deci
 * nu poate fi trunchiată tăcut de PostgREST.
 */
export async function ticheteleMele(
  organizationId: string,
  employeeId: string,
  limita = 50,
): Promise<readonly RandTichet[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("tickets")
    .select(COLOANE_LISTA)
    .eq("organization_id", organizationId)
    .eq("solicitant_employee_id", employeeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limita)
    .returns<RandTichet[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export async function citesteTichetul(id: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("tickets")
    .select(COLOANE_FISA)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

export async function listeazaComentariile(ticketId: string) {
  const db = await createServerSupabase();
  // Notele interne sunt filtrate de RLS, nu de aici: politica
  // `ticket_comments_select` le ascunde solicitantului.
  const { data, error } = await db
    .from("ticket_comments")
    .select("id, continut, intern, created_at, autor:employees (id, full_name)")
    .eq("ticket_id", ticketId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error !== null) throw error;
  return data ?? [];
}

export async function listeazaIstoricul(ticketId: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("ticket_history")
    .select("id, camp, valoare_veche, valoare_noua, motiv, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false });
  if (error !== null) throw error;
  return data ?? [];
}

export type ObiectAlocat = Readonly<{
  id: string;
  denumire: string;
  numar_inventar: string | null;
  serie: string | null;
  model: string | null;
}>;

/**
 * Obiectele pe care angajatul le are ACUM în primire — sursa dropdown-ului de
 * la defecțiune. Aceeași definiție ca în `internal.tickets_valideaza_inventarul`:
 * alocare predată și nereturnată. Dacă cele două ar diverge, utilizatorul ar
 * vedea în listă obiecte pe care baza le respinge la salvare.
 */
export async function listeazaObiecteleMele(employeeId: string): Promise<readonly ObiectAlocat[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_allocations")
    .select("item:inventory_items!inner (id, denumire, numar_inventar, serie, model)")
    .eq("employee_id", employeeId)
    .is("returnat_la", null)
    .is("deleted_at", null)
    .returns<{ item: ObiectAlocat | null }[]>();
  if (error !== null) throw error;

  return (data ?? [])
    .map((rand) => rand.item)
    .filter((item): item is ObiectAlocat => item !== null)
    .sort((a, b) => a.denumire.localeCompare(b.denumire, "ro"));
}

/**
 * Managerul direct al unui angajat, prin clientul legat de RLS.
 *
 * Dacă rândul nu e vizibil, întoarce `null` — ceea ce e exact răspunsul
 * potrivit: cine nu are voie să vadă fișa cuiva nu are cum să-i fie manager
 * direct. Nu e nevoie de service_role ca să aflăm asta.
 */
export async function managerulDirectAl(employeeId: string): Promise<string | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("manager_employee_id")
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data?.manager_employee_id ?? null;
}

/** Istoricul de tichete al unui obiect — se afișează pe fișa din inventar. */
export async function listeazaTicheteleObiectului(itemId: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("tickets")
    .select("id, numar_afisat, titlu, status, created_at, closed_at")
    .eq("inventory_item_id", itemId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error !== null) throw error;
  return data ?? [];
}

export type RezumatCoada = Readonly<{
  deschise: number;
  deAprobat: number;
  asteaptaSolicitantul: number;
  restanteste7Zile: number;
}>;

/**
 * Cifrele de pe tabloul modulului. Patru numărători separate, nu o citire
 * mare filtrată în TypeScript: fiecare respectă RLS, iar `head: true` nu aduce
 * rândurile, doar numărul.
 */
export async function rezumatCoada(organizationId: string): Promise<RezumatCoada> {
  const db = await createServerSupabase();
  const acumMinus7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const deschise = ["nou", "in_aprobare", "in_lucru", "in_asteptare", "redeschis"] as const;

  const [totalDeschise, deAprobat, asteapta, restante] = await Promise.all([
    db
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("status", deschise),
    db
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("status", "in_aprobare"),
    db
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("status", "in_asteptare"),
    db
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("status", deschise)
      .lt("created_at", acumMinus7),
  ]);

  for (const rezultat of [totalDeschise, deAprobat, asteapta, restante]) {
    if (rezultat.error !== null) throw rezultat.error;
  }

  return {
    deschise: totalDeschise.count ?? 0,
    deAprobat: deAprobat.count ?? 0,
    asteaptaSolicitantul: asteapta.count ?? 0,
    restanteste7Zile: restante.count ?? 0,
  };
}
