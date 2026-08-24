// src/lib/queries/leave.ts
// Citirile modulului de concedii: cereri, zile, lanț de aprobare, sold, calendar.
//
// NU folosește niciodată `createAdminSupabase()` — ESLint îl interzice aici, și
// pe bună dreptate: fiecare interogare trece prin RLS. Pentru scope „own” NU se
// filtrează după `employee_id`: politica `leave_requests_select` (și surorile
// ei) îl rezolvă singură, prin `app.current_employee_id(organization_id)`.

import { createServerSupabase } from "@/lib/supabase/server";
import type { PermissionScope } from "@/config/permissions";
import { SORTARI_CERERI } from "@/schemas/leave";
import type {
  CriteriuGrila,
  EvenimentSold,
  FiltreCereri,
  ModRotunjireAcumulare,
  PortiuneZi,
  SortareCereri,
  StatusCerere,
  StatusSarcinaAprobare,
  TipZiOrganizatie,
  VizualizareCereri,
} from "@/schemas/leave";

import {
  codificaCursor as codificaKeyset,
  decodificaCursor as decodificaKeyset,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

// ── Cursor keyset ───────────────────────────────────────────────────────
//
// Cursorul propriu (`{ data, id }`, cu coloana încuiată în codificator) a fost
// înlocuit cu cel comun din `./cursor`: acolo valoarea e opacă, iar coloana o dă
// apelantul la fiecare citire, deci aceeași structură servește orice sortare.
// Erau zece copii ale aceluiași codificator în fișierele de citiri.

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
  /**
   * Câte cereri sunt în total, după filtre. Lista nu spunea nimic: „Pagina
   * următoare” fără un total e o ușă fără indicație — nu știi dacă mai urmează
   * un ecran sau o sută.
   */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareCereri; directie: Directie }>;
}

/** Cheia din URL → coloana din bază. Numele coloanei nu vine niciodată liber din query string. */
const COLOANA_SORTARE: Readonly<Record<SortareCereri, string>> = {
  perioada: "data_inceput",
  stare: "status",
};

const SORTARE_IMPLICITA = { cheie: "perioada", directie: "desc" } as const;

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
  /**
   * Ce felie se cere. Vine din RUTĂ (`/concedii` vs `/concedii/echipa`), nu din
   * query-string — vezi comentariul lui `VIZUALIZARI_CERERI` din
   * `@/schemas/leave`. Implicit „toate”, pentru apelanții care nu fac separarea.
   *
   * ATENȚIE: nu e o barieră de securitate. „echipa” exclude fișa proprie, dar
   * ce se vede dincolo de ea rămâne treaba RLS-ului — un `scope = 'own'` cu
   * `vizualizare = 'echipa'` întoarce zero rânduri, nu rândurile altcuiva.
   */
  vizualizare: VizualizareCereri = "toate",
): Promise<RezultatCereri> {
  const sortare = sortareCeruta(filtre.sort, SORTARI_CERERI, SORTARE_IMPLICITA);

  // Fără fișă proprie, „ale mele” nu are subiect. Fără ieșirea asta devreme,
  // filtrul din `filtreaza` s-ar sări tăcut și un manager fără fișă ar primi pe
  // ecranul „Cererile mele” lista întreagă a echipei — corectă din punctul de
  // vedere al RLS-ului, greșită față de ce scrie în antet.
  if (vizualizare === "mele" && fisaMea === null) {
    return { randuri: [], urmatorulCursor: null, total: 0, sortare };
  }

  const db = await createServerSupabase();
  const coloana = COLOANA_SORTARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  /*
   * ── DE CE NUMĂRĂTOAREA E O A DOUA INTEROGARE ──────────────────────────
   * Aici stătea `count: "exact"` pe ACEEAȘI interogare, cu argumentul — corect
   * în sine — că așa numărătoarea respectă filtrele ȘI politicile RLS, fără un
   * al doilea drum la bază. Argumentul rata un lucru: predicatul KEYSET e și el
   * un filtru, iar PostgREST n-are de unde ști că e „paginare”. Pus pe aceeași
   * interogare, `count` numără doar ce a rămas DUPĂ cursor.
   *
   * Se vedea de la pagina a doua: `<Paginare>` scria „25 din 30 de rânduri”
   * acolo unde erau 55, iar totalul SCĂDEA cu fiecare „mai departe”. Lista era
   * corectă; doar numărul mințea, fără nicio eroare.
   *
   * Cele două interogări împart ACELEAȘI filtre, aplicate de aceeași funcție,
   * ca să nu poată diverge; se deosebesc doar prin cursor, ordine și limită,
   * care aparțin paginii, nu mulțimii. Merg în paralel, iar numărătoarea e
   * `head: true`, deci nu aduce niciun rând.
   */
  /**
   * Filtrele mulțimii, aplicate identic pe amândouă interogările.
   *
   * Generic peste constructorul de interogare, nu scris de două ori: două copii
   * ar diverge la primul filtru adăugat, iar divergența s-ar vedea tocmai ca o
   * numărătoare care nu se potrivește cu lista — defectul reparat aici.
   */
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      neq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      in: (c: string, v: readonly string[]) => Q;
      gte: (c: string, v: string) => Q;
      lte: (c: string, v: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (fisaMea !== null && vizualizare === "mele") {
      cu = cu.eq("employee_id", fisaMea);
    } else if (fisaMea !== null && vizualizare === "echipa") {
      cu = cu.neq("employee_id", fisaMea);
    }
    if (filtre.status !== null && filtre.status.length > 0) cu = cu.in("status", filtre.status);
    if (filtre.leave_type_id !== null) cu = cu.eq("leave_type_id", filtre.leave_type_id);
    if (filtre.de_la !== null) cu = cu.gte("data_sfarsit", filtre.de_la);
    if (filtre.pana_la !== null) cu = cu.lte("data_inceput", filtre.pana_la);
    // Filtrul explicit după angajat are sens doar pentru cine vede mai mult decât
    // fișa proprie — pentru „own”, RLS restrânge deja rezultatul la un singur angajat.
    if (scope !== "own" && filtre.employee_id !== null) {
      cu = cu.eq("employee_id", filtre.employee_id);
    }
    return cu;
  };

  let interogare = filtreaza(db.from("leave_requests").select(COLOANE_CERERE))
    // Identificatorul e MEREU al doilea criteriu: nici data de început, nici
    // starea nu sunt unice, iar fără el ordinea dintre două cereri egale e
    // nedefinită — paginarea ar sări sau ar repeta exact acolo.
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaKeyset(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandCerere[]>(),
    filtreaza(db.from("leave_requests").select("id", { count: "exact", head: true })),
  ]);
  const { data, error } = rezultat;
  if (error !== null) throw error;
  if (numarare.error !== null) throw numarare.error;
  const count = numarare.count;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultimul = randuri.at(-1);
  const valoareCursor =
    ultimul === undefined
      ? null
      : sortare.cheie === "stare"
        ? ultimul.status
        : ultimul.data_inceput;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultimul !== undefined && valoareCursor !== null
        ? codificaKeyset({ valoare: valoareCursor, id: ultimul.id })
        : null,
    total: count ?? randuri.length,
    sortare,
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
  /**
   * A CUI e mișcarea. Lipsea din `select`, iar ecranul de sold randează
   * istoricul TUTUROR angajaților vizibili pentru un `org_admin`: șase coloane
   * (Data, Tip, Eveniment, Variație, Sold după, Motiv) și niciuna care să spună
   * a cui e linia. Un extras de cont fără titular.
   */
  readonly employee_id: string;
}

export interface RezultatIstoricSold {
  readonly randuri: readonly EvenimentIstoricSold[];
  /** Citirea a fost tăiată: mai există mișcări dincolo de ce s-a întors. */
  readonly trunchiat: boolean;
}

/**
 * Câte mișcări se citesc dintr-un an.
 *
 * Nu e o cifră de confort, e una de siguranță: PostgREST are `max_rows = 1000`
 * și TRUNCHIAZĂ TĂCUT peste el, fără eroare și fără niciun semn în răspuns.
 * Interogarea n-avea `.limit()` deloc, deci la 200 de angajați × ~6 evenimente
 * pe an lista se oprea la 1000 și arăta exact ca una completă. Cu limita
 * declarată aici, plus un rând, ȘTIM dacă s-a tăiat și o putem spune.
 */
const LIMITA_ISTORIC_SOLD = 500;

/**
 * `leave_accruals` nu are `deleted_at`. Politica de SELECT e „propriu sau
 * `leave:read = all`” — FĂRĂ ramură de manager. Un manager cu scope „team” nu
 * vede aici istoricul subordonaților, chiar dacă le vede soldul în `soldAnual`;
 * RLS întoarce pur și simplu mai puține rânduri, fără eroare.
 */
export async function istoricSold(
  organizationId: string,
  an: number,
): Promise<RezultatIstoricSold> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_accruals")
    .select(
      "an, eveniment, delta, sold_dupa, motiv, data_eveniment, created_at, leave_type_id, employee_id",
    )
    .eq("organization_id", organizationId)
    .eq("an", an)
    .order("created_at", { ascending: false })
    // Al doilea criteriu: `created_at` nu e unic (o singură tranzacție scrie
    // mai multe mișcări cu același `now()`), iar fără el ordinea dintre ele —
    // deci și granița de tăiere — ar fi nedefinită de la o citire la alta.
    .order("id", { ascending: false })
    .limit(LIMITA_ISTORIC_SOLD + 1)
    .returns<EvenimentIstoricSold[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const trunchiat = toate.length > LIMITA_ISTORIC_SOLD;
  return { randuri: trunchiat ? toate.slice(0, LIMITA_ISTORIC_SOLD) : toate, trunchiat };
}

// ── Sarcinile de aprobat ──────────────────────────────────────────────────────

/**
 * Câte cereri așteaptă decizia acestui utilizator — doar numărul, pentru
 * badge-ul din navigația modulului.
 *
 * Numără sarcinile, NU cererile: `approval_tasks` are un rând per aprobator, iar
 * `deAprobat` de mai jos face exact aceeași filtrare. Numărul de aici poate fi
 * mai mare decât lista afișată acolo — `deAprobat` aruncă sarcinile a căror
 * cerere a ieșit între timp din `trimisa`/`in_aprobare` (anulată de angajat,
 * decisă de un coleg înainte ca trigger-ul de anulare a surorilor să ajungă la
 * ea). Diferența e tranzitorie și de partea sigură: badge-ul cheamă omul la o
 * filă care poate fi goală, nu invers.
 *
 * `head: true` — se cere numai antetul `Content-Range`, fără rânduri. Nu are
 * nevoie de paginare și nu intră sub `max_rows = 1000`, care numără rânduri
 * întoarse, nu rânduri potrivite.
 */
export async function numarDeAprobat(organizationId: string, userId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("approval_tasks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("entity_type", "leave_request")
    .eq("approver_user_id", userId)
    .eq("status", "in_asteptare")
    .is("deleted_at", null);
  if (error !== null) throw error;
  return count ?? 0;
}

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

export interface RezultatDeAprobat {
  readonly sarcini: readonly SarcinaDeAprobat[];
  /**
   * Coada a fost tăiată: mai există sarcini dincolo de ce s-a întors.
   *
   * NU e însoțit de un total, deliberat. Un `count: "exact"` pe `approval_tasks`
   * ar număra și sarcinile a căror cerere a fost între timp decisă de un pas
   * anterior sau anulată — rândurile pe care funcția asta le ARUNCĂ mai jos.
   * Contorul ar rămâne atunci mai mare decât lista, pentru totdeauna, iar
   * ecranul ar promite „143 de cereri” deasupra a 130 de rânduri. Cifra afișată
   * e lungimea listei; steagul spune doar că lista nu e tot.
   */
  readonly trunchiat: boolean;
}

/**
 * Câte sarcini se aduc într-o citire a cozii.
 *
 * Plafonul exista și înainte (`.limit(100)`), dar nu ieșea nicăieri: un HR al
 * unei firme de 300 de oameni, în iulie, îl depășea și nu afla niciodată — a
 * 101-a cerere pur și simplu nu era pe ecran. Se cere acum un rând în plus,
 * exclusiv ca să se poată spune că s-a tăiat.
 */
const LIMITA_COADA_APROBARI = 100;

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
): Promise<RezultatDeAprobat> {
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
    // Al doilea criteriu: `termen_la` e NULL pe fluxurile fără SLA, deci fără el
    // ordinea dintre sarcinile fără termen — și implicit granița tăierii — se
    // schimbă de la o citire la alta.
    .order("id", { ascending: true })
    .limit(LIMITA_COADA_APROBARI + 1)
    .returns<SarcinaBruta[]>();
  if (eroareSarcini !== null) throw eroareSarcini;
  const brute = sarciniData ?? [];
  const trunchiat = brute.length > LIMITA_COADA_APROBARI;
  const sarcini = trunchiat ? brute.slice(0, LIMITA_COADA_APROBARI) : brute;
  if (sarcini.length === 0) return { sarcini: [], trunchiat: false };

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

  const randuri = sarcini
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

  return { sarcini: randuri, trunchiat };
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

// ── Coduri de indemnizație pentru concediul medical ───────────────────────────

export interface CodIndemnizatieMedicala {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly procent: number;
  readonly zileAngajator: number;
  readonly platitor: "angajator" | "fnuass" | "mixt";
}

/**
 * Nomenclatorul național de coduri de pe certificatul medical, valabile la data
 * cerută. Tabela `medical_leave_codes` nu are `organization_id` — e seed de
 * platformă, comun tuturor firmelor (0009:222-266).
 *
 * Codul nu e decorativ: el decide procentul (75/85/100%), câte zile suportă
 * firma din bugetul propriu și de la care începe FNUASS-ul. Motorul
 * `indemnizatie-cm.ts` îl citește prin `certificateMedicaleLuna`, care filtrează
 * `medical_code_id is not null` — până în 0064 nimic nu-l scria, deci filtrul
 * întorcea mereu zero rânduri și indemnizația era 0 lei, fără nicio eroare.
 *
 * `valabil_de_la <= laData` cu `valabil_pana_la` deschis sau în viitor:
 * nomenclatorul are istoric, iar o cerere retroactivă trebuie să primească
 * procentele valabile ATUNCI, nu pe cele de azi.
 */
export async function coduriIndemnizatieMedicala(
  laData: string,
): Promise<readonly CodIndemnizatieMedicala[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("medical_leave_codes")
    .select("id, cod, denumire, procent, zile_angajator, platitor")
    .lte("valabil_de_la", laData)
    .or(`valabil_pana_la.is.null,valabil_pana_la.gte.${laData}`)
    .is("deleted_at", null)
    .order("cod", { ascending: true })
    .returns<
      {
        id: string;
        cod: string;
        denumire: string;
        procent: number;
        zile_angajator: number;
        platitor: "angajator" | "fnuass" | "mixt";
      }[]
    >();
  if (error !== null) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    cod: r.cod,
    denumire: r.denumire,
    procent: r.procent,
    zileAngajator: r.zile_angajator,
    platitor: r.platitor,
  }));
}

// ── Variantele legale ale tipurilor de concediu ───────────────────────────────

export interface VariantaConcediu {
  readonly id: string;
  readonly leave_type_key: string;
  readonly cod: string;
  readonly denumire: string;
  readonly zile: number;
  readonly conditie_descriere: string;
  readonly necesita_document: boolean;
  readonly temei_legal: string | null;
  /** `null` = variantă de platformă, needitabilă. */
  readonly organization_id: string | null;
}

/**
 * Variantele condiționate ale concediilor — paternal 15 zile cu atestat de
 * puericultură, creștere copil 3 ani pentru copilul cu handicap, căsătoria unui
 * copil, decesul unei rude de gradul II.
 *
 * Până în 0070 niciuna nu se putea introduce: triggerul din 0035 blochează
 * modificarea zilelor pe un tip reglementat, iar 0037 interzice și grilele pe
 * astfel de tipuri. Protecția rămâne — variantele sunt o a treia cale, pe care
 * angajatorul o ALEGE, nu o editează.
 *
 * RLS (`leave_type_variants_select`) le arată pe cele de platformă tuturor și
 * pe cele proprii doar organizației lor; interogarea nu filtrează.
 */
export async function varianteConcediu(): Promise<readonly VariantaConcediu[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("leave_type_variants")
    .select(
      "id, leave_type_key, cod, denumire, zile, conditie_descriere, necesita_document, temei_legal, organization_id",
    )
    .eq("activ", true)
    .is("deleted_at", null)
    .order("leave_type_key", { ascending: true })
    .order("ordine", { ascending: true })
    .returns<VariantaConcediu[]>();
  if (error !== null) throw error;
  return data ?? [];
}
