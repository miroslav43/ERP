// src/lib/queries/portal.ts
// Citirile portalului angajatului.
//
// Toate cer explicit `userId`/`employeeId` și filtrează pe ei — NU se bazează
// pe RLS ca să îngusteze rezultatul la „propriul rând”. Motivul: scope-ul
// `employees:read`/`leave:read`/`attendance:read` al unui `org_admin` sau `hr`
// e `all`, nu `own`. Un asemenea cont poate deschide și el portalul (poate fi
// simultan și angajat), iar fără filtrul explicit interogarea ar întoarce TOATĂ
// organizația sub eticheta „ale mele” — pentru `fisaProprie` (`.maybeSingle()`
// pe N rânduri) chiar cade cu 500; pentru liste, ar afișa concediile și
// pontajul colegilor ca fiind proprii. Reprodus cu `demo_admin` (org_admin,
// `employees:read = all`) deschizând `/portal`.
import { cache } from "react";

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
  /**
   * Necesar ca ecranul de start să aleagă soldul DESPRE CARE se întreabă.
   *
   * Alegerea „cel cu dreptul anual cel mai mare" e corectă doar printre tipurile
   * care scad din sold. O firmă care configurează „concediu fără plată" cu un
   * plafon generos ar împinge în față o cifră exactă și complet lipsită de sens.
   */
  readonly scade_din_sold: boolean;
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
export async function fisaProprie(
  organizationId: string,
  userId: string,
): Promise<FisaProprie | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca, hired_on, department_id, job_position_id, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .is("deleted_at", null)
    .maybeSingle<FisaProprie>();

  if (error !== null) throw error;
  return data;
}

/**
 * Rezultatul rezolvării fișei, cu cele TREI stări pe care le distinge baza.
 *
 * Distincția nu e teoretică. `app.current_employee_id()`
 * (`0005_hr_rls.sql:16-30`) cere `e.is_primary`, iar prin ea trec TOATE ramurile
 * `own` din RLS: concedii, pontaj, diurnă, salarizare, SSM, inventar, checklist.
 * `employees_select`, în schimb, compară pe `user_id` — deci fișa se citește și
 * când nu e principală.
 *
 * Rezultatul, pentru un cont a cărui unică fișă are `is_primary = false`: portalul
 * îi arată numele și marca, iar fiecare listă e goală și fiecare scriere refuză.
 * Nimic nu spune de ce. Iar mesajul „nu aveți fișă de personal” e fals și
 * derutant pentru cineva care își vede marca pe ecran — de aceea `fara_principala`
 * e o stare separată, cu text propriu.
 */
export type StareFisa =
  | Readonly<{ stare: "ok"; fisa: FisaProprie }>
  /** Cont fără nicio fișă — de exemplu un administrator invitat, care nu e angajat. */
  | Readonly<{ stare: "fara_fisa" }>
  /** Are fișă, dar niciuna principală: `app.current_employee_id` întoarce NULL. */
  | Readonly<{ stare: "fara_principala"; marca: string }>;

/**
 * Fișa proprie, cu diagnosticul stării.
 *
 * `cache()` pentru că portalul o cere de două ori pe cerere — o dată învelișul,
 * pentru nume și avatar, o dată ecranul, pentru `employeeId`. Argumentele sunt
 * primitive, deci memoizarea prin identitate funcționează.
 */
export const fisaMea = cache(async (organizationId: string, userId: string): Promise<StareFisa> => {
  const db = await createServerSupabase();
  // `limit(2)`, nu `maybeSingle()`: cumulul de funcții e permis, deci un
  // utilizator poate avea mai multe fișe în aceeași firmă. Al doilea rând nu
  // ne interesează în sine — doar faptul că primul, sortat cu principala în
  // față, spune dacă există vreuna principală.
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca, hired_on, department_id, job_position_id, status, is_primary")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .limit(2)
    .returns<(FisaProprie & { readonly is_primary: boolean })[]>();

  if (error !== null) throw error;

  const randuri = data ?? [];
  const prima = randuri[0];
  if (prima === undefined) return { stare: "fara_fisa" };
  if (!prima.is_primary) return { stare: "fara_principala", marca: prima.marca };

  const { is_primary: _principala, ...fisa } = prima;
  return { stare: "ok", fisa };
});

export async function soldurileMele(
  organizationId: string,
  an: number,
  employeeId: string,
): Promise<readonly SoldConcediu[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_balances")
    .select("leave_type_id, an, drept_anual, reportate, folosite, in_asteptare, ramase")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("an", an)
    .is("deleted_at", null)
    .returns<SoldConcediu[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export async function cererileMele(
  organizationId: string,
  employeeId: string,
  limita = 50,
): Promise<readonly CerereProprie[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_requests")
    .select(
      "id, leave_type_id, data_inceput, data_sfarsit, zile_lucratoare, status, motiv_respingere",
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
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
    .select("id, denumire, culoare, scade_din_sold")
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
  employeeId: string,
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
    .eq("employee_id", employeeId)
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
