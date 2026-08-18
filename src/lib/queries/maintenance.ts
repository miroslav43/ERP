// src/lib/queries/maintenance.ts
// Citirile modulului de mentenanță. Ca la flotă și inventar, NU se adaugă
// niciun filtru de scope (own/team/all): politicile RLS din 0011_ssm.sql
// (funcția `app.ssm_acces`) restrâng rândurile direct în Postgres.
//
// Politicile SELECT din 0011 NU conțin `deleted_at is null` — fiecare
// interogare de mai jos îl adaugă explicit, altfel listele ar arăta rânduri
// șterse logic.

import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  FiltreEchipamente,
  FiltreInterventii,
  FiltreSesizari,
  RezultatInterventie,
  StatusEchipament,
  StatusSesizare,
  TipContor,
  TipMentenanta,
  UrgentaSesizare,
} from "@/schemas/maintenance";

// ── Cursorul keyset ─────────────────────────────────────────────────────────
//
// Separatorul e scris ca SECVENȚĂ DE EVADARE, nu ca octet brut — un octet nul
// literal ar transforma fișierul în binar pentru `grep` și `git grep`.

interface CursorText {
  readonly cheie: string;
  readonly id: string;
}

function codificaCursor(cursor: CursorText): string {
  return Buffer.from(`${cursor.cheie}\u0000${cursor.id}`, "utf8").toString("base64url");
}

function decodificaCursor(valoare: string): CursorText | null {
  try {
    const bucati = Buffer.from(valoare, "base64url").toString("utf8").split("\u0000");
    const cheie = bucati[0];
    const id = bucati[1];
    if (cheie === undefined || id === undefined || id.length === 0) return null;
    return { cheie, id };
  } catch {
    return null;
  }
}

/** PostgREST desparte filtrele lui `or()` cu virgulă; valoarea trebuie citată. */
function ghilimeleaza(valoare: string): string {
  return `"${valoare.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

// ── Tipuri de rând ──────────────────────────────────────────────────────────

export interface RandEchipament {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly serie: string | null;
  readonly producator: string | null;
  readonly model: string | null;
  readonly an_fabricatie: number | null;
  readonly locatie: string | null;
  readonly department_id: string | null;
  readonly responsabil_employee_id: string | null;
  readonly status: StatusEchipament;
  readonly este_iscir: boolean;
  readonly tip_autorizare_necesara: string | null;
  readonly data_punerii_in_functiune: string | null;
}

export interface RezultatEchipamente {
  readonly randuri: readonly RandEchipament[];
  readonly urmatorulCursor: string | null;
}

export interface Echipament extends RandEchipament {
  readonly valoare_achizitie: number | null;
  readonly derogare_motiv: string | null;
  readonly derogare_acordata_de: string | null;
  readonly derogare_acordata_la: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CitireContor {
  readonly id: string;
  readonly tip: TipContor;
  readonly citire: number;
  readonly data_citirii: string;
  readonly resetare_contor: boolean;
  readonly sursa: string;
  readonly citit_de_employee_id: string | null;
  readonly observatii: string | null;
}

export interface PlanMentenanta {
  readonly id: string;
  readonly equipment_id: string;
  readonly denumire: string;
  readonly tip: TipMentenanta;
  readonly periodicitate_zile: number | null;
  readonly periodicitate_contor: number | null;
  readonly tip_contor: TipContor | null;
  readonly ultima_executie: string | null;
  readonly ultima_citire_contor: number | null;
  readonly urmatoarea_scadenta: string | null;
  readonly urmatoarea_scadenta_contor: number | null;
  readonly responsabil_employee_id: string | null;
  readonly instructiuni: string | null;
  readonly activ: boolean;
}

export interface RandInterventie {
  readonly id: string;
  readonly plan_id: string | null;
  readonly equipment_id: string;
  readonly tip: TipMentenanta;
  readonly data: string;
  readonly ora_start: string | null;
  readonly durata_ore: number | null;
  readonly executant_employee_id: string | null;
  readonly executant_extern: string | null;
  readonly descriere: string;
  readonly piese: string | null;
  readonly cost_piese: number;
  readonly cost_manopera: number;
  readonly cost_total: number | null;
  readonly rezultat: RezultatInterventie;
  readonly oprire_minute: number | null;
  readonly citire_contor: number | null;
  readonly observatii: string | null;
}

export interface RezultatInterventii {
  readonly randuri: readonly RandInterventie[];
  readonly urmatorulCursor: string | null;
}

export interface RandSesizare {
  readonly id: string;
  readonly equipment_id: string;
  readonly raportat_de_employee_id: string | null;
  readonly descriere: string;
  readonly urgenta: UrgentaSesizare;
  readonly status: StatusSesizare;
  readonly raportat_la: string;
  readonly opreste_functionarea: boolean;
  readonly intervention_id: string | null;
  readonly rezolvat_la: string | null;
  readonly motiv_respingere: string | null;
}

export interface RezultatSesizari {
  readonly randuri: readonly RandSesizare[];
  readonly urmatorulCursor: string | null;
}

export interface AutorizatieIscir {
  readonly id: string;
  readonly equipment_id: string;
  readonly numar: string;
  readonly tip: string;
  readonly emitent: string;
  readonly emis_la: string | null;
  readonly valabil_pana: string;
  readonly scadenta_verificare_tehnica: string | null;
  readonly conditii: string | null;
  readonly suspendata_la: string | null;
}

export interface AngajatAutorizat {
  readonly employee_id: string;
  readonly tip: string;
  readonly numar: string;
  readonly valabil_pana: string;
}

export interface AngajatRezumat {
  readonly id: string;
  readonly full_name: string | null;
}

const COLOANE_ECHIPAMENT_LISTA =
  "id, cod, denumire, serie, producator, model, an_fabricatie, locatie, department_id, " +
  "responsabil_employee_id, status, este_iscir, tip_autorizare_necesara, data_punerii_in_functiune";

const COLOANE_INTERVENTIE =
  "id, plan_id, equipment_id, tip, data, ora_start, durata_ore, executant_employee_id, " +
  "executant_extern, descriere, piese, cost_piese, cost_manopera, cost_total, rezultat, " +
  "oprire_minute, citire_contor, observatii";

const COLOANE_SESIZARE =
  "id, equipment_id, raportat_de_employee_id, descriere, urgenta, status, raportat_la, " +
  "opreste_functionarea, intervention_id, rezolvat_la, motiv_respingere";

// ── Echipamente ──────────────────────────────────────────────────────────

export async function listeazaEchipamente(
  organizationId: string,
  filtre: FiltreEchipamente,
): Promise<RezultatEchipamente> {
  const db = await createServerSupabase();

  let interogare = db
    .from("equipment")
    .select(COLOANE_ECHIPAMENT_LISTA)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    // Ordinea urmează indexul unic `equipment_uq` (organization_id, cod).
    .order("cod", { ascending: true })
    .order("id", { ascending: true })
    .limit(filtre.limita + 1);

  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);
  if (filtre.cauta !== null) {
    const termen = filtre.cauta.replace(/[,()*"]/gu, "");
    interogare = interogare.or(`cod.ilike.%${termen}%,denumire.ilike.%${termen}%`);
  }

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    // Un cursor stricat înseamnă prima pagină, nu o eroare.
    if (c !== null) {
      interogare = interogare.or(
        `cod.gt.${ghilimeleaza(c.cheie)},and(cod.eq.${ghilimeleaza(c.cheie)},id.gt.${c.id})`,
      );
    }
  }

  const { data, error } = await interogare.returns<RandEchipament[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ cheie: ultim.cod, id: ultim.id })
        : null,
  };
}

export async function citesteEchipament(
  organizationId: string,
  id: string,
): Promise<Echipament | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment")
    .select(
      `${COLOANE_ECHIPAMENT_LISTA}, valoare_achizitie, derogare_motiv, derogare_acordata_de, ` +
        "derogare_acordata_la, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Echipament>();

  if (error !== null) throw error;
  return data;
}

export async function echipamenteDupaId(
  organizationId: string,
  ids: readonly string[],
): Promise<ReadonlyMap<string, RandEchipament>> {
  const unice = [...new Set(ids)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment")
    .select(COLOANE_ECHIPAMENT_LISTA)
    .eq("organization_id", organizationId)
    .in("id", unice)
    .is("deleted_at", null)
    .returns<RandEchipament[]>();

  if (error !== null) throw error;
  return new Map((data ?? []).map((e) => [e.id, e]));
}

// ── Contoare ────────────────────────────────────────────────────────────

export async function contoareEchipament(equipmentId: string): Promise<readonly CitireContor[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment_meters")
    .select(
      "id, tip, citire, data_citirii, resetare_contor, sursa, citit_de_employee_id, observatii",
    )
    .eq("equipment_id", equipmentId)
    .is("deleted_at", null)
    .order("data_citirii", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<CitireContor[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Planuri de mentenanță ──────────────────────────────────────────────────

const COLOANE_PLAN =
  "id, equipment_id, denumire, tip, periodicitate_zile, periodicitate_contor, tip_contor, " +
  "ultima_executie, ultima_citire_contor, urmatoarea_scadenta, urmatoarea_scadenta_contor, " +
  "responsabil_employee_id, instructiuni, activ";

export async function planuriEchipament(equipmentId: string): Promise<readonly PlanMentenanta[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("maintenance_plans")
    .select(COLOANE_PLAN)
    .eq("equipment_id", equipmentId)
    .is("deleted_at", null)
    .order("denumire", { ascending: true })
    .returns<PlanMentenanta[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/** Planurile ACTIVE ale organizației, sortate cu cea mai apropiată scadență prima. */
export async function planuriScadente(organizationId: string): Promise<readonly PlanMentenanta[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("maintenance_plans")
    .select(COLOANE_PLAN)
    .eq("organization_id", organizationId)
    .eq("activ", true)
    .is("deleted_at", null)
    .order("urmatoarea_scadenta", { ascending: true, nullsFirst: false })
    .limit(500)
    .returns<PlanMentenanta[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Intervenții ──────────────────────────────────────────────────────────

export async function interventii(
  organizationId: string,
  filtre: FiltreInterventii,
): Promise<RezultatInterventii> {
  const db = await createServerSupabase();

  let interogare = db
    .from("maintenance_interventions")
    .select(COLOANE_INTERVENTIE)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("data", { ascending: false })
    .order("id", { ascending: false })
    .limit(filtre.limita + 1);

  if (filtre.tip !== null) interogare = interogare.eq("tip", filtre.tip);
  if (filtre.rezultat !== null) interogare = interogare.eq("rezultat", filtre.rezultat);
  if (filtre.echipament !== null) interogare = interogare.eq("equipment_id", filtre.echipament);

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) {
      interogare = interogare.or(
        `data.lt.${ghilimeleaza(c.cheie)},and(data.eq.${ghilimeleaza(c.cheie)},id.lt.${c.id})`,
      );
    }
  }

  const { data, error } = await interogare.returns<RandInterventie[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ cheie: ultim.data, id: ultim.id })
        : null,
  };
}

// ── Sesizări ────────────────────────────────────────────────────────────

export async function sesizari(
  organizationId: string,
  filtre: FiltreSesizari,
): Promise<RezultatSesizari> {
  const db = await createServerSupabase();

  let interogare = db
    .from("fault_reports")
    .select(COLOANE_SESIZARE)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("raportat_la", { ascending: false })
    .order("id", { ascending: false })
    .limit(filtre.limita + 1);

  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);
  if (filtre.urgenta !== null) interogare = interogare.eq("urgenta", filtre.urgenta);
  if (filtre.echipament !== null) interogare = interogare.eq("equipment_id", filtre.echipament);

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) {
      interogare = interogare.or(
        `raportat_la.lt.${ghilimeleaza(c.cheie)},and(raportat_la.eq.${ghilimeleaza(c.cheie)},id.lt.${c.id})`,
      );
    }
  }

  const { data, error } = await interogare.returns<RandSesizare[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ cheie: ultim.raportat_la, id: ultim.id })
        : null,
  };
}

export async function citesteSesizare(
  organizationId: string,
  id: string,
): Promise<RandSesizare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fault_reports")
    .select(COLOANE_SESIZARE)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandSesizare>();

  if (error !== null) throw error;
  return data;
}

// ── Autorizații ISCIR ──────────────────────────────────────────────────────

export async function autorizatiiIscir(
  organizationId: string,
  equipmentId?: string,
): Promise<readonly AutorizatieIscir[]> {
  const db = await createServerSupabase();
  let interogare = db
    .from("iscir_authorizations")
    .select(
      "id, equipment_id, numar, tip, emitent, emis_la, valabil_pana, " +
        "scadenta_verificare_tehnica, conditii, suspendata_la",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("valabil_pana", { ascending: true });

  if (equipmentId !== undefined) interogare = interogare.eq("equipment_id", equipmentId);

  const { data, error } = await interogare.returns<AutorizatieIscir[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Angajații cu autorizație nominală valabilă pe tipul cerut — alimentează
 * selectorul de responsabil pe echipamente ISCIR.
 *
 * `personnel_authorizations` e sub feature „ssm”, nu „maintenance” (0011,
 * §11): apelantul TREBUIE să verifice `getEnabledFeatures(org).has("ssm")`
 * înainte de a chema funcția — altfel, într-o organizație fără modulul SSM
 * activ, `app.feature_on(org,'ssm')` face ca politica SELECT să întoarcă
 * tăcut zero rânduri, iar formularul ar părea stricat, nu explicat.
 */
export async function angajatiAutorizati(
  organizationId: string,
  tipAutorizare: string,
): Promise<readonly AngajatAutorizat[]> {
  const db = await createServerSupabase();
  const azi = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("personnel_authorizations")
    .select("employee_id, tip, numar, valabil_pana")
    .eq("organization_id", organizationId)
    .eq("tip", tipAutorizare)
    .is("suspendata_la", null)
    .gte("valabil_pana", azi)
    .is("deleted_at", null)
    .returns<AngajatAutorizat[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Angajați (lookup simplu, pentru afișare) ────────────────────────────────

export async function angajatiDupaId(
  organizationId: string,
  ids: readonly string[],
): Promise<ReadonlyMap<string, AngajatRezumat>> {
  const unice = [...new Set(ids)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .in("id", unice)
    .returns<AngajatRezumat[]>();

  if (error !== null) throw error;
  return new Map((data ?? []).map((a) => [a.id, a]));
}

// ── Badge de navigare ────────────────────────────────────────────────────

/**
 * Numărul de scadențe de mentenanță pentru badge-ul „maintenance_due” din
 * meniu (`config/navigation.ts`).
 *
 * Simplificare asumată: contorizează planurile active scadente pe ZILE în
 * următoarele `pragZile` zile (sau deja depășite) și autorizațiile ISCIR
 * nesuspendate care expiră în același interval. Scadența pe CONTOR nu intră
 * în numărătoare — necesită, per plan, ultima citire cunoscută a fiecărui
 * contor, adică un calcul pe rând, nu un simplu `count`; ecranul
 * `/mentenanta` afișează starea exactă (zile ȘI contor) pentru fiecare plan.
 */
export async function numarScadenteMentenanta(
  organizationId: string,
  pragZile: number,
): Promise<number> {
  const db = await createServerSupabase();
  const limita = new Date();
  limita.setUTCDate(limita.getUTCDate() + pragZile);
  const limitaText = limita.toISOString().slice(0, 10);

  const [planuriRes, iscirRes] = await Promise.all([
    db
      .from("maintenance_plans")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .not("urmatoarea_scadenta", "is", null)
      .lte("urmatoarea_scadenta", limitaText),
    db
      .from("iscir_authorizations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .is("suspendata_la", null)
      .lte("valabil_pana", limitaText),
  ]);

  if (planuriRes.error !== null) throw planuriRes.error;
  if (iscirRes.error !== null) throw iscirRes.error;

  return (planuriRes.count ?? 0) + (iscirRes.count ?? 0);
}
