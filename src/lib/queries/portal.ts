// src/lib/queries/portal.ts
// Citirile portalului angajatului.
//
// Toate întorc DOAR datele omului autentificat, și nu fiindcă filtrăm noi: RLS
// o face, prin ramurile `own` ale politicilor. `employees:read = own` înseamnă
// literal `user_id = auth.uid()` — un singur rând — iar `leave:read = own`,
// `attendance:read = own` la fel. Un filtru duplicat în TypeScript ar părea că
// apără ceva și ar putea diverge tăcut de regula reală.

import { createServerSupabase } from "@/lib/supabase/server";

export interface FisaProprie {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
  readonly hired_on: string | null;
  readonly department_id: string | null;
  readonly job_position_id: string | null;
  readonly status: string;
}

export interface SoldConcediu {
  readonly leave_type_id: string;
  readonly an: number;
  readonly drept_anual: number;
  readonly reportate: number;
  readonly folosite: number;
  readonly in_asteptare: number;
  readonly ramase: number | null;
}

export interface CerereProprie {
  readonly id: string;
  readonly leave_type_id: string;
  readonly data_inceput: string;
  readonly data_sfarsit: string;
  readonly zile_lucratoare: number | null;
  readonly status: string;
  readonly motiv_respingere: string | null;
}

export interface TipConcediu {
  readonly id: string;
  readonly denumire: string;
  readonly culoare: string | null;
}

export interface ZiPontaj {
  readonly id: string;
  readonly data: string;
  readonly ore_lucrate: number | null;
  readonly ore_suplimentare: number | null;
  readonly ore_noapte: number | null;
  readonly tip_zi: string;
  readonly observatii: string | null;
}

export interface DocumentPropriu {
  readonly id: string;
  readonly titlu: string;
  readonly scop: string | null;
  readonly numar_afisat: string | null;
  readonly emis_la: string;
  readonly valabil_pana: string | null;
  readonly cod_verificare: string | null;
  readonly anulat_la: string | null;
}

/**
 * Fișa proprie.
 *
 * `maybeSingle()` și nu `single()`: un utilizator poate fi membru al organizației
 * fără să aibă încă fișă de personal — de exemplu un administrator invitat, care
 * nu e angajat. Portalul trebuie să spună asta, nu să cadă.
 */
export async function fisaProprie(organizationId: string): Promise<FisaProprie | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca, hired_on, department_id, job_position_id, status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<FisaProprie>();

  if (error !== null) throw error;
  return data;
}

export async function soldurileMele(
  organizationId: string,
  an: number,
): Promise<readonly SoldConcediu[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_balances")
    .select("leave_type_id, an, drept_anual, reportate, folosite, in_asteptare, ramase")
    .eq("organization_id", organizationId)
    .eq("an", an)
    .is("deleted_at", null)
    .returns<SoldConcediu[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export async function cererileMele(
  organizationId: string,
  limita = 50,
): Promise<readonly CerereProprie[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_requests")
    .select(
      "id, leave_type_id, data_inceput, data_sfarsit, zile_lucratoare, status, motiv_respingere",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("data_inceput", { ascending: false })
    .limit(limita)
    .returns<CerereProprie[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export async function tipuriConcediu(
  organizationId: string,
): Promise<ReadonlyMap<string, TipConcediu>> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_types")
    .select("id, denumire, culoare")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .returns<TipConcediu[]>();

  if (error !== null) throw error;
  return new Map((data ?? []).map((t) => [t.id, t]));
}

/**
 * Pontajul propriu pentru o lună.
 *
 * Intervalul se compune ca ȘIRURI de zile calendaristice, nu prin aritmetică pe
 * `Date`: coloana e `date` în Postgres, iar un `Date` convertit ar aluneca peste
 * granița lunii în funcție de fus.
 */
export async function pontajulMeu(
  organizationId: string,
  an: number,
  luna: number,
): Promise<readonly ZiPontaj[]> {
  const prima = `${an}-${String(luna).padStart(2, "0")}-01`;
  const urmatoareaLuna = luna === 12 ? 1 : luna + 1;
  const anUrmator = luna === 12 ? an + 1 : an;
  const primaUrmatoare = `${anUrmator}-${String(urmatoareaLuna).padStart(2, "0")}-01`;

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_entries")
    .select("id, data, ore_lucrate, ore_suplimentare, ore_noapte, tip_zi, observatii")
    .eq("organization_id", organizationId)
    .gte("data", prima)
    .lt("data", primaUrmatoare)
    .is("deleted_at", null)
    .order("data", { ascending: true })
    .returns<ZiPontaj[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Documentele proprii.
 *
 * `employee_documents` conține și documente cu regim sensibil, dar politica lor
 * de SELECT nu are ramură `own` — un angajat nu-și vede aici dosarul. Ce vede
 * sunt documentele EMISE către el (adeverințe, fișe), din `hr_issued_documents`.
 * Dacă interogarea întoarce zero rânduri, asta e situația reală, nu o eroare.
 */
export async function documenteleMele(
  organizationId: string,
  employeeId: string,
): Promise<readonly DocumentPropriu[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("hr_issued_documents")
    .select("id, titlu, scop, numar_afisat, emis_la, valabil_pana, cod_verificare, anulat_la")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("emis_la", { ascending: false })
    .limit(100)
    .returns<DocumentPropriu[]>();

  if (error !== null) throw error;
  return data ?? [];
}
