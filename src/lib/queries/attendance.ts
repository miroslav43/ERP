// src/lib/queries/attendance.ts
// Citirile modulului de pontaj. Doar `createServerSupabase` — ESLint interzice
// `createAdminSupabase` aici (excepția acoperă exclusiv `actions.ts`, route
// handlers și scripturi). Fiecare interogare trece prin RLS.

import { createServerSupabase } from "@/lib/supabase/server";
import type { RandPontareRapida } from "@/domain/attendance/pontare-rapida";
import type {
  FiltrePontaj,
  StareSaptamanaPontaj,
  StatusPerioada,
  SursaIntrare,
  TipPrezenta,
  TipZi,
} from "@/schemas/attendance";

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
  /** Unde s-a lucrat ziua (0118). `null` = nedeclarat, nu „la birou". */
  readonly tip_prezenta: TipPrezenta | null;
  readonly sursa: SursaIntrare;
  readonly leave_request_id: string | null;
  readonly observatii: string | null;
  readonly approved_at: string | null;
  readonly respins_la: string | null;
  readonly motiv_respingere: string | null;
  readonly batch_id: string | null;
}

const COLOANE_INTRARE =
  "id, employee_id, data, ora_inceput, ora_sfarsit, ore_lucrate, ore_suplimentare, " +
  "ore_noapte, tip_zi, tip_prezenta, sursa, leave_request_id, observatii, approved_at, batch_id, " +
  "respins_la, motiv_respingere";

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
  /**
   * Limitele care se verifică DUPĂ scriere, prin `limiteleFirmei`
   * (`src/domain/attendance/limite-legale.ts`). Stau în aceeași citire ca
   * parametrii de calcul, nu într-una separată: acțiunile aveau deja rândul în
   * mână pentru `configZiDin`, iar un al doilea drum la bază pentru trei
   * numere din ACELAȘI rând ar fi fost plătit la fiecare zi salvată.
   */
  readonly perioada_referinta_luni: number;
  readonly repaus_zilnic_minim_ore: number;
  readonly repaus_saptamanal_minim_ore: number;
  /**
   * Termenul zilei libere pentru munca din sărbătoare. Perechea lui,
   * `termen_compensare_suplimentare_zile`, NU se citește aici: tabela pe care
   * ar guverna-o (`overtime_compensation`) n-are niciun scriitor în tot
   * produsul, deci n-ar avea ce număra.
   */
  readonly termen_compensare_sarbatoare_zile: number;
  readonly pauza_masa_minute: number;
  /** Când e inclusă în program, pauza e plătită și NU se scade din interval. */
  readonly pauza_masa_inclusa_in_program: boolean;
  /** Pragul de ore de la care pauza devine obligatorie — sub el nu se scade. */
  readonly pauza_obligatorie_peste_ore: number;
  /**
   * Ce feluri de muncă are firma (0080). Declarații despre PROGRAM, nu despre
   * plată: sporurile rămân obligatorii când munca s-a prestat.
   */
  readonly lucreaza_noaptea: boolean;
  readonly lucreaza_weekend: boolean;
  readonly lucreaza_sarbatori: boolean;
  readonly admite_ore_suplimentare: boolean;
  readonly spor_suplimentare_procent: number;
  readonly spor_noapte_procent: number;
  readonly spor_weekend_procent: number;
  readonly spor_sarbatoare_procent: number;
  /** Fereastra de noapte (`"22:00"` / `"06:00"`), din care se derivă `ore_noapte`. */
  readonly noapte_start: string;
  readonly noapte_sfarsit: string;
  /** Minimul de ore de noapte de la care se acordă sporul (art. 126; 0 = fără prag). */
  readonly prag_ore_noapte: number;
  /*
   * Cele trei câmpuri de pontare rapidă au plecat de aici în 0115: se citesc din
   * `setariPontareRapida`, nu din rândul versionat. Un ecran care le cerea
   * împreună cu parametrii juridici lega două ritmuri diferite — regula de
   * calcul are nevoie de istoric, butonul de pe telefon nu.
   */
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
      "ore_pe_zi, ore_pe_saptamana, ore_maxime_saptamanale, " +
        "perioada_referinta_luni, repaus_zilnic_minim_ore, repaus_saptamanal_minim_ore, " +
        "termen_compensare_sarbatoare_zile, pauza_masa_minute, " +
        "pauza_masa_inclusa_in_program, pauza_obligatorie_peste_ore, " +
        "lucreaza_noaptea, lucreaza_weekend, lucreaza_sarbatori, admite_ore_suplimentare, " +
        "spor_suplimentare_procent, spor_noapte_procent, spor_weekend_procent, spor_sarbatoare_procent, " +
        "noapte_start, noapte_sfarsit, prag_ore_noapte",
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

// ── Zilele unui singur angajat, pentru verificarea limitelor legale ─────────

export interface ZiPontataAngajat {
  readonly data: string;
  readonly ora_inceput: string | null;
  readonly ora_sfarsit: string | null;
  readonly ore_lucrate: number;
  readonly ore_suplimentare: number;
  readonly ore_noapte: number;
  readonly tip_zi: TipZi;
}

/**
 * Plafonul cerut de la PostgREST. Peste `max_rows = 1000` răspunsul se taie
 * TĂCUT, deci limita se cere explicit, mai jos decât pragul care taie.
 *
 * De ce e sigur: `attendance_entries_zi_uq` (0013) e unic pe
 * (organizație, angajat, zi) — un angajat NU poate avea două rânduri în
 * aceeași zi. Intervalul cel mai larg pe care îl cere apelantul e perioada de
 * referință maximă (12 luni) plus săptămâna zilei salvate, adică sub 380 de
 * zile calendaristice. 500 lasă marjă și rămâne departe de trunchiere.
 */
const MAXIM_ZILE_ANGAJAT = 500;

/**
 * Zilele pontate ale UNUI angajat, într-un interval închis.
 *
 * Nu are cursor keyset fiindcă nu e o listă de ecran, ci intrarea unei funcții
 * pure: `avertismenteZi` are nevoie de săptămâna întreagă și de perioada de
 * referință deodată, iar o pagină a doua ar însemna o verificare făcută pe
 * jumătate din date, fără ca cineva să afle.
 *
 * Fără filtru pe `employee_id`? NU — aici filtrul e obligatoriu: pentru scope
 * `all` (`hr`, `org_admin`) RLS nu îngustează nimic, iar suma ar aduna orele
 * întregii firme într-o singură medie. Vezi `intrariProprii`, care merge pe
 * cealaltă cale, și capcana #10.
 */
export async function zilePontateAngajat(
  organizationId: string,
  employeeId: string,
  deLa: string,
  panaLa: string,
): Promise<readonly ZiPontataAngajat[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_entries")
    .select("data, ora_inceput, ora_sfarsit, ore_lucrate, ore_suplimentare, ore_noapte, tip_zi")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .gte("data", deLa)
    .lte("data", panaLa)
    .is("deleted_at", null)
    .order("data", { ascending: true })
    .limit(MAXIM_ZILE_ANGAJAT)
    .returns<ZiPontataAngajat[]>();
  if (error !== null) throw error;
  return data ?? [];
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

export interface RezultatLiniiDeAprobat {
  readonly linii: readonly LinieDeAprobat[];
  /** `true` = s-a atins plafonul de mai jos, deci cifra afișată e sub cea reală. */
  readonly trunchiat: boolean;
}

/** Cât întoarce PostgREST pe cerere: `max_rows = 1000`, tăiat TĂCUT. */
const PAGINA_LINII = 1000;
/** 20 × 1000 = 20 000 de linii neaprobate într-o singură lună. Peste, se spune. */
const MAXIM_PAGINI_LINII = 20;

/**
 * Liniile neaprobate ale unei luni, CITITE PÂNĂ LA CAPĂT.
 *
 * Interogarea n-avea nici `.limit()`, nici paginare: PostgREST tăia la 1000 de
 * rânduri fără nicio eroare, iar 46 de angajați × 22 de zile = 1012 linii. Din
 * rezultatul ăsta se calculau DOUĂ cifre afișate ca autoritative — numărul din
 * butonul „Aprobă în bloc (N linii)” și cifra mare de pe `/pontaj/perioade/[id]`
 * — plus defalcarea pe angajat. Toate trei mințeau în jos, fără niciun semn.
 *
 * `.order("data").order("id")` nu e cosmetic: fără o ordine TOTALĂ, `.range()`
 * poate întoarce același rând de două ori și sări peste altul între pagini,
 * fiindcă ordinea implicită a Postgres nu e stabilă. `id` e unic, deci
 * perechea ordonează complet.
 */
export async function liniiDeAprobat(
  organizationId: string,
  periodId: string,
): Promise<RezultatLiniiDeAprobat> {
  const db = await createServerSupabase();
  const adunate: LinieDeAprobat[] = [];

  for (let pagina = 0; pagina < MAXIM_PAGINI_LINII; pagina += 1) {
    const deLa = pagina * PAGINA_LINII;
    const { data, error } = await db
      .from("attendance_entries")
      .select("id, employee_id, data, ore_lucrate")
      .eq("organization_id", organizationId)
      .eq("period_id", periodId)
      .is("approved_at", null)
      .is("deleted_at", null)
      .order("data", { ascending: true })
      .order("id", { ascending: true })
      .range(deLa, deLa + PAGINA_LINII - 1)
      .returns<LinieDeAprobat[]>();
    if (error !== null) throw error;

    const lot = data ?? [];
    adunate.push(...lot);
    if (lot.length < PAGINA_LINII) return { linii: adunate, trunchiat: false };
  }

  return { linii: adunate, trunchiat: true };
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

// ── Plan săptămânal (prezență + ore, aprobare individuală) ──────────────────

export interface ZiSaptamanaPontaj {
  readonly data: string;
  readonly tip_prezenta: TipPrezenta;
  /**
   * Intervalul planificat, ca `"08:30:00"` (0081). Nul pe zilele nelucrate și
   * pe săptămânile trimise înainte de migrare.
   */
  readonly ora_inceput: string | null;
  readonly ora_sfarsit: string | null;
  readonly ore_planificate: number;
  readonly observatii: string | null;
}

export interface SaptamanaPontaj {
  readonly id: string;
  readonly status: StareSaptamanaPontaj;
  readonly motivRespingere: string | null;
  /** Săptămâna a fost declarată cu weekend (0081). */
  readonly lucreazaWeekend: boolean;
  readonly zile: readonly ZiSaptamanaPontaj[];
}

/** Planul (dacă există) al unui angajat pentru săptămâna care începe la `saptamanaStart`. */
export async function citesteSaptamanaPontaj(
  organizationId: string,
  employeeId: string,
  saptamanaStart: string,
): Promise<SaptamanaPontaj | null> {
  const db = await createServerSupabase();
  const { data: submisie, error: eroareSubmisie } = await db
    .from("attendance_week_submissions")
    .select("id, status, motiv_respingere, lucreaza_weekend")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("saptamana_start", saptamanaStart)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      status: StareSaptamanaPontaj;
      motiv_respingere: string | null;
      lucreaza_weekend: boolean;
    }>();
  if (eroareSubmisie !== null) throw eroareSubmisie;
  if (submisie === null) return null;

  const { data: zile, error: eroareZile } = await db
    .from("attendance_week_submission_days")
    .select("data, tip_prezenta, ora_inceput, ora_sfarsit, ore_planificate, observatii")
    .eq("submission_id", submisie.id)
    .order("data", { ascending: true })
    .returns<ZiSaptamanaPontaj[]>();
  if (eroareZile !== null) throw eroareZile;

  return {
    id: submisie.id,
    status: submisie.status,
    motivRespingere: submisie.motiv_respingere,
    lucreazaWeekend: submisie.lucreaza_weekend,
    zile: zile ?? [],
  };
}

export interface SarcinaSaptamanaDeAprobat {
  readonly taskId: string;
  readonly termenLa: string | null;
  readonly createdAt: string;
  readonly submisie: Readonly<{ id: string; saptamanaStart: string; status: StareSaptamanaPontaj }>;
  readonly angajat: Readonly<{ id: string; fullName: string; marca: string }> | null;
  readonly zile: readonly ZiSaptamanaPontaj[];
}

interface SarcinaBrutaSaptamana {
  readonly id: string;
  readonly entity_id: string;
  readonly termen_la: string | null;
  readonly created_at: string;
}

interface SubmisieBruta {
  readonly id: string;
  readonly employee_id: string;
  readonly saptamana_start: string;
  readonly status: StareSaptamanaPontaj;
}

/**
 * `approval_tasks` nu are cheie străină către `attendance_week_submissions`
 * (legătura e polimorfă) — trei interogări separate, împerecheate în TS,
 * exact tiparul din `deAprobat()` (queries/leave.ts).
 */
export async function saptamaniDeAprobat(
  organizationId: string,
  userId: string,
): Promise<readonly SarcinaSaptamanaDeAprobat[]> {
  const db = await createServerSupabase();

  const { data: sarciniData, error: eroareSarcini } = await db
    .from("approval_tasks")
    .select("id, entity_id, termen_la, created_at")
    .eq("organization_id", organizationId)
    .eq("entity_type", "attendance_week_submission")
    .eq("approver_user_id", userId)
    .eq("status", "in_asteptare")
    .is("deleted_at", null)
    .order("termen_la", { ascending: true, nullsFirst: false })
    .limit(100)
    .returns<SarcinaBrutaSaptamana[]>();
  if (eroareSarcini !== null) throw eroareSarcini;
  const sarcini = sarciniData ?? [];
  if (sarcini.length === 0) return [];

  const idSubmisii = [...new Set(sarcini.map((s) => s.entity_id))];
  const { data: submisiiData, error: eroareSubmisii } = await db
    .from("attendance_week_submissions")
    .select("id, employee_id, saptamana_start, status")
    .eq("organization_id", organizationId)
    .in("id", idSubmisii)
    .eq("status", "trimisa")
    .returns<SubmisieBruta[]>();
  if (eroareSubmisii !== null) throw eroareSubmisii;
  const submisii = submisiiData ?? [];
  const hartaSubmisii = new Map(submisii.map((s) => [s.id, s]));

  const idAngajati = [...new Set(submisii.map((s) => s.employee_id))];
  const [angajatiRes, ziRes] = await Promise.all([
    db
      .from("employees")
      .select("id, full_name, marca")
      .in("id", idAngajati.length === 0 ? [""] : idAngajati)
      .returns<{ id: string; full_name: string; marca: string }[]>(),
    db
      .from("attendance_week_submission_days")
      .select(
        "submission_id, data, tip_prezenta, ora_inceput, ora_sfarsit, ore_planificate, observatii",
      )
      .in("submission_id", idSubmisii)
      .order("data", { ascending: true })
      .returns<(ZiSaptamanaPontaj & { submission_id: string })[]>(),
  ]);
  if (angajatiRes.error !== null) throw angajatiRes.error;
  if (ziRes.error !== null) throw ziRes.error;
  const hartaAngajati = new Map((angajatiRes.data ?? []).map((a) => [a.id, a]));
  const zilePerSubmisie = new Map<string, ZiSaptamanaPontaj[]>();
  for (const zi of ziRes.data ?? []) {
    const lista = zilePerSubmisie.get(zi.submission_id) ?? [];
    lista.push(zi);
    zilePerSubmisie.set(zi.submission_id, lista);
  }

  return sarcini
    .map((sarcina): SarcinaSaptamanaDeAprobat | null => {
      const submisie = hartaSubmisii.get(sarcina.entity_id);
      if (submisie === undefined) return null;
      const angajat = hartaAngajati.get(submisie.employee_id) ?? null;
      return {
        taskId: sarcina.id,
        termenLa: sarcina.termen_la,
        createdAt: sarcina.created_at,
        submisie: {
          id: submisie.id,
          saptamanaStart: submisie.saptamana_start,
          status: submisie.status,
        },
        angajat:
          angajat === null
            ? null
            : { id: angajat.id, fullName: angajat.full_name, marca: angajat.marca },
        zile: zilePerSubmisie.get(submisie.id) ?? [],
      };
    })
    .filter((rand): rand is SarcinaSaptamanaDeAprobat => rand !== null);
}

export interface SetariPontajComplete {
  readonly id: string;
  readonly valabil_de_la: string;
  readonly ore_pe_zi: number;
  readonly ore_pe_saptamana: number;
  readonly ore_maxime_saptamanale: number;
  readonly perioada_referinta_luni: number;
  readonly repaus_zilnic_minim_ore: number;
  readonly repaus_saptamanal_minim_ore: number;
  /** Ce feluri de muncă are firma (0080) — vezi `SetariPontaj`. */
  readonly lucreaza_noaptea: boolean;
  readonly lucreaza_weekend: boolean;
  readonly lucreaza_sarbatori: boolean;
  readonly admite_ore_suplimentare: boolean;
  readonly spor_suplimentare_procent: number;
  readonly spor_noapte_procent: number;
  readonly spor_weekend_procent: number;
  readonly spor_sarbatoare_procent: number;
  readonly noapte_start: string;
  readonly noapte_sfarsit: string;
  readonly prag_ore_noapte: number;
  readonly termen_compensare_suplimentare_zile: number;
  readonly termen_compensare_sarbatoare_zile: number;
  readonly pauza_masa_minute: number;
  readonly pauza_masa_inclusa_in_program: boolean;
  readonly pauza_obligatorie_peste_ore: number;
  readonly observatii_juridice: string | null;
}

const CAMPURI_SETARI_PONTAJ =
  "id, valabil_de_la, ore_pe_zi, ore_pe_saptamana, ore_maxime_saptamanale, perioada_referinta_luni, repaus_zilnic_minim_ore, repaus_saptamanal_minim_ore, lucreaza_noaptea, lucreaza_weekend, lucreaza_sarbatori, admite_ore_suplimentare, spor_suplimentare_procent, spor_noapte_procent, spor_weekend_procent, spor_sarbatoare_procent, noapte_start, noapte_sfarsit, prag_ore_noapte, termen_compensare_suplimentare_zile, termen_compensare_sarbatoare_zile, pauza_masa_minute, pauza_masa_inclusa_in_program, pauza_obligatorie_peste_ore, observatii_juridice";

/**
 * Parametrii de dreptul muncii în vigoare la o dată dată.
 *
 * `null` e o stare NORMALĂ, nu o eroare: tabela n-a avut niciodată valori
 * implicite, tocmai ca nimeni să nu calculeze un salariu pe cifre inventate.
 * Apelantul trebuie să trateze absența explicit, nu să cadă pe un 8 hardcodat.
 */
export async function setariPontajComplete(
  organizationId: string,
  laData: string,
): Promise<SetariPontajComplete | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_settings")
    .select(CAMPURI_SETARI_PONTAJ)
    .eq("organization_id", organizationId)
    .lte("valabil_de_la", laData)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle<SetariPontajComplete>();
  if (error !== null) throw error;
  return data;
}

/** Toate versiunile, cea mai recentă prima — istoricul rămâne vizibil. */
export async function istoricSetariPontaj(
  organizationId: string,
): Promise<readonly SetariPontajComplete[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("attendance_settings")
    .select(CAMPURI_SETARI_PONTAJ)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(50)
    .returns<SetariPontajComplete[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Pontarea rapidă (0115) ───────────────────────────────────────────────────

/**
 * Configurația de pontare rapidă a firmei.
 *
 * Tabelă separată de `attendance_settings` și NEVESIONATĂ: nu există nimic de
 * reconstituit pentru o lună trecută, iar ținerea celor trei câmpuri în rândul
 * versionat obliga pe oricine voia să pornească un buton să reconfirme
 * optsprezece cifre de dreptul muncii și să aleagă o dată de intrare în vigoare.
 *
 * `null` e o stare NORMALĂ — firma n-a salvat niciodată nimic. Apelantul NU
 * cade pe literale: trece rezultatul prin `configPontareRapida`
 * (`src/domain/attendance/pontare-rapida.ts`), care ține implicitele într-un
 * singur loc, cu teste.
 */
export async function setariPontareRapida(
  organizationId: string,
): Promise<RandPontareRapida | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("setari_pontare_rapida")
    .select("mod_pontare_rapida, verificare_pontare, program_start, necesita_aprobare")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<RandPontareRapida>();
  if (error !== null) throw error;
  return data;
}

export interface AfisPontare {
  readonly id: string;
  readonly denumire: string;
  readonly activ: boolean;
  /** Are cod generat, deci se poate tipări un afiș. */
  readonly areCod: boolean;
}

/**
 * Punctele de lucru și starea afișului lor de pontare.
 *
 * `cod_pontaj` NU se selectează niciodată: e un secret operațional — cine îl
 * vede poate ponta de oriunde — iar ecranul are nevoie doar de „are cod / n-are
 * cod". Aceeași regulă ca în `puncte-lucru/page.tsx`, unde codul nu traversează
 * granița server/client.
 *
 * Poarta e `puncte_lucru_select` (0030), care cere `departments:read` diferit de
 * `none`. Cele trei roluri care ajung la ecranul de setări — `super_admin`,
 * `org_admin`, `hr` — îl au pe `all`, deci lista nu se golește tăcut pentru
 * niciunul.
 */
export async function afiseDePontare(organizationId: string): Promise<readonly AfisPontare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("puncte_lucru")
    .select("id, denumire, activ, cod_pontaj")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sediu_principal", { ascending: false })
    .order("denumire")
    .returns<{ id: string; denumire: string; activ: boolean; cod_pontaj: string | null }[]>();
  if (error !== null) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    denumire: p.denumire,
    activ: p.activ,
    areCod: p.cod_pontaj !== null,
  }));
}
