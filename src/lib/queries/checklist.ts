// src/lib/queries/checklist.ts
// Citirile modulului de onboarding: instanțe, pași, dovada de parcurgere,
// șabloane. NU se filtrează după scope (own/team/all) în cod: politicile din
// 0014_checklist.sql restrâng rândurile direct în Postgres.

import { createServerSupabase } from "@/lib/supabase/server";
import {
  SORTARI_INSTANTE,
  SORTARI_SABLOANE,
  pasEsteGata,
  type ChecklistInstantaStatus,
  type ChecklistItemStatus,
  type ChecklistResponsabilTip,
  type ChecklistTip,
  type ChecklistTipDovada,
  type ChecklistVerificare,
  type FiltreInstante,
  type FiltreSabloane,
  type RolResponsabil,
  type SortareInstante,
  type SortareSabloane,
  type ChecklistFelPas,
} from "@/schemas/checklist";

import {
  codificaCursor,
  decodificaCursor,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

// ── Cursorul keyset și sortarea ─────────────────────────────────────────────
//
// Cele DOUĂ codificări locale (una pentru instanțe, alta pentru șabloane) plus
// `ghilimeleaza` au fost înlocuite de cursorul comun din `./cursor.ts`: acolo
// cursorul poartă o valoare OPACĂ, nu un nume fix, deci aceeași structură
// servește orice coloană și orice direcție.
//
// Cheia din URL → coloana din bază. Traducerea e OBLIGATORIU explicită: numele
// coloanei intră într-un `.order()` și într-un predicat construit ca text, deci
// nu are voie să vină din query string.

const COLOANA_SORTARE_INSTANTA: Readonly<Record<SortareInstante, string>> = {
  data: "data_referinta",
  tip: "tip",
  stare: "status",
};

/** Cea mai recentă dată de referință prima — ordinea pe care o avea lista. */
const SORTARE_IMPLICITA_INSTANTE = { cheie: "data", directie: "desc" } as const;

const COLOANA_SORTARE_SABLON: Readonly<Record<SortareSabloane, string>> = {
  denumire: "denumire",
  tip: "tip",
  valabil: "valabil_de_la",
};

const SORTARE_IMPLICITA_SABLOANE = { cheie: "denumire", directie: "asc" } as const;

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
  /**
   * Câte instanțe sunt în total, după filtre. „Pagina următoare" fără un total
   * e o ușă fără indicație — nu știi dacă mai urmează un ecran sau o sută.
   */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareInstante; directie: Directie }>;
}

const COLOANE_INSTANTA =
  "id, template_id, employee_id, tip, data_referinta, status, ciclu, finalizata_la, anulata_la, created_at";

export async function listeazaInstante(
  organizationId: string,
  filtre: FiltreInstante,
): Promise<RezultatInstante> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort ?? null, SORTARI_INSTANTE, SORTARE_IMPLICITA_INSTANTE);
  const coloana = COLOANA_SORTARE_INSTANTA[sortare.cheie];
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
      is: (c: string, v: null) => Q;
      in: (c: string, v: readonly string[]) => Q;
      gte: (c: string, v: string) => Q;
      lte: (c: string, v: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.tip !== null) cu = cu.eq("tip", filtre.tip);
    if (filtre.status !== null && filtre.status.length > 0) cu = cu.in("status", filtre.status);
    if (filtre.angajat !== null) cu = cu.eq("employee_id", filtre.angajat);
    if (filtre.de_la !== null) cu = cu.gte("data_referinta", filtre.de_la);
    if (filtre.pana_la !== null) cu = cu.lte("data_referinta", filtre.pana_la);
    return cu;
  };

  let interogare = filtreaza(db.from("checklist_instances").select(COLOANE_INSTANTA))
    // Identificatorul e MEREU al doilea criteriu: data de referință nu e unică,
    // iar fără el paginarea poate sări sau repeta exact între rânduri egale.
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  // Un cursor stricat înseamnă prima pagină, nu o eroare.
  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandInstanta[]>(),
    filtreaza(db.from("checklist_instances").select("id", { count: "exact", head: true })),
  ]);
  const { data, error } = rezultat;
  if (error !== null) throw error;
  if (numarare.error !== null) throw numarare.error;
  const count = numarare.count;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoareCursor =
    ultim === undefined
      ? null
      : sortare.cheie === "tip"
        ? ultim.tip
        : sortare.cheie === "stare"
          ? ultim.status
          : ultim.data_referinta;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined && valoareCursor !== null
        ? codificaCursor({ valoare: valoareCursor, id: ultim.id })
        : null,
    total: count ?? randuri.length,
    sortare,
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
    const esteGata = pasEsteGata(rand.status);
    acumulator.set(rand.instance_id, {
      total: curent.total + 1,
      gata: curent.gata + (esteGata ? 1 : 0),
    });
  }

  return new Map(
    [...acumulator].map(([id, v]) => [
      id,
      {
        total: v.total,
        gata: v.gata,
        procent: v.total === 0 ? 0 : Math.round((100 * v.gata) / v.total),
      },
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
  /** Dovada încărcată direct în pas (0092). `null` = niciun fișier atașat. */
  readonly dovada_fisier_nume: string | null;
  readonly dovada_fisier_marime_bytes: number | null;
  readonly observatii: string | null;
  // Etapa, copiată ca text la materializare (0089). `null` pentru pașii unui
  // șablon fără etape și pentru parcursurile pornite înainte de 0089 — ecranele
  // îi grupează atunci sub „Fără etapă”.
  readonly etapa_titlu: string | null;
  readonly etapa_ordine: number | null;
  readonly etapa_termen: string | null;
  readonly fel: ChecklistFelPas;
  /** Materialul de citit (0093), cu versiunea lui curentă pentru livrare. */
  readonly material: Readonly<{
    readonly id: string;
    readonly titlu: string;
    readonly versiune_curenta_id: string | null;
  }> | null;
  // Fără `citit_la`: n-ar fi fost SELECTAT, iar un câmp declarat și neadus e
  // exact capcana „tipuri scrise de mână" — `undefined` la rulare, tăcere la
  // typecheck. Confirmarea se citește din `status`, pe care triggerul din 0093
  // îl trece pe „bifat" în aceeași tranzacție.
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
        "bifat_automat, dovada, dovada_document_id, observatii, " +
        "dovada_fisier_nume, dovada_fisier_marime_bytes, " +
        "etapa_titlu, etapa_ordine, etapa_termen, fel, " +
        // Citirea separată ar fi însemnat încă un drum; embedul e sub RLS, deci
        // materialul apare doar cui i-l arată politicile din 0093.
        "material:course_materials!checklist_instance_items_material_fk(id, titlu, versiune_curenta_id)",
    )
    .eq("organization_id", organizationId)
    .eq("instance_id", instanceId)
    .is("deleted_at", null)
    // Etapa întâi, apoi poziția în ea. `nullsFirst` ține pașii fără etapă în
    // capul listei, nu la coadă: într-un șablon mixt ei sunt cei vechi.
    .order("etapa_ordine", { ascending: true, nullsFirst: true })
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
  /** Câte șabloane sunt în total, după filtre. */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareSabloane; directie: Directie }>;
}

const COLOANE_SABLON =
  "id, denumire, tip, descriere, department_id, job_position_id, activ, valabil_de_la, valabil_pana_la";

export async function listeazaSabloane(
  organizationId: string,
  filtre: FiltreSabloane,
): Promise<RezultatSabloane> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort ?? null, SORTARI_SABLOANE, SORTARE_IMPLICITA_SABLOANE);
  const coloana = COLOANA_SORTARE_SABLON[sortare.cheie];
  const crescator = sortare.directie === "asc";

  /**
   * Filtrele mulțimii, aplicate identic pe amândouă interogările — vezi nota
   * lungă din `listeazaInstante`: o numărătoare pusă pe interogarea care poartă
   * și predicatul keyset numără doar rândurile rămase DUPĂ cursor, deci totalul
   * scade cu fiecare „mai departe”.
   */
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      ilike: (c: string, v: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.tip !== null) cu = cu.eq("tip", filtre.tip);
    if (filtre.cauta !== null) cu = cu.ilike("denumire", `%${filtre.cauta}%`);
    return cu;
  };

  let interogare = filtreaza(db.from("checklist_templates").select(COLOANE_SABLON))
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  // Un cursor stricat înseamnă prima pagină, nu o eroare.
  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandSablon[]>(),
    filtreaza(db.from("checklist_templates").select("id", { count: "exact", head: true })),
  ]);
  const { data, error } = rezultat;
  if (error !== null) throw error;
  if (numarare.error !== null) throw numarare.error;
  const count = numarare.count;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoareCursor =
    ultim === undefined
      ? null
      : sortare.cheie === "tip"
        ? ultim.tip
        : sortare.cheie === "valabil"
          ? ultim.valabil_de_la
          : ultim.denumire;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined && valoareCursor !== null
        ? codificaCursor({ valoare: valoareCursor, id: ultim.id })
        : null,
    total: count ?? randuri.length,
    sortare,
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
  /** Cursul care bifează pasul, când `verificare_automata = 'curs_finalizat'` (0076). */
  readonly curs_id: string | null;
  /** Materialul de citit cerut de pas (0093). */
  readonly material_id: string | null;
  /** Etapa din care face parte pasul (0089). `null` = șablon fără etape. */
  readonly etapa_id: string | null;
  /** Coloană GENERATĂ (0089): derivată din `tip_dovada` și `verificare_automata`. */
  readonly fel: ChecklistFelPas;
}

export interface EtapaSablon {
  readonly id: string;
  readonly ordine: number;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly termen_zile_relativ: number;
}

/** Etapele unui șablon, în ordine. Lista e goală pentru șabloanele de dinainte de 0089. */
export async function etapeleSablonului(
  organizationId: string,
  templateId: string,
): Promise<readonly EtapaSablon[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("checklist_template_stages")
    .select("id, ordine, titlu, descriere, termen_zile_relativ")
    .eq("organization_id", organizationId)
    .eq("template_id", templateId)
    .is("deleted_at", null)
    .order("ordine", { ascending: true })
    .returns<EtapaSablon[]>();

  if (error !== null) throw error;
  return data ?? [];
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
        "termen_zile_relativ, obligatoriu, tip_dovada, verificare_automata, curs_id, " +
        "material_id, etapa_id, fel",
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

export async function angajatiActivi(organizationId: string): Promise<readonly AngajatRezumat[]> {
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

// ── Sarcinile mele (0095) ───────────────────────────────────────────────────

export interface SarcinaIntegrare {
  readonly id: string;
  readonly instance_id: string;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly termen: string | null;
  readonly obligatoriu: boolean;
  readonly status: ChecklistItemStatus;
  readonly fel: ChecklistFelPas;
  readonly etapa_titlu: string | null;
  readonly employee_id: string;
}

/**
 * Pașii care îmi revin MIE, peste toate parcursurile deschise.
 *
 * Două forme de „al meu”, exact cele două ramuri din RLS:
 *   • `responsabil_employee_id` = fișa mea — materializat la pornire de 0089
 *     pentru `subiect`, `manager_direct` și `angajat`;
 *   • `responsabil_tip = 'rol'` cu rolul meu — acolo coloana rămâne NULL prin
 *     construcție, fiindcă „oricine e HR” nu e o persoană.
 *
 * Fără a doua ramură, pașii atribuiți pe rol n-ar apărea în lista nimănui, deși
 * politica îi arată. Contorul din panou și rândurile de aici vin din ACEEAȘI
 * funcție, ca să nu se repete defectul „contorul nu urmează lista”.
 */
export async function sarcinileMele(
  organizationId: string,
  employeeId: string | null,
  rol: RolResponsabil,
): Promise<readonly SarcinaIntegrare[]> {
  const db = await createServerSupabase();

  const conditii = [`and(responsabil_tip.eq.rol,responsabil_rol.eq.${rol})`];
  if (employeeId !== null) conditii.push(`responsabil_employee_id.eq.${employeeId}`);

  const { data, error } = await db
    .from("checklist_instance_items")
    .select(
      "id, instance_id, titlu, descriere, termen, obligatoriu, status, fel, etapa_titlu, employee_id, " +
        // Doar parcursurile deschise: un pas dintr-unul anulat nu mai e o treabă.
        "checklist_instances!inner(status)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["de_facut", "in_lucru"])
    .eq("checklist_instances.status", "in_curs")
    .or(conditii.join(","))
    .order("termen", { ascending: true, nullsFirst: false })
    .limit(200)
    .returns<SarcinaIntegrare[]>();

  if (error !== null) throw error;
  return data ?? [];
}
