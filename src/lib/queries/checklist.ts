// src/lib/queries/checklist.ts
// Citirile modulului de onboarding: instanțe, pași, dovada de parcurgere,
// șabloane. NU se filtrează după scope (own/team/all) în cod: politicile din
// 0014_checklist.sql restrâng rândurile direct în Postgres.

import { createServerSupabase } from "@/lib/supabase/server";
import type {
  ChecklistInstantaStatus,
  ChecklistItemStatus,
  ChecklistResponsabilTip,
  ChecklistTip,
  ChecklistTipDovada,
  ChecklistVerificare,
  FiltreInstante,
  FiltreSabloane,
  RolResponsabil,
} from "@/schemas/checklist";

// ── Cursorul keyset ─────────────────────────────────────────────────────────
//
// Separatorul e scris ca SECVENȚĂ DE EVADARE, nu ca octet brut — scris brut,
// fișierul devine binar pentru `grep` și `git grep` (vezi queries/fleet.ts).
// Două perechi distincte: (data_referinta, id) DESC pentru instanțe,
// (denumire, id) ASC pentru șabloane — nu se pot amesteca într-un tip comun,
// fiindcă direcția de comparație diferă.

interface CursorInstante {
  readonly data: string;
  readonly id: string;
}

function codificaCursorInstante(cursor: CursorInstante): string {
  return Buffer.from(`${cursor.data}\u0000${cursor.id}`, "utf8").toString("base64url");
}

function decodificaCursorInstante(valoare: string): CursorInstante | null {
  try {
    const bucati = Buffer.from(valoare, "base64url").toString("utf8").split("\u0000");
    const data = bucati[0];
    const id = bucati[1];
    if (data === undefined || id === undefined || id.length === 0) return null;
    return { data, id };
  } catch {
    return null;
  }
}

interface CursorText {
  readonly cheie: string;
  readonly id: string;
}

function codificaCursorText(cursor: CursorText): string {
  return Buffer.from(`${cursor.cheie}\u0000${cursor.id}`, "utf8").toString("base64url");
}

function decodificaCursorText(valoare: string): CursorText | null {
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

// ── Instanțe ───────────────────────────────────────────────────────────────

export interface RandInstanta {
  readonly id: string;
  readonly template_id: string;
  readonly employee_id: string;
  readonly tip: ChecklistTip;
  readonly data_referinta: string;
  readonly status: ChecklistInstantaStatus;
  readonly ciclu: number;
  readonly finalizata_la: string | null;
  readonly anulata_la: string | null;
  readonly created_at: string;
}

export interface RezultatInstante {
  readonly randuri: readonly RandInstanta[];
  readonly urmatorulCursor: string | null;
}

const COLOANE_INSTANTA =
  "id, template_id, employee_id, tip, data_referinta, status, ciclu, finalizata_la, anulata_la, created_at";

export async function listeazaInstante(
  organizationId: string,
  filtre: FiltreInstante,
): Promise<RezultatInstante> {
  const db = await createServerSupabase();

  let interogare = db
    .from("checklist_instances")
    .select(COLOANE_INSTANTA)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("data_referinta", { ascending: false })
    .order("id", { ascending: false })
    .limit(filtre.limita + 1);

  if (filtre.tip !== null) interogare = interogare.eq("tip", filtre.tip);
  if (filtre.status !== null && filtre.status.length > 0) {
    interogare = interogare.in("status", filtre.status);
  }
  if (filtre.angajat !== null) interogare = interogare.eq("employee_id", filtre.angajat);
  if (filtre.de_la !== null) interogare = interogare.gte("data_referinta", filtre.de_la);
  if (filtre.pana_la !== null) interogare = interogare.lte("data_referinta", filtre.pana_la);

  if (filtre.cursor !== null) {
    const c = decodificaCursorInstante(filtre.cursor);
    // Un cursor stricat înseamnă prima pagină, nu o eroare.
    if (c !== null) {
      interogare = interogare.or(
        `data_referinta.lt.${c.data},and(data_referinta.eq.${c.data},id.lt.${c.id})`,
      );
    }
  }

  const { data, error } = await interogare.returns<RandInstanta[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursorInstante({ data: ultim.data_referinta, id: ultim.id })
        : null,
  };
}

export interface InstantaDetaliu extends RandInstanta {
  readonly observatii: string | null;
  readonly finalizata_de: string | null;
  readonly motiv_anulare: string | null;
  readonly updated_at: string;
}

export async function citesteInstanta(
  organizationId: string,
  id: string,
): Promise<InstantaDetaliu | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("checklist_instances")
    .select(`${COLOANE_INSTANTA}, observatii, finalizata_de, motiv_anulare, updated_at`)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<InstantaDetaliu>();

  if (error !== null) throw error;
  return data;
}

/**
 * Progresul unui grup de instanțe, pentru semaforul din listă.
 *
 * `max_rows = 1000` în `supabase/config.toml`: PostgREST trunchiază tăcut
 * peste 1000 de rânduri. Se citește în buclă, cu `.range()`, cât timp vine
 * exact o pagină plină, plafonat la 10 iterații (10 000 de pași — suficient
 * pentru orice grup de instanțe afișat pe o pagină).
 */
export interface ProgresInstanta {
  readonly total: number;
  readonly gata: number;
  readonly procent: number;
}

const MARIME_PAGINA_PROGRES = 1000;
const MAX_ITERATII_PROGRES = 10;

interface RandProgresBrut {
  readonly instance_id: string;
  readonly status: ChecklistItemStatus;
  readonly obligatoriu: boolean;
}

export async function progresInstante(
  idInstante: readonly string[],
): Promise<ReadonlyMap<string, ProgresInstanta>> {
  const unice = [...new Set(idInstante)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const randuri: RandProgresBrut[] = [];

  for (let iteratie = 0; iteratie < MAX_ITERATII_PROGRES; iteratie += 1) {
    const start = iteratie * MARIME_PAGINA_PROGRES;
    const { data, error } = await db
      .from("checklist_instance_items")
      .select("instance_id, status, obligatoriu")
      .in("instance_id", unice)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(start, start + MARIME_PAGINA_PROGRES - 1)
      .returns<RandProgresBrut[]>();
    if (error !== null) throw error;

    const pagina = data ?? [];
    randuri.push(...pagina);
    if (pagina.length < MARIME_PAGINA_PROGRES) break;
  }

  const acumulator = new Map<string, { total: number; gata: number }>();
  for (const rand of randuri) {
    const curent = acumulator.get(rand.instance_id) ?? { total: 0, gata: 0 };
    const esteGata = rand.status === "bifat" || rand.status === "neaplicabil";
    acumulator.set(rand.instance_id, {
      total: curent.total + 1,
      gata: curent.gata + (esteGata ? 1 : 0),
    });
  }

  return new Map(
    [...acumulator].map(([id, v]) => [
      id,
      { total: v.total, gata: v.gata, procent: v.total === 0 ? 0 : Math.round((100 * v.gata) / v.total) },
    ]),
  );
}

// ── Pașii instanței ─────────────────────────────────────────────────────────

export interface PasInstanta {
  readonly id: string;
  readonly ordine: number;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly responsabil_tip: ChecklistResponsabilTip;
  readonly responsabil_rol: RolResponsabil | null;
  readonly responsabil_employee_id: string | null;
  readonly termen: string | null;
  readonly obligatoriu: boolean;
  readonly tip_dovada: ChecklistTipDovada;
  readonly verificare_automata: ChecklistVerificare | null;
  readonly status: ChecklistItemStatus;
  readonly bifat_de: string | null;
  readonly bifat_la: string | null;
  readonly bifat_automat: boolean;
  readonly dovada: string | null;
  readonly dovada_document_id: string | null;
  readonly observatii: string | null;
}

export async function pasiiInstantei(
  organizationId: string,
  instanceId: string,
): Promise<readonly PasInstanta[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("checklist_instance_items")
    .select(
      "id, ordine, titlu, descriere, responsabil_tip, responsabil_rol, responsabil_employee_id, " +
        "termen, obligatoriu, tip_dovada, verificare_automata, status, bifat_de, bifat_la, " +
        "bifat_automat, dovada, dovada_document_id, observatii",
    )
    .eq("organization_id", organizationId)
    .eq("instance_id", instanceId)
    .is("deleted_at", null)
    .order("ordine", { ascending: true })
    .returns<PasInstanta[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Bunurile nereturnate (offboarding) ──────────────────────────────────────

export interface BunNereturnat {
  readonly id: string;
  readonly predat_la: string;
  readonly item: Readonly<{
    readonly id: string;
    readonly denumire: string;
    readonly numar_inventar: string;
  }>;
}

/**
 * Vizibilitate pe Inventar dată explicit de politicile din 0014
 * (`inventory_allocations_select_checklist` / `inventory_items_select_checklist`)
 * cui are `checklists:update ≥ team` — fără nevoie de `inventory:read`.
 * `.returns<T>()` e obligatoriu: embed-ul `item:inventory_items!item_id(...)`
 * nu se tipează singur.
 */
export async function bunuriNereturnate(
  organizationId: string,
  employeeId: string,
): Promise<readonly BunNereturnat[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_allocations")
    .select("id, predat_la, item:inventory_items!item_id(id, denumire, numar_inventar)")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("returnat_la", null)
    .is("deleted_at", null)
    .returns<BunNereturnat[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Dovada de parcurgere ─────────────────────────────────────────────────────

export interface DovadaParcurgere {
  readonly id: string;
  readonly instance_id: string;
  readonly employee_id: string;
  readonly tip: ChecklistTip;
  readonly ciclu: number;
  readonly finalizata_la: string;
  readonly finalizat_de: string | null;
  readonly total_pasi: number;
  readonly pasi_bifati: number;
  readonly pasi_obligatorii: number;
  readonly continut: unknown;
  readonly continut_checksum: string;
}

/** `checklist_completion_records` NU are `deleted_at` — un filtru pe ea ar da 42703. */
export async function dovadaParcurgerii(
  organizationId: string,
  instanceId: string,
): Promise<DovadaParcurgere | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("checklist_completion_records")
    .select(
      "id, instance_id, employee_id, tip, ciclu, finalizata_la, finalizat_de, total_pasi, " +
        "pasi_bifati, pasi_obligatorii, continut, continut_checksum",
    )
    .eq("organization_id", organizationId)
    .eq("instance_id", instanceId)
    .maybeSingle<DovadaParcurgere>();

  if (error !== null) throw error;
  return data;
}

// ── Șabloane ───────────────────────────────────────────────────────────────

export interface RandSablon {
  readonly id: string;
  readonly denumire: string;
  readonly tip: ChecklistTip;
  readonly descriere: string | null;
  readonly department_id: string | null;
  readonly job_position_id: string | null;
  readonly activ: boolean;
  readonly valabil_de_la: string;
  readonly valabil_pana_la: string | null;
}

export interface RezultatSabloane {
  readonly randuri: readonly RandSablon[];
  readonly urmatorulCursor: string | null;
}

const COLOANE_SABLON =
  "id, denumire, tip, descriere, department_id, job_position_id, activ, valabil_de_la, valabil_pana_la";

export async function listeazaSabloane(
  organizationId: string,
  filtre: FiltreSabloane,
): Promise<RezultatSabloane> {
  const db = await createServerSupabase();

  let interogare = db
    .from("checklist_templates")
    .select(COLOANE_SABLON)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("denumire", { ascending: true })
    .order("id", { ascending: true })
    .limit(filtre.limita + 1);

  if (filtre.tip !== null) interogare = interogare.eq("tip", filtre.tip);
  if (filtre.cauta !== null) interogare = interogare.ilike("denumire", `%${filtre.cauta}%`);

  if (filtre.cursor !== null) {
    const c = decodificaCursorText(filtre.cursor);
    if (c !== null) {
      interogare = interogare.or(
        `denumire.gt.${ghilimeleaza(c.cheie)},` +
          `and(denumire.eq.${ghilimeleaza(c.cheie)},id.gt.${c.id})`,
      );
    }
  }

  const { data, error } = await interogare.returns<RandSablon[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursorText({ cheie: ultim.denumire, id: ultim.id })
        : null,
  };
}

export async function citesteSablon(
  organizationId: string,
  id: string,
): Promise<RandSablon | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("checklist_templates")
    .select(COLOANE_SABLON)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandSablon>();

  if (error !== null) throw error;
  return data;
}

export interface SablonOptiune {
  readonly id: string;
  readonly denumire: string;
  readonly tip: ChecklistTip;
}

/**
 * Șabloanele active, pentru selectorul din „Instanță nouă”.
 *
 * Fără filtru pe `valabil_de_la`/`valabil_pana_la`: triggerul
 * `internal.checklist_pregateste_instanta` verifică DOAR `activ`, nu
 * intervalul de valabilitate — a filtra mai strict aici ar ascunde șabloane
 * pe care baza chiar le acceptă.
 */
export async function sabloaneActive(organizationId: string): Promise<readonly SablonOptiune[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("checklist_templates")
    .select("id, denumire, tip")
    .eq("organization_id", organizationId)
    .eq("activ", true)
    .is("deleted_at", null)
    .order("denumire", { ascending: true })
    .limit(200)
    .returns<SablonOptiune[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export interface PasSablon {
  readonly id: string;
  readonly ordine: number;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly responsabil_tip: ChecklistResponsabilTip;
  readonly responsabil_rol: RolResponsabil | null;
  readonly responsabil_employee_id: string | null;
  readonly termen_zile_relativ: number;
  readonly obligatoriu: boolean;
  readonly tip_dovada: ChecklistTipDovada;
  readonly verificare_automata: ChecklistVerificare | null;
}

export async function pasiiSablonului(
  organizationId: string,
  templateId: string,
): Promise<readonly PasSablon[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("checklist_template_items")
    .select(
      "id, ordine, titlu, descriere, responsabil_tip, responsabil_rol, responsabil_employee_id, " +
        "termen_zile_relativ, obligatoriu, tip_dovada, verificare_automata",
    )
    .eq("organization_id", organizationId)
    .eq("template_id", templateId)
    .is("deleted_at", null)
    .order("ordine", { ascending: true })
    .returns<PasSablon[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Angajați, pentru afișare și formulare ──────────────────────────────────

export interface AngajatRezumat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * Numele angajaților, citite separat de instanțe/pași — nu prin embed.
 *
 * Un rol cu `checklists:update ≥ team` (manager) nu are neapărat
 * `employees:read`; un embed refuzat de RLS ar veni NULL fără nicio eroare.
 * Apelantul decide dacă are dreptul de a citi (`employees:read ≥ team`)
 * ÎNAINTE de a chema funcția asta.
 */
export async function angajatiDupaId(
  organizationId: string,
  ids: readonly string[],
): Promise<ReadonlyMap<string, AngajatRezumat>> {
  const unice = [...new Set(ids)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .in("id", unice)
    .returns<AngajatRezumat[]>();

  if (error !== null) throw error;
  return new Map((data ?? []).map((a) => [a.id, a]));
}

export async function angajatiActivi(
  organizationId: string,
): Promise<readonly AngajatRezumat[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .limit(500)
    .returns<AngajatRezumat[]>();

  if (error !== null) throw error;
  return data ?? [];
}
