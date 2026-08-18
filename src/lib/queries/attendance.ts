// src/lib/queries/attendance.ts
// Citirile modulului de pontaj. Doar `createServerSupabase` — ESLint interzice
// `createAdminSupabase` aici (excepția acoperă exclusiv `actions.ts`, route
// handlers și scripturi). Fiecare interogare trece prin RLS.

import { createServerSupabase } from "@/lib/supabase/server";
import type { FiltrePontaj, StatusPerioada, SursaIntrare, TipZi } from "@/schemas/attendance";

// ── Perioade ─────────────────────────────────────────────────────────────────

export interface PerioadaPontaj {
  readonly id: string;
  readonly an: number;
  readonly luna: number;
  readonly data_inceput: string;
  readonly data_sfarsit: string;
  readonly status: StatusPerioada;
  readonly blocata_la: string | null;
  readonly blocata_de: string | null;
  readonly observatii: string | null;
}

const COLOANE_PERIOADA =
  "id, an, luna, data_inceput, data_sfarsit, status, blocata_la, blocata_de, observatii";

export async function citestePerioada(
  organizationId: string,
  an: number,
  luna: number,
): Promise<PerioadaPontaj | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_periods")
    .select(COLOANE_PERIOADA)
    .eq("organization_id", organizationId)
    .eq("an", an)
    .eq("luna", luna)
    .is("deleted_at", null)
    .maybeSingle<PerioadaPontaj>();
  if (error !== null) throw error;
  return data;
}

/** Pentru `/pontaj/perioade/[id]`, unde ruta dă un id, nu o pereche (an, lună). */
export async function citestePerioadaDupaId(
  organizationId: string,
  id: string,
): Promise<PerioadaPontaj | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_periods")
    .select(COLOANE_PERIOADA)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<PerioadaPontaj>();
  if (error !== null) throw error;
  return data;
}

/** Cel mult 12 rânduri (una pe lună) — fără paginare keyset. */
export async function listeazaPerioade(
  organizationId: string,
  an: number,
): Promise<readonly PerioadaPontaj[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_periods")
    .select(COLOANE_PERIOADA)
    .eq("organization_id", organizationId)
    .eq("an", an)
    .is("deleted_at", null)
    .order("luna", { ascending: false })
    .returns<PerioadaPontaj[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Angajați (pentru foaia colectivă) ───────────────────────────────────────
//
// Cursorul keyset e o copie intenționată a tiparului din `queries/employees.ts`
// — cheia de sortare fiind aceeași pereche (full_name, id), separatorul e scris
// ca SECVENȚĂ DE EVADARE, nu ca octet brut (altfel fișierul devine binar pentru
// `grep`/`git grep`).

export interface AngajatPontaj {
  readonly id: string;
  readonly marca: string;
  readonly full_name: string;
  readonly department_id: string | null;
  readonly status: string;
}

export interface RezultatAngajatiPontaj {
  readonly randuri: readonly AngajatPontaj[];
  readonly urmatorulCursor: string | null;
}

interface CursorAngajat {
  readonly nume: string;
  readonly id: string;
}

function codificaCursor(cursor: CursorAngajat): string {
  return Buffer.from(`${cursor.nume}\u0000${cursor.id}`, "utf8").toString("base64url");
}

function decodificaCursor(valoare: string): CursorAngajat | null {
  try {
    const bucati = Buffer.from(valoare, "base64url").toString("utf8").split("\u0000");
    const nume = bucati[0];
    const id = bucati[1];
    if (nume === undefined || id === undefined || id.length === 0) return null;
    return { nume, id };
  } catch {
    return null;
  }
}

/** PostgREST desparte filtrele lui `or()` cu virgulă; valoarea trebuie citată. */
function ghilimeleaza(valoare: string): string {
  return `"${valoare.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

/**
 * Angajații paginați pentru foaia colectivă — NU pentru scope „own”: rolul
 * `employee` are `employees:read = none`, deci această interogare i-ar
 * întoarce 0 rânduri (pagina folosește `intrariProprii()` în locul ei).
 */
export async function listeazaAngajatiPontaj(
  organizationId: string,
  filtre: FiltrePontaj,
): Promise<RezultatAngajatiPontaj> {
  const db = await createServerSupabase();
  let interogare = db
    .from("employees")
    .select("id, marca, full_name, department_id, status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["activ", "suspendat", "preaviz"])
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .limit(filtre.limita + 1);

  if (filtre.cauta !== null) interogare = interogare.ilike("full_name", `%${filtre.cauta}%`);
  if (filtre.departament !== null) {
    interogare = interogare.eq("department_id", filtre.departament);
  }

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) {
      interogare = interogare.or(
        `full_name.gt.${ghilimeleaza(c.nume)},` +
          `and(full_name.eq.${ghilimeleaza(c.nume)},id.gt.${c.id})`,
      );
    }
  }

  const { data, error } = await interogare.returns<AngajatPontaj[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ nume: ultim.full_name, id: ultim.id })
        : null,
  };
}

export interface AngajatRezumatPontaj {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly department_id: string | null;
}

export async function angajatiPontajDupaId(
  organizationId: string,
  ids: readonly string[],
): Promise<ReadonlyMap<string, AngajatRezumatPontaj>> {
  const unice = [...new Set(ids)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca, department_id")
    .eq("organization_id", organizationId)
    .in("id", unice)
    .returns<AngajatRezumatPontaj[]>();
  if (error !== null) throw error;
  return new Map((data ?? []).map((a) => [a.id, a]));
}

// ── Intrările de pontaj ale unei luni ───────────────────────────────────────

export interface IntrarePontaj {
  readonly id: string;
  readonly employee_id: string;
  readonly data: string;
  readonly ora_inceput: string | null;
  readonly ora_sfarsit: string | null;
  readonly ore_lucrate: number;
  readonly ore_suplimentare: number;
  readonly ore_noapte: number;
  readonly tip_zi: TipZi;
  readonly sursa: SursaIntrare;
  readonly leave_request_id: string | null;
  readonly observatii: string | null;
  readonly approved_at: string | null;
  readonly batch_id: string | null;
}

const COLOANE_INTRARE =
  "id, employee_id, data, ora_inceput, ora_sfarsit, ore_lucrate, ore_suplimentare, " +
  "ore_noapte, tip_zi, sursa, leave_request_id, observatii, approved_at, batch_id";

export async function intrariLuna(
  organizationId: string,
  idAngajati: readonly string[],
  dataInceput: string,
  dataSfarsit: string,
): Promise<readonly IntrarePontaj[]> {
  if (idAngajati.length === 0) return [];

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_entries")
    .select(COLOANE_INTRARE)
    .eq("organization_id", organizationId)
    .in("employee_id", [...idAngajati])
    .gte("data", dataInceput)
    .lte("data", dataSfarsit)
    .is("deleted_at", null)
    .returns<IntrarePontaj[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Intrările lunii pentru scope „own”, FĂRĂ filtru pe `employee_id`: RLS
 * (`attendance_entries_select` → `app.poate_vedea_pontaj`) restrânge deja
 * rândurile la fișa proprie. Un `employee` are `employees:read = none`, deci
 * `listeazaAngajatiPontaj()` + `intrariLuna()` — care presupun citirea
 * prealabilă din `employees` — ar întoarce o listă goală pentru exact omul
 * care are nevoie de propria foaie (vezi capcane.md #10).
 */
export async function intrariProprii(
  organizationId: string,
  dataInceput: string,
  dataSfarsit: string,
): Promise<readonly IntrarePontaj[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_entries")
    .select(COLOANE_INTRARE)
    .eq("organization_id", organizationId)
    .gte("data", dataInceput)
    .lte("data", dataSfarsit)
    .is("deleted_at", null)
    .returns<IntrarePontaj[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Setările de pontaj ───────────────────────────────────────────────────────

export interface SetariPontaj {
  readonly ore_pe_zi: number;
  readonly ore_pe_saptamana: number;
  readonly ore_maxime_saptamanale: number;
  readonly pauza_masa_minute: number;
  readonly spor_suplimentare_procent: number;
  readonly spor_noapte_procent: number;
  readonly spor_weekend_procent: number;
  readonly spor_sarbatoare_procent: number;
}

/** Nu există seed pentru `attendance_settings` — `null` e normal, nu o eroare. */
export async function setariPontaj(
  organizationId: string,
  dataInceput: string,
): Promise<SetariPontaj | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_settings")
    .select(
      "ore_pe_zi, ore_pe_saptamana, ore_maxime_saptamanale, pauza_masa_minute, " +
        "spor_suplimentare_procent, spor_noapte_procent, spor_weekend_procent, spor_sarbatoare_procent",
    )
    .eq("organization_id", organizationId)
    .lte("valabil_de_la", dataInceput)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle<SetariPontaj>();
  if (error !== null) throw error;
  return data;
}

// ── Aprobarea ────────────────────────────────────────────────────────────────

export interface LotAprobare {
  readonly id: string;
  readonly department_id: string | null;
  readonly manager_employee_id: string | null;
  readonly aprobat_de: string | null;
  readonly aprobat_la: string;
  readonly linii_aprobate: number;
  readonly observatii: string | null;
}

export async function loturiPerioadei(
  organizationId: string,
  periodId: string,
): Promise<readonly LotAprobare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_approval_batches")
    .select(
      "id, department_id, manager_employee_id, aprobat_de, aprobat_la, linii_aprobate, observatii",
    )
    .eq("organization_id", organizationId)
    .eq("period_id", periodId)
    .is("deleted_at", null)
    .order("aprobat_la", { ascending: false })
    .returns<LotAprobare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface LinieDeAprobat {
  readonly id: string;
  readonly employee_id: string;
  readonly data: string;
  readonly ore_lucrate: number;
}

export async function liniiDeAprobat(
  organizationId: string,
  periodId: string,
): Promise<readonly LinieDeAprobat[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_entries")
    .select("id, employee_id, data, ore_lucrate")
    .eq("organization_id", organizationId)
    .eq("period_id", periodId)
    .is("approved_at", null)
    .is("deleted_at", null)
    .returns<LinieDeAprobat[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Departamente (pentru filtru — 0 rânduri ⇒ ascunde-l în UI) ──────────────

export interface DepartamentPontaj {
  readonly id: string;
  readonly denumire: string;
}

export async function departamente(organizationId: string): Promise<readonly DepartamentPontaj[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("departments")
    .select("id, denumire")
    .eq("organization_id", organizationId)
    .eq("activ", true)
    .is("deleted_at", null)
    .order("denumire", { ascending: true })
    .returns<DepartamentPontaj[]>();
  if (error !== null) throw error;
  return data ?? [];
}
