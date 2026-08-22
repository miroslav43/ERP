// src/lib/queries/leave.ts
// Citirile modulului de concedii: cereri, zile, lanț de aprobare, sold, calendar.
//
// NU folosește niciodată `createAdminSupabase()` — ESLint îl interzice aici, și
// pe bună dreptate: fiecare interogare trece prin RLS. Pentru scope „own” NU se
// filtrează după `employee_id`: politica `leave_requests_select` (și surorile
// ei) îl rezolvă singură, prin `app.current_employee_id(organization_id)`.

import { createServerSupabase } from "@/lib/supabase/server";
import type { PermissionScope } from "@/config/permissions";
import type {
  CriteriuGrila,
  EvenimentSold,
  FiltreCereri,
  ModRotunjireAcumulare,
  PortiuneZi,
  StatusCerere,
  StatusSarcinaAprobare,
  TipZiOrganizatie,
} from "@/schemas/leave";

// ── Cursor keyset (pereche proprie: dată + id, descrescător) ─────────────────
//
// Codul este o copie intenționată a tiparului din `queries/employees.ts`, nu
// un import: cheia de sortare e altă pereche de coloane, iar fișierul acela
// nu se atinge (lucrează alt agent pe inventar în paralel).

interface CursorCereri {
  readonly data: string;
  readonly id: string;
}

function codificaCursorCereri(cursor: CursorCereri): string {
  return Buffer.from(`${cursor.data}\u0000${cursor.id}`, "utf8").toString("base64url");
}

function decodificaCursorCereri(valoare: string): CursorCereri | null {
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

// ── Listarea cererilor ────────────────────────────────────────────────────────

export interface RandCerere {
  readonly id: string;
  readonly employee_id: string;
  readonly leave_type_id: string;
  readonly data_inceput: string;
  readonly data_sfarsit: string;
  readonly portiune_inceput: PortiuneZi;
  readonly portiune_sfarsit: PortiuneZi;
  readonly zile_lucratoare: number;
  readonly zile_calendaristice: number;
  readonly status: StatusCerere;
  readonly trimisa_la: string | null;
  readonly decis_la: string | null;
  readonly created_at: string;
}

export interface RezultatCereri {
  readonly randuri: readonly RandCerere[];
  readonly urmatorulCursor: string | null;
}

const COLOANE_CERERE =
  "id, employee_id, leave_type_id, data_inceput, data_sfarsit, portiune_inceput, portiune_sfarsit, zile_lucratoare, zile_calendaristice, status, trimisa_la, decis_la, created_at";

export async function listeazaCereri(
  organizationId: string,
  scope: PermissionScope,
  filtre: FiltreCereri,
  /**
   * Fișa proprie a celui care se uită. `null` pentru un cont fără fișă de
   * angajat — un administrator invitat, de exemplu. Atunci „mele” n-ar avea ce
   * selecta, iar „echipa” e tot ce se vede, deci filtrul se ignoră.
   */
  fisaMea: string | null = null,
): Promise<RezultatCereri> {
  const db = await createServerSupabase();
  let interogare = db
    .from("leave_requests")
    .select(COLOANE_CERERE)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("data_inceput", { ascending: false })
    .order("id", { ascending: false })
    .limit(filtre.limita + 1);

  if (fisaMea !== null && filtre.vizualizare === "mele") {
    interogare = interogare.eq("employee_id", fisaMea);
  } else if (fisaMea !== null && filtre.vizualizare === "echipa") {
    interogare = interogare.neq("employee_id", fisaMea);
  }
  if (filtre.status !== null && filtre.status.length > 0) {
    interogare = interogare.in("status", filtre.status);
  }
  if (filtre.leave_type_id !== null) {
    interogare = interogare.eq("leave_type_id", filtre.leave_type_id);
  }
  if (filtre.de_la !== null) {
    interogare = interogare.gte("data_sfarsit", filtre.de_la);
  }
  if (filtre.pana_la !== null) {
    interogare = interogare.lte("data_inceput", filtre.pana_la);
  }
  // Filtrul explicit după angajat are sens doar pentru cine vede mai mult decât
  // fișa proprie — pentru „own”, RLS restrânge deja rezultatul la un singur angajat.
  if (scope !== "own" && filtre.employee_id !== null) {
    interogare = interogare.eq("employee_id", filtre.employee_id);
  }

  const cursor = filtre.cursor === null ? null : decodificaCursorCereri(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(
      `data_inceput.lt.${cursor.data},and(data_inceput.eq.${cursor.data},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await interogare.returns<RandCerere[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultimul = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultimul !== undefined
        ? codificaCursorCereri({ data: ultimul.data_inceput, id: ultimul.id })
        : null,
  };
}

// ── Fișa unei cereri ──────────────────────────────────────────────────────────

export interface CerereDetaliu {
  readonly id: string;
  readonly employee_id: string;
  readonly leave_type_id: string;
  readonly data_inceput: string;
  readonly data_sfarsit: string;
  readonly portiune_inceput: PortiuneZi;
  readonly portiune_sfarsit: PortiuneZi;
  readonly zile_lucratoare: number;
  readonly zile_calendaristice: number;
  readonly status: StatusCerere;
  readonly motiv: string | null;
  readonly atasament_path: string | null;
  readonly motiv_respingere: string | null;
  readonly decis_de: string | null;
  readonly flow_id: string | null;
  readonly pas_curent: number;
  readonly trimisa_la: string | null;
  readonly decis_la: string | null;
  readonly created_at: string;
}

const COLOANE_CERERE_DETALIU =
  "id, employee_id, leave_type_id, data_inceput, data_sfarsit, portiune_inceput, portiune_sfarsit, zile_lucratoare, zile_calendaristice, status, motiv, atasament_path, motiv_respingere, decis_de, flow_id, pas_curent, trimisa_la, decis_la, created_at";

export async function citesteCerere(
  organizationId: string,
  cerereId: string,
): Promise<CerereDetaliu | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_requests")
    .select(COLOANE_CERERE_DETALIU)
    .eq("organization_id", organizationId)
    .eq("id", cerereId)
    .is("deleted_at", null)
    .maybeSingle<CerereDetaliu>();
  if (error !== null) throw error;
  return data;
}

// ── Zilele unei cereri ────────────────────────────────────────────────────────

export interface ZiCerere {
  readonly data: string;
  readonly portiune: PortiuneZi;
  readonly este_lucratoare: boolean;
  readonly status: StatusCerere;
}

/** `leave_request_days` nu are `deleted_at` — rândurile se șterg fizic odată cu cererea (ON DELETE CASCADE). */
export async function zileleCererii(cerereId: string): Promise<readonly ZiCerere[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_request_days")
    .select("data, portiune, este_lucratoare, status")
    .eq("leave_request_id", cerereId)
    .order("data")
    .returns<ZiCerere[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Lanțul de aprobare ────────────────────────────────────────────────────────

export interface PasAprobare {
  readonly id: string;
  readonly ordine: number;
  readonly status: StatusSarcinaAprobare;
  readonly comentariu: string | null;
  readonly decis_la: string | null;
  readonly termen_la: string | null;
  readonly approver_user_id: string | null;
  readonly approver_employee_id: string | null;
}

/**
 * Solicitantul vede acest lanț GOL dacă nu e el însuși aprobator: politica
 * `approval_tasks_select` arată doar sarcinile proprii (sau cu `leave:approve
 * = all`). Ecranul de detaliu trebuie să trateze lista goală ca „în așteptare”,
 * nu ca „fără flux de aprobare” — vezi `[id]/page.tsx`.
 */
export async function lantulAprobarii(
  organizationId: string,
  cerereId: string,
): Promise<readonly PasAprobare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("approval_tasks")
    .select(
      "id, ordine, status, comentariu, decis_la, termen_la, approver_user_id, approver_employee_id",
    )
    .eq("organization_id", organizationId)
    .eq("entity_type", "leave_request")
    .eq("entity_id", cerereId)
    .is("deleted_at", null)
    .order("ordine")
    .returns<PasAprobare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Soldul anual ──────────────────────────────────────────────────────────────

export interface TipConcediu {
  readonly id: string;
  readonly key: string;
  readonly denumire: string;
  readonly culoare: string;
  readonly zile_implicite: number;
  readonly scade_din_sold: boolean;
  readonly se_reporteaza: boolean;
  readonly plafon_reportare_zile: number | null;
}

export interface SoldTip {
  readonly id: string;
  readonly employee_id: string;
  readonly leave_type_id: string;
  readonly an: number;
  readonly drept_anual: number;
  readonly reportate: number;
  readonly termen_folosire_reportate: string | null;
  readonly folosite: number;
  readonly in_asteptare: number;
  readonly ramase: number | null;
}

export interface SoldAnual {
  readonly tipuri: readonly TipConcediu[];
  readonly solduri: readonly SoldTip[];
}

/**
 * Două interogări separate, fără embed (nu există FK direct între cele două
 * tabele care s-ar preta la unul). Împerecherea pe `leave_type_id` se face în
 * TS, cu `imperecheazaSold`.
 */
export async function soldAnual(organizationId: string, an: number): Promise<SoldAnual> {
  const db = await createServerSupabase();
  const [tipuriRes, solduriRes] = await Promise.all([
    db
      .from("leave_types")
      .select(
        "id, key, denumire, culoare, zile_implicite, scade_din_sold, se_reporteaza, plafon_reportare_zile",
      )
      .eq("organization_id", organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<TipConcediu[]>(),
    db
      .from("leave_balances")
      .select(
        "id, employee_id, leave_type_id, an, drept_anual, reportate, termen_folosire_reportate, folosite, in_asteptare, ramase",
      )
      .eq("organization_id", organizationId)
      .eq("an", an)
      .is("deleted_at", null)
      .returns<SoldTip[]>(),
  ]);
  if (tipuriRes.error !== null) throw tipuriRes.error;
  if (solduriRes.error !== null) throw solduriRes.error;
  return { tipuri: tipuriRes.data ?? [], solduri: solduriRes.data ?? [] };
}

export interface RandSold {
  readonly tip: TipConcediu;
  readonly sold: SoldTip | null;
}

/**
 * Împerechează tipurile de concediu active cu soldul unui SINGUR angajat
 * (apelantul filtrează în prealabil `solduriAngajat` la un `employee_id`).
 * Un tip fără rând de sold ⇒ dreptul afișat e `zile_implicite`, iar istoricul
 * se citește ca „fără mișcări în acest an” — nu s-a creat încă rândul din
 * `leave_balances` (se întâmplă abia la prima cerere/aprobare pe tipul respectiv).
 */
export function imperecheazaSold(
  tipuri: readonly TipConcediu[],
  solduriAngajat: readonly SoldTip[],
): readonly RandSold[] {
  return tipuri.map((tip) => ({
    tip,
    sold: solduriAngajat.find((s) => s.leave_type_id === tip.id) ?? null,
  }));
}

/** Grupează rândurile de sold după angajat, păstrând ordinea primei apariții. */
export function grupeazaSoldDupaAngajat(
  solduri: readonly SoldTip[],
): ReadonlyMap<string, readonly SoldTip[]> {
  const harta = new Map<string, SoldTip[]>();
  for (const rand of solduri) {
    const grup = harta.get(rand.employee_id);
    if (grup === undefined) {
      harta.set(rand.employee_id, [rand]);
    } else {
      grup.push(rand);
    }
  }
  return harta;
}

// ── Istoricul soldului ────────────────────────────────────────────────────────

export interface EvenimentIstoricSold {
  readonly an: number;
  readonly eveniment: EvenimentSold;
  readonly delta: number;
  readonly sold_dupa: number | null;
  readonly motiv: string;
  readonly data_eveniment: string;
  readonly created_at: string;
  readonly leave_type_id: string;
}

/**
 * `leave_accruals` nu are `deleted_at`. Politica de SELECT e „propriu sau
 * `leave:read = all`” — FĂRĂ ramură de manager. Un manager cu scope „team” nu
 * vede aici istoricul subordonaților, chiar dacă le vede soldul în `soldAnual`;
 * RLS întoarce pur și simplu mai puține rânduri, fără eroare.
 */
export async function istoricSold(
  organizationId: string,
  an: number,
): Promise<readonly EvenimentIstoricSold[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_accruals")
    .select("an, eveniment, delta, sold_dupa, motiv, data_eveniment, created_at, leave_type_id")
    .eq("organization_id", organizationId)
    .eq("an", an)
    .order("created_at", { ascending: false })
    .returns<EvenimentIstoricSold[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Sarcinile de aprobat ──────────────────────────────────────────────────────

export interface SarcinaDeAprobat {
  readonly taskId: string;
  readonly ordine: number;
  readonly termenLa: string | null;
  readonly createdAt: string;
  readonly cerere: Readonly<{
    readonly id: string;
    readonly dataInceput: string;
    readonly dataSfarsit: string;
    readonly zileLucratoare: number;
    readonly status: StatusCerere;
  }>;
  readonly angajat: Readonly<{
    readonly id: string;
    readonly fullName: string;
    readonly marca: string;
  }> | null;
  readonly tip: Readonly<{
    readonly id: string;
    readonly denumire: string;
    readonly culoare: string;
  }> | null;
}

interface SarcinaBruta {
  readonly id: string;
  readonly entity_id: string;
  readonly ordine: number;
  readonly termen_la: string | null;
  readonly created_at: string;
}

interface CerereBruta {
  readonly id: string;
  readonly employee_id: string;
  readonly leave_type_id: string;
  readonly data_inceput: string;
  readonly data_sfarsit: string;
  readonly zile_lucratoare: number;
  readonly status: StatusCerere;
}

/**
 * `approval_tasks` NU are cheie străină către `leave_requests` (legătura e
 * polimorfă: `entity_type` + `entity_id`), deci embed-ul PostgREST e imposibil.
 * Trei interogări separate, împerecheate în TS. Rândurile a căror cerere nu mai
 * e `trimisa`/`in_aprobare` (decisă între timp de un pas anterior sau anulată)
 * se aruncă — nu mai au ce căuta în lista „de aprobat”.
 */
export async function deAprobat(
  organizationId: string,
  userId: string,
): Promise<readonly SarcinaDeAprobat[]> {
  const db = await createServerSupabase();

  const { data: sarciniData, error: eroareSarcini } = await db
    .from("approval_tasks")
    .select("id, entity_id, ordine, termen_la, created_at")
    .eq("organization_id", organizationId)
    .eq("entity_type", "leave_request")
    .eq("approver_user_id", userId)
    .eq("status", "in_asteptare")
    .is("deleted_at", null)
    .order("termen_la", { ascending: true, nullsFirst: false })
    .limit(100)
    .returns<SarcinaBruta[]>();
  if (eroareSarcini !== null) throw eroareSarcini;
  const sarcini = sarciniData ?? [];
  if (sarcini.length === 0) return [];

  const idCereri = [...new Set(sarcini.map((s) => s.entity_id))];
  const { data: cereriData, error: eroareCereri } = await db
    .from("leave_requests")
    .select("id, employee_id, leave_type_id, data_inceput, data_sfarsit, zile_lucratoare, status")
    .eq("organization_id", organizationId)
    .in("id", idCereri)
    .in("status", ["trimisa", "in_aprobare"])
    .returns<CerereBruta[]>();
  if (eroareCereri !== null) throw eroareCereri;
  const cereri = cereriData ?? [];
  const hartaCereri = new Map(cereri.map((c) => [c.id, c]));

  const idAngajati = [...new Set(cereri.map((c) => c.employee_id))];
  const idTipuri = [...new Set(cereri.map((c) => c.leave_type_id))];

  type AngajatMinim = { readonly id: string; readonly full_name: string; readonly marca: string };
  type TipMinim = { readonly id: string; readonly denumire: string; readonly culoare: string };

  const [angajatiRes, tipuriRes] = await Promise.all([
    db
      .from("employees")
      .select("id, full_name, marca")
      .in("id", idAngajati.length === 0 ? [""] : idAngajati)
      .returns<AngajatMinim[]>(),
    db
      .from("leave_types")
      .select("id, denumire, culoare")
      .in("id", idTipuri.length === 0 ? [""] : idTipuri)
      .returns<TipMinim[]>(),
  ]);
  if (angajatiRes.error !== null) throw angajatiRes.error;
  if (tipuriRes.error !== null) throw tipuriRes.error;
  const hartaAngajati = new Map((angajatiRes.data ?? []).map((a) => [a.id, a]));
  const hartaTipuri = new Map((tipuriRes.data ?? []).map((t) => [t.id, t]));

  return sarcini
    .map((sarcina): SarcinaDeAprobat | null => {
      const cerere = hartaCereri.get(sarcina.entity_id);
      if (cerere === undefined) return null;
      const angajat = hartaAngajati.get(cerere.employee_id) ?? null;
      const tip = hartaTipuri.get(cerere.leave_type_id) ?? null;
      return {
        taskId: sarcina.id,
        ordine: sarcina.ordine,
        termenLa: sarcina.termen_la,
        createdAt: sarcina.created_at,
        cerere: {
          id: cerere.id,
          dataInceput: cerere.data_inceput,
          dataSfarsit: cerere.data_sfarsit,
          zileLucratoare: cerere.zile_lucratoare,
          status: cerere.status,
        },
        angajat:
          angajat === null
            ? null
            : { id: angajat.id, fullName: angajat.full_name, marca: angajat.marca },
        tip: tip === null ? null : { id: tip.id, denumire: tip.denumire, culoare: tip.culoare },
      };
    })
    .filter((rand): rand is SarcinaDeAprobat => rand !== null);
}

// ── Calendarul de echipă ──────────────────────────────────────────────────────

export interface RandZiCalendar {
  readonly data: string;
  readonly portiune: PortiuneZi;
  readonly status: StatusCerere;
  readonly leave_request_id: string;
  readonly cerere: Readonly<{
    readonly id: string;
    readonly employee_id: string;
    readonly leave_type_id: string;
    readonly status: StatusCerere;
  }> | null;
}

/**
 * `.returns<T>()` este OBLIGATORIU: generatorul emite `Relationships: []`
 * pentru toate tabelele, deci embed-ul `cerere:leave_requests!leave_request_id`
 * nu se tipează singur (exact tiparul din `queries/employees.ts`).
 */
export async function calendarLunii(
  organizationId: string,
  primaZi: string,
  ultimaZi: string,
): Promise<readonly RandZiCalendar[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_request_days")
    .select(
      "data, portiune, status, leave_request_id, cerere:leave_requests!leave_request_id(id, employee_id, leave_type_id, status)",
    )
    .eq("organization_id", organizationId)
    .eq("este_lucratoare", true)
    .gte("data", primaZi)
    .lte("data", ultimaZi)
    .in("status", ["trimisa", "in_aprobare", "aprobata"])
    .returns<RandZiCalendar[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Zilele nelucrătoare (sărbători + calendarul propriu al organizației) ─────

export interface ZiSarbatoareNationala {
  readonly data: string;
  readonly denumire: string;
}

export interface ZiOrganizatie {
  readonly data: string;
  readonly tip: TipZiOrganizatie;
  readonly denumire: string;
}

export interface ZileNelucratoare {
  readonly nationale: readonly ZiSarbatoareNationala[];
  readonly organizatie: readonly ZiOrganizatie[];
}

/**
 * Sursa previzualizării de zile ale unei cereri (vezi `@/domain/leave/zile-cerere`)
 * și a marcajelor din grila de calendar. `anInceput`/`anSfarsit` pot fi egale.
 */
export async function zileNelucratoare(
  organizationId: string,
  anInceput: number,
  anSfarsit: number,
): Promise<ZileNelucratoare> {
  const db = await createServerSupabase();
  const ani: number[] = [];
  for (let an = anInceput; an <= anSfarsit; an += 1) ani.push(an);

  const [nationaleRes, organizatieRes] = await Promise.all([
    db
      .from("public_holidays")
      .select("data, denumire")
      .eq("tara", "RO")
      .in("an", ani)
      .is("deleted_at", null)
      .returns<ZiSarbatoareNationala[]>(),
    db
      .from("organization_holidays")
      .select("data, tip, denumire")
      .eq("organization_id", organizationId)
      .gte("data", `${String(anInceput)}-01-01`)
      .lte("data", `${String(anSfarsit)}-12-31`)
      .is("deleted_at", null)
      .returns<ZiOrganizatie[]>(),
  ]);
  if (nationaleRes.error !== null) throw nationaleRes.error;
  if (organizatieRes.error !== null) throw organizatieRes.error;
  return { nationale: nationaleRes.data ?? [], organizatie: organizatieRes.data ?? [] };
}

// ── Setări concedii: tipuri + grile de zile suplimentare ──────────────────────
//
// `leave_types_select` e vizibilă oricărui membru cu modulul „leave” activ;
// `ler_select` cere `leave:read = all` — un angajat obișnuit primește aici o
// listă de reguli GOALĂ, nu o eroare (RLS filtrează rândurile, nu respinge
// cererea). De aceea pagina /concedii/setari mai verifică o dată `can(...)`
// înainte de a randa formularele de editare, dar orice alt apelant al
// funcției ăsteia primește pur și simplu mai puține date, niciodată date greșite.

export interface TipConcediuConfigurabil {
  readonly id: string;
  readonly key: string;
  readonly denumire: string;
  readonly culoare: string;
  readonly zile_implicite: number;
  readonly reglementat: boolean;
  readonly activ: boolean;
  readonly scade_din_sold: boolean;
  readonly necesita_document: boolean;
  readonly se_reporteaza: boolean;
  readonly termen_reportare: number | null;
  readonly plafon_reportare_zile: number | null;
  readonly mod_rotunjire_acumulare: ModRotunjireAcumulare;
  readonly temei_legal: string | null;
}

export interface RegulaConcediuRand {
  readonly id: string;
  readonly leave_type_id: string;
  readonly tip_criteriu: CriteriuGrila;
  readonly vechime_ani_min: number | null;
  readonly valoare_text: string | null;
  readonly department_id: string | null;
  readonly job_position_id: string | null;
  readonly zile_suplimentare: number;
  readonly denumire: string;
  readonly activ: boolean;
  readonly valabil_de_la: string;
  readonly valabil_pana_la: string | null;
}

export interface OptiuneNomenclator {
  readonly id: string;
  readonly denumire: string;
}

export interface ConfigurareConcedii {
  readonly tipuri: readonly TipConcediuConfigurabil[];
  readonly reguli: readonly RegulaConcediuRand[];
  readonly departamente: readonly OptiuneNomenclator[];
  readonly functii: readonly OptiuneNomenclator[];
}

export async function configurareConcedii(organizationId: string): Promise<ConfigurareConcedii> {
  const db = await createServerSupabase();
  const [tipuriRes, reguliRes, departamenteRes, functiiRes] = await Promise.all([
    db
      .from("leave_types")
      .select(
        "id, key, denumire, culoare, zile_implicite, reglementat, activ, scade_din_sold, " +
          "necesita_document, se_reporteaza, termen_reportare, plafon_reportare_zile, " +
          "mod_rotunjire_acumulare, temei_legal",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("denumire")
      .returns<TipConcediuConfigurabil[]>(),
    db
      .from("leave_entitlement_rules")
      .select(
        "id, leave_type_id, tip_criteriu, vechime_ani_min, valoare_text, department_id, " +
          "job_position_id, zile_suplimentare, denumire, activ, valabil_de_la, valabil_pana_la",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("valabil_de_la", { ascending: false })
      .returns<RegulaConcediuRand[]>(),
    db
      .from("departments")
      .select("id, denumire")
      .eq("organization_id", organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<OptiuneNomenclator[]>(),
    db
      .from("job_positions")
      .select("id, denumire")
      .eq("organization_id", organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<OptiuneNomenclator[]>(),
  ]);
  if (tipuriRes.error !== null) throw tipuriRes.error;
  if (reguliRes.error !== null) throw reguliRes.error;
  if (departamenteRes.error !== null) throw departamenteRes.error;
  if (functiiRes.error !== null) throw functiiRes.error;
  return {
    tipuri: tipuriRes.data ?? [],
    reguli: reguliRes.data ?? [],
    departamente: departamenteRes.data ?? [],
    functii: functiiRes.data ?? [],
  };
}

// ── Setări concedii: previzualizarea aplicării drepturilor ────────────────────

export interface RandPrevizualizareDrept {
  readonly employee_id: string;
  readonly leave_type_id: string;
  readonly drept_vechi: number;
  readonly drept_nou: number;
  readonly ramase_dupa: number;
}

/**
 * `p_simulare = true`: `public.aplica_drepturi_concediu` (0035) doar
 * ÎNTOARCE diferențele, nu scrie nimic. Aceeași funcție SQL e apelată din
 * `aplicaDrepturileConcediu` (concedii/setari/actions.ts) cu `p_simulare = false`.
 */
export async function previzualizeazaDrepturi(
  organizationId: string,
  an: number,
): Promise<readonly RandPrevizualizareDrept[]> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("aplica_drepturi_concediu", {
    p_organization_id: organizationId,
    p_an: an,
    p_simulare: true,
  });
  if (error !== null) throw error;
  return data ?? [];
}
