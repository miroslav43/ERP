// src/lib/queries/ssm.ts
// Citirile modulului SSM/PSI. Ca la flotă și inventar, NU se adaugă niciun
// filtru manual de scope (own/team/all): politicile din 0011 (funcția
// `app.ssm_acces`) restrâng rândurile direct în Postgres, pe baza coloanei
// `employee_id` a fiecărui tabel. Un filtru duplicat aici ar putea diverge
// tăcut de regula reală.
//
// Politicile SELECT din 0011 NU conțin `deleted_at is null` — fiecare
// interogare de mai jos îl adaugă explicit.
//
// NU se citește `public.expirables`: politica ei cere ȘI `compliance:read`,
// pe care `hr` (care administrează SSM) nu îl are. Toate scadențele se
// calculează din tabelele sursă.
// NU se citește `ssm_legal_parameters`: e sub resursa `compliance`. Pragul de
// preaviz e constanta `PRAG_SSM_AVERTIZARE_ZILE` din `@/domain/ssm/scadente`.

import type { FiltreAngajati } from "@/schemas/employee";
import { listeazaAngajati, type RandAngajat } from "@/lib/queries/employees";
import { esteDeAtentionat, stareScadentaSsm } from "@/domain/ssm/scadente";
import { todayInBucharest } from "@/lib/format/date";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  DOMENII_SSM,
  SORTARI_ACCIDENTE,
  SORTARI_EIP,
  SORTARI_FISE,
  SORTARI_STINGATOARE,
} from "@/schemas/ssm";
import type {
  FiltreAccidente,
  FiltreEip,
  FiltreFise,
  FiltreStingatoare,
  RezultatExamen,
  SortareAccidente,
  SortareEip,
  SortareFise,
  SortareStingatoare,
  SsmDomain,
  StatusStingator,
  TipAccident,
  TipExamen,
  TipVerificareStingator,
  RezultatVerificareStingator,
} from "@/schemas/ssm";

import {
  codificaCursor,
  decodificaCursor,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

// ── Cursorul keyset ─────────────────────────────────────────────────────────
//
// Cursorul, ghilimelarea și predicatul de continuare trăiau AICI, în copii
// aproape identice — una dintre cele zece răspândite prin fișierele de citiri.
// Au fost mutate în `./cursor.ts`, unde cursorul poartă o valoare OPACĂ în loc
// de o coloană încuiată în el, deci aceeași structură servește orice sortare.
//
// Cele patru liste paginate de mai jos (fișe, accidente, stingătoare, EIP) își
// declară fiecare harta `COLOANA_SORTARE_*` — cheia românească din URL →
// coloana din bază — și își întorc sortarea EFECTIV aplicată, ca ecranul să
// poată marca `aria-sort` pe antetul corect.

// ── Nomenclatoare ────────────────────────────────────────────────────────────

export interface TipInstruire {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly domeniu: SsmDomain;
  readonly obligatoriu: boolean;
  readonly activ: boolean;
}

export async function tipuriInstruire(organizationId: string): Promise<readonly TipInstruire[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("ssm_training_types")
    .select("id, cod, denumire, domeniu, obligatoriu, activ")
    .eq("organization_id", organizationId)
    .eq("activ", true)
    .is("deleted_at", null)
    .order("domeniu", { ascending: true })
    .order("denumire", { ascending: true })
    .returns<TipInstruire[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export interface Periodicitate {
  readonly training_type_id: string;
  readonly periodicitate_luni: number | null;
  readonly durata_minima_ore: number;
  readonly valabil_de_la: string;
}

/**
 * Periodicitățile curente, o linie per tip de instruire — cea mai recentă cu
 * `valabil_de_la` ≤ azi. Un tip poate avea mai multe rânduri de istoric;
 * reducerea se face aici, în TS, ca la `app.periodicitate_instruire` din bază.
 */
export async function periodicitati(organizationId: string): Promise<readonly Periodicitate[]> {
  const db = await createServerSupabase();
  const azi = todayInBucharest();
  const { data, error } = await db
    .from("ssm_training_type_periods")
    .select("training_type_id, periodicitate_luni, durata_minima_ore, valabil_de_la")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .lte("valabil_de_la", azi)
    .order("valabil_de_la", { ascending: false })
    .returns<Periodicitate[]>();

  if (error !== null) throw error;

  const curente = new Map<string, Periodicitate>();
  for (const rand of data ?? []) {
    if (!curente.has(rand.training_type_id)) curente.set(rand.training_type_id, rand);
  }
  return [...curente.values()];
}

// ── Matricea de instruiri ────────────────────────────────────────────────────

export interface RandInstruire {
  readonly id: string;
  readonly employee_id: string;
  readonly training_type_id: string;
  readonly data_instruirii: string;
  readonly durata_ore: number;
  readonly urmatoarea_scadenta: string | null;
  readonly semnatura_confirmata: boolean;
}

export interface IntrareMatrice {
  readonly organizationId: string;
  readonly scope: import("@/config/permissions").PermissionScope;
  readonly propriaFisaId: string | null;
  readonly filtre: FiltreAngajati;
}

export interface RezultatMatriceInstruiri {
  readonly angajati: readonly RandAngajat[];
  readonly urmatorulCursor: string | null;
  /** Cea mai recentă instruire per `"employeeId:trainingTypeId"`. */
  readonly celeMaiRecente: ReadonlyMap<string, RandInstruire>;
}

export function cheieMatrice(employeeId: string, trainingTypeId: string): string {
  return `${employeeId}:${trainingTypeId}`;
}

/**
 * Matricea angajați × tipuri de instruire, paginată DUPĂ ANGAJAT (nu după
 * rând): o pagină de 25 de angajați × ~6 tipuri rămâne oricum sub 1000 de
 * rânduri, dar mecanismul de pagină e cel al angajaților, deja scris în
 * `listeazaAngajati`.
 */
export async function matriceInstruiri(intrare: IntrareMatrice): Promise<RezultatMatriceInstruiri> {
  const { organizationId, scope, propriaFisaId, filtre } = intrare;
  const { randuri: angajati, urmatorulCursor } = await listeazaAngajati({
    organizationId,
    scope,
    propriaFisaId,
    filtre,
  });

  if (angajati.length === 0) {
    return { angajati: [], urmatorulCursor: null, celeMaiRecente: new Map() };
  }

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("ssm_trainings")
    .select(
      "id, employee_id, training_type_id, data_instruirii, durata_ore, urmatoarea_scadenta, semnatura_confirmata",
    )
    .eq("organization_id", organizationId)
    .in(
      "employee_id",
      angajati.map((a) => a.id),
    )
    .is("deleted_at", null)
    .order("data_instruirii", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<RandInstruire[]>();

  if (error !== null) throw error;

  const celeMaiRecente = new Map<string, RandInstruire>();
  for (const rand of data ?? []) {
    const cheie = cheieMatrice(rand.employee_id, rand.training_type_id);
    // Rândurile sunt sortate descrescător: primul întâlnit e cel mai recent.
    if (!celeMaiRecente.has(cheie)) celeMaiRecente.set(cheie, rand);
  }

  return { angajati, urmatorulCursor, celeMaiRecente };
}

/**
 * Instruirile PROPRII ale utilizatorului curent, fără niciun filtru pe
 * angajat: RLS (`ssm_acces` cu scope „own”) restrânge singur la propria fișă.
 * Filtrul pe organizație rămâne explicit, la fel ca peste tot în modul — un
 * utilizator care aparține la mai multe organizații nu trebuie să vadă
 * instruirile amestecate.
 */
export async function instruirileMele(organizationId: string): Promise<readonly RandInstruire[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("ssm_trainings")
    .select(
      "id, employee_id, training_type_id, data_instruirii, durata_ore, urmatoarea_scadenta, semnatura_confirmata",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("data_instruirii", { ascending: false })
    .returns<RandInstruire[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Instruirile unui angajat anume, cu filtru EXPLICIT pe fișă.
 *
 * `instruirileMele` de mai sus se sprijină pe RLS, ceea ce e corect în aplicația
 * mare — dar `app.ssm_acces` (`0011_ssm.sql:466-478`) trece necondiționat pe
 * prima ramură pentru `ssm:read = all`. Un `hr` care ar deschide un ecran „ale
 * mele" construit pe ea ar primi instruirile ÎNTREGII firme, etichetate ca fiind
 * ale lui. Vezi avertismentul din capul lui `queries/portal.ts`.
 *
 * NU aduce denumirea tipului: `ssm_training_types` are coloană de scope `null`
 * în bucla de politici, deci cere `ssm:read >= team` — un angajat nu-l poate
 * citi cu clientul lui. Denumirile vin separat, prin `nomenclatorInstruiri`
 * (acțiune cu client admin). Capcana 27.
 */
export async function instruirileAngajatului(
  organizationId: string,
  employeeId: string,
): Promise<readonly RandInstruire[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("ssm_trainings")
    .select(
      "id, employee_id, training_type_id, data_instruirii, durata_ore, urmatoarea_scadenta, semnatura_confirmata",
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("data_instruirii", { ascending: false })
    .returns<RandInstruire[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Restul dosarului SSM propriu — fișe de aptitudine, restricții, EIP,
 * autorizații nominale — cu filtru EXPLICIT pe angajat.
 *
 * Toate variantele „generale” de mai jos trec prin `app.ssm_acces`, a cărei
 * primă ramură (`can(..., 'all')`) e adevărată necondiționat pentru `hr` sau
 * `org_admin`. Un ecran „dosarul meu” construit pe ele ar arăta fișele de
 * aptitudine, restricțiile medicale și echipamentul de protecție ale ÎNTREGII
 * firme — la fișe și la restricții, date privind sănătatea (art. 9 GDPR).
 *
 * `COLOANE_FISA` rămâne neatins: `observatii` și `cost` nu se citesc niciodată.
 */
export async function fiseAptitudineAngajat(
  organizationId: string,
  employeeId: string,
  limita = 20,
): Promise<readonly RandFisa[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("occupational_health_exams")
    .select(COLOANE_FISA)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("data_examinarii", { ascending: false })
    .limit(limita)
    .returns<RandFisa[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export async function restrictiiActiveAngajat(
  organizationId: string,
  employeeId: string,
): Promise<readonly RestrictieActiva[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employee_work_restrictions")
    .select(
      "id, employee_id, exam_id, sursa, restrictie, valabil_de_la, valabil_pana, generata_automat, ridicata_la",
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .is("ridicata_la", null)
    .order("valabil_de_la", { ascending: false })
    .limit(100)
    .returns<RestrictieActiva[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export async function eipAngajatului(
  organizationId: string,
  employeeId: string,
  limita = 100,
): Promise<readonly RandEip[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("ppe_issuances")
    .select(COLOANE_EIP)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("data_predarii", { ascending: false })
    .limit(limita)
    .returns<RandEip[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export async function autorizatiiNominaleAngajat(
  organizationId: string,
  employeeId: string,
): Promise<readonly RandAutorizatieNominala[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("personnel_authorizations")
    .select("id, employee_id, tip, grupa, numar, emitent, emis_la, valabil_pana, suspendata_la")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("valabil_pana", { ascending: true })
    .limit(100)
    .returns<RandAutorizatieNominala[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Medicina muncii ──────────────────────────────────────────────────────────

export interface RandFisa {
  readonly id: string;
  readonly employee_id: string;
  readonly tip: TipExamen;
  readonly data_examinarii: string;
  readonly medic: string | null;
  readonly unitate_medicala: string | null;
  readonly rezultat: RezultatExamen;
  readonly valabil_pana: string | null;
  readonly numar_fisa: string | null;
}

export interface RezultatFise {
  readonly randuri: readonly RandFisa[];
  readonly urmatorulCursor: string | null;
  /** Câte fișe sunt în total, după filtre — „pagina următoare” fără total e o ușă fără indicație. */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareFise; directie: Directie }>;
}

const COLOANA_SORTARE_FISE: Readonly<Record<SortareFise, string>> = {
  data: "data_examinarii",
  tip: "tip",
  rezultat: "rezultat",
};

const SORTARE_IMPLICITA_FISE = { cheie: "data", directie: "desc" } as const;

/**
 * FĂRĂ `observatii`, FĂRĂ `cost` — art. 9 GDPR. Coloanele acestea nici nu se
 * citesc, ca să nu ajungă niciodată, din greșeală, într-un ecran.
 */
const COLOANE_FISA =
  "id, employee_id, tip, data_examinarii, medic, unitate_medicala, rezultat, valabil_pana, numar_fisa";

export async function fiseAptitudine(
  organizationId: string,
  filtre: FiltreFise,
): Promise<RezultatFise> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort, SORTARI_FISE, SORTARE_IMPLICITA_FISE);
  const coloana = COLOANA_SORTARE_FISE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  let interogare = db
    .from("occupational_health_exams")
    // `count: "exact"` pe aceeași interogare: numărătoarea respectă filtrele ȘI
    // politicile RLS, fără un al doilea drum la bază care le-ar putea aplica altfel.
    .select(COLOANE_FISA, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    // Identificatorul e MEREU al doilea criteriu: data examinării nu e unică,
    // iar fără el ordinea dintre două fișe din aceeași zi e nedefinită, deci
    // paginarea poate sări sau repeta exact acolo.
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.rezultat !== null) interogare = interogare.eq("rezultat", filtre.rezultat);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandFisa[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoareCursor =
    ultim === undefined
      ? null
      : sortare.cheie === "tip"
        ? ultim.tip
        : sortare.cheie === "rezultat"
          ? ultim.rezultat
          : ultim.data_examinarii;

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

export interface RestrictieActiva {
  readonly id: string;
  readonly employee_id: string;
  readonly exam_id: string | null;
  readonly sursa: string;
  readonly restrictie: string;
  readonly valabil_de_la: string;
  readonly valabil_pana: string | null;
  readonly generata_automat: boolean;
  readonly ridicata_la: string | null;
}

export async function restrictiiActive(
  organizationId: string,
): Promise<readonly RestrictieActiva[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employee_work_restrictions")
    .select(
      "id, employee_id, exam_id, sursa, restrictie, valabil_de_la, valabil_pana, generata_automat, ridicata_la",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("ridicata_la", null)
    .order("valabil_de_la", { ascending: false })
    .limit(200)
    .returns<RestrictieActiva[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Accidente de muncă ───────────────────────────────────────────────────────

export interface RandAccident {
  readonly id: string;
  readonly numar_intern: string | null;
  readonly employee_id: string | null;
  readonly data_producerii: string;
  readonly ora_producerii: string | null;
  readonly locul: string;
  readonly tip: TipAccident;
  readonly zile_incapacitate: number;
  readonly comunicat_la_itm_la: string | null;
  readonly termen_comunicare_ore: number | null;
  readonly cercetare_finalizata_la: string | null;
}

export interface RezultatAccidente {
  readonly randuri: readonly RandAccident[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
  readonly sortare: Readonly<{ cheie: SortareAccidente; directie: Directie }>;
}

const COLOANA_SORTARE_ACCIDENTE: Readonly<Record<SortareAccidente, string>> = {
  data: "data_producerii",
  tip: "tip",
};

const SORTARE_IMPLICITA_ACCIDENTE = { cheie: "data", directie: "desc" } as const;

const COLOANE_ACCIDENT =
  "id, numar_intern, employee_id, data_producerii, ora_producerii, locul, tip, " +
  "zile_incapacitate, comunicat_la_itm_la, termen_comunicare_ore, cercetare_finalizata_la";

export async function accidente(
  organizationId: string,
  filtre: FiltreAccidente,
): Promise<RezultatAccidente> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort, SORTARI_ACCIDENTE, SORTARE_IMPLICITA_ACCIDENTE);
  const coloana = COLOANA_SORTARE_ACCIDENTE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  let interogare = db
    .from("work_accidents")
    .select(COLOANE_ACCIDENT, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.tip !== null) interogare = interogare.eq("tip", filtre.tip);
  if (filtre.necomunicate !== null) interogare = interogare.is("comunicat_la_itm_la", null);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandAccident[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoareCursor =
    ultim === undefined ? null : sortare.cheie === "tip" ? ultim.tip : ultim.data_producerii;

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

export interface AccidentDetaliu extends RandAccident {
  readonly imprejurari: string;
  readonly numar_proces_verbal: string | null;
  readonly urmari: string | null;
  readonly created_at: string;
}

export async function citesteAccident(
  organizationId: string,
  id: string,
): Promise<AccidentDetaliu | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("work_accidents")
    .select(`${COLOANE_ACCIDENT}, imprejurari, numar_proces_verbal, urmari, created_at`)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<AccidentDetaliu>();

  if (error !== null) throw error;
  return data;
}

export interface AccidentNecomunicat {
  readonly id: string;
  readonly numar_intern: string | null;
  readonly employee_id: string | null;
  readonly data_producerii: string;
  readonly ora_producerii: string | null;
  readonly tip: TipAccident;
  readonly termen_comunicare_ore: number | null;
}

/** Accidentele fără `comunicat_la_itm_la`, pentru banda de pe `/ssm`. */
export async function accidenteNecomunicate(
  organizationId: string,
): Promise<readonly AccidentNecomunicat[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("work_accidents")
    .select(
      "id, numar_intern, employee_id, data_producerii, ora_producerii, tip, termen_comunicare_ore",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("comunicat_la_itm_la", null)
    .order("data_producerii", { ascending: true })
    .limit(50)
    .returns<AccidentNecomunicat[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Stingătoare (PSI) ────────────────────────────────────────────────────────

export interface RandStingator {
  readonly id: string;
  readonly cod: string;
  readonly tip: string;
  readonly masa_kg: number | null;
  readonly cladire: string | null;
  readonly locatie: string;
  readonly producator: string | null;
  readonly serie: string | null;
  readonly data_punerii_in_functiune: string | null;
  readonly ultima_verificare: string | null;
  readonly ultima_reincarcare: string | null;
  readonly ultima_proba_presiune: string | null;
  readonly scadenta_verificare: string | null;
  readonly scadenta_reincarcare: string | null;
  readonly scadenta_proba_presiune: string | null;
  readonly status: StatusStingator;
}

export interface RezultatStingatoare {
  readonly randuri: readonly RandStingator[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
  readonly sortare: Readonly<{ cheie: SortareStingatoare; directie: Directie }>;
}

/**
 * Cele trei scadențe NU sunt sortabile: coloanele `scadenta_*` pot fi NULL
 * (un stingător fără nicio verificare înregistrată), iar o valoare nulă n-are
 * ce căuta într-un cursor keyset — paginarea ar sări rânduri fără nicio eroare.
 */
const COLOANA_SORTARE_STINGATOARE: Readonly<Record<SortareStingatoare, string>> = {
  cod: "cod",
  locatie: "locatie",
  stare: "status",
};

const SORTARE_IMPLICITA_STINGATOARE = { cheie: "cod", directie: "asc" } as const;

const COLOANE_STINGATOR =
  "id, cod, tip, masa_kg, cladire, locatie, producator, serie, data_punerii_in_functiune, ultima_verificare, " +
  "ultima_reincarcare, ultima_proba_presiune, scadenta_verificare, scadenta_reincarcare, " +
  "scadenta_proba_presiune, status";

export async function stingatoare(
  organizationId: string,
  filtre: FiltreStingatoare,
): Promise<RezultatStingatoare> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort, SORTARI_STINGATOARE, SORTARE_IMPLICITA_STINGATOARE);
  const coloana = COLOANA_SORTARE_STINGATOARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  let interogare = db
    .from("fire_extinguishers")
    .select(COLOANE_STINGATOR, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  // Casatele ies din listă cât timp nu sunt cerute EXPLICIT prin filtru.
  //
  // `contorStingatoare` le exclude de la bun început (`.neq` mai jos, în acest
  // fișier), lista nu le excludea — iar cele trei scadențe li se evaluau ca
  // oricărui alt stingător. Rezultatul se vedea pe același ecran: panoul spunea
  // „3 verificări scadente", lista deschisă din el arăta cinci rânduri
  // „Expirat", două dintre ele pe stingătoare scoase din uz acum doi ani. Un
  // stingător casat nu mai are obligație de verificare; a-l număra printre
  // restanțe e o cifră greșită fără nicio eroare.
  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);
  else interogare = interogare.neq("status", "casat");
  if (filtre.cauta !== null) interogare = interogare.ilike("cod", `%${filtre.cauta}%`);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandStingator[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoareCursor =
    ultim === undefined
      ? null
      : sortare.cheie === "locatie"
        ? ultim.locatie
        : sortare.cheie === "stare"
          ? ultim.status
          : ultim.cod;

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

export async function citesteStingator(
  organizationId: string,
  id: string,
): Promise<RandStingator | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fire_extinguishers")
    .select(COLOANE_STINGATOR)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandStingator>();

  if (error !== null) throw error;
  return data;
}

export interface VerificareStingatorRand {
  readonly id: string;
  readonly tip_verificare: TipVerificareStingator;
  readonly data: string;
  readonly executant: string | null;
  readonly firma_autorizata: string | null;
  readonly rezultat: RezultatVerificareStingator;
  readonly cost: number | null;
  readonly observatii: string | null;
}

export async function verificariStingator(
  extinguisherId: string,
): Promise<readonly VerificareStingatorRand[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fire_extinguisher_checks")
    .select("id, tip_verificare, data, executant, firma_autorizata, rezultat, cost, observatii")
    .eq("extinguisher_id", extinguisherId)
    .is("deleted_at", null)
    .order("data", { ascending: false })
    .returns<VerificareStingatorRand[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Echipament individual de protecție ──────────────────────────────────────

export interface RandEip {
  readonly id: string;
  readonly employee_id: string;
  readonly articol: string;
  readonly cod_articol: string | null;
  readonly cantitate: number;
  readonly unitate: string;
  readonly data_predarii: string;
  readonly durata_utilizare_luni: number | null;
  readonly data_inlocuirii: string | null;
  readonly semnatura_confirmata: boolean;
  readonly returnat_la: string | null;
}

export interface RezultatEip {
  readonly randuri: readonly RandEip[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
  readonly sortare: Readonly<{ cheie: SortareEip; directie: Directie }>;
}

const COLOANA_SORTARE_EIP: Readonly<Record<SortareEip, string>> = {
  articol: "articol",
  predat: "data_predarii",
};

const SORTARE_IMPLICITA_EIP = { cheie: "predat", directie: "desc" } as const;

const COLOANE_EIP =
  "id, employee_id, articol, cod_articol, cantitate, unitate, data_predarii, " +
  "durata_utilizare_luni, data_inlocuirii, semnatura_confirmata, returnat_la";

export async function eip(organizationId: string, filtre: FiltreEip): Promise<RezultatEip> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort, SORTARI_EIP, SORTARE_IMPLICITA_EIP);
  const coloana = COLOANA_SORTARE_EIP[sortare.cheie];
  const crescator = sortare.directie === "asc";

  let interogare = db
    .from("ppe_issuances")
    .select(COLOANE_EIP, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandEip[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoareCursor =
    ultim === undefined ? null : sortare.cheie === "articol" ? ultim.articol : ultim.data_predarii;

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

// ── Autorizații nominale ─────────────────────────────────────────────────────

export interface RandAutorizatieNominala {
  readonly id: string;
  readonly employee_id: string;
  readonly tip: string;
  readonly grupa: string | null;
  readonly numar: string;
  readonly emitent: string;
  readonly emis_la: string | null;
  readonly valabil_pana: string;
  readonly suspendata_la: string | null;
}

/** Nomenclator relativ mic (o autorizație per angajat calificat) — fără paginare. */
export async function autorizatiiNominale(
  organizationId: string,
): Promise<readonly RandAutorizatieNominala[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("personnel_authorizations")
    .select("id, employee_id, tip, grupa, numar, emitent, emis_la, valabil_pana, suspendata_la")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("valabil_pana", { ascending: true })
    .limit(500)
    .returns<RandAutorizatieNominala[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Angajați, citiți separat ─────────────────────────────────────────────────
//
// NU prin embed: cel care vede accidentele sau instruirile nu are neapărat
// `employees:read`, iar un embed refuzat de RLS vine NULL fără nicio eroare —
// o coloană goală pe care nimeni n-o explică. Citirea separată face absența
// vizibilă și tipabilă (la fel ca în `queries/fleet.ts`).

export interface AngajatRezumat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

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

// ── Contoare pentru panoul de organizație ────────────────────────────────────
//
// Contoare de tablou de bord, nu registre legale: reduc istoricul la cea mai
// recentă înregistrare per pereche relevantă și numără câte ies din starea
// „ok” (`stareScadentaSsm`). Mărginite cu `.limit(2000)` — panoul e un rezumat,
// nu locul unde se verifică exhaustiv acoperirea; lista completă e ecranul
// dedicat fiecărui grup.

export interface ContorDomeniu {
  readonly domeniu: SsmDomain;
  readonly deAtentionat: number;
}

interface RandInstruireDomeniu {
  readonly employee_id: string;
  readonly training_type_id: string;
  readonly data_instruirii: string;
  readonly urmatoarea_scadenta: string | null;
  readonly tip: { readonly domeniu: SsmDomain } | null;
}

/** Instruiri SSM și PSI cu scadență apropiată/expirată — NICIODATĂ însumate. */
export async function contorInstruiri(organizationId: string): Promise<readonly ContorDomeniu[]> {
  const db = await createServerSupabase();
  const azi = todayInBucharest();

  const { data, error } = await db
    .from("ssm_trainings")
    .select(
      "employee_id, training_type_id, data_instruirii, urmatoarea_scadenta, " +
        "tip:ssm_training_types!inner(domeniu)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("data_instruirii", { ascending: false })
    .limit(2000)
    .returns<RandInstruireDomeniu[]>();

  if (error !== null) throw error;

  const recente = new Map<
    string,
    { readonly domeniu: SsmDomain; readonly scadenta: string | null }
  >();
  for (const rand of data ?? []) {
    if (rand.tip === null) continue;
    const cheie = cheieMatrice(rand.employee_id, rand.training_type_id);
    if (!recente.has(cheie)) {
      recente.set(cheie, { domeniu: rand.tip.domeniu, scadenta: rand.urmatoarea_scadenta });
    }
  }

  const contoare = new Map<SsmDomain, number>(DOMENII_SSM.map((d) => [d, 0]));
  for (const { domeniu, scadenta } of recente.values()) {
    if (esteDeAtentionat(stareScadentaSsm(true, scadenta, azi))) {
      contoare.set(domeniu, (contoare.get(domeniu) ?? 0) + 1);
    }
  }

  return DOMENII_SSM.map((d) => ({ domeniu: d, deAtentionat: contoare.get(d) ?? 0 }));
}

export interface ContorStingatoare {
  readonly verificare: number;
  readonly reincarcare: number;
  readonly probaPresiune: number;
}

interface RandStingatorScadente {
  readonly ultima_verificare: string | null;
  readonly scadenta_verificare: string | null;
  readonly ultima_reincarcare: string | null;
  readonly scadenta_reincarcare: string | null;
  readonly ultima_proba_presiune: string | null;
  readonly scadenta_proba_presiune: string | null;
}

/** Cele TREI obligații ale unui stingător, numărate separat — au periodicități diferite. */
export async function contorStingatoare(organizationId: string): Promise<ContorStingatoare> {
  const db = await createServerSupabase();
  const azi = todayInBucharest();

  const { data, error } = await db
    .from("fire_extinguishers")
    .select(
      "ultima_verificare, scadenta_verificare, ultima_reincarcare, scadenta_reincarcare, " +
        "ultima_proba_presiune, scadenta_proba_presiune",
    )
    .eq("organization_id", organizationId)
    .neq("status", "casat")
    .is("deleted_at", null)
    .returns<RandStingatorScadente[]>();

  if (error !== null) throw error;

  let verificare = 0;
  let reincarcare = 0;
  let probaPresiune = 0;
  for (const rand of data ?? []) {
    if (
      esteDeAtentionat(
        stareScadentaSsm(rand.ultima_verificare !== null, rand.scadenta_verificare, azi),
      )
    ) {
      verificare += 1;
    }
    if (
      esteDeAtentionat(
        stareScadentaSsm(rand.ultima_reincarcare !== null, rand.scadenta_reincarcare, azi),
      )
    ) {
      reincarcare += 1;
    }
    if (
      esteDeAtentionat(
        stareScadentaSsm(rand.ultima_proba_presiune !== null, rand.scadenta_proba_presiune, azi),
      )
    ) {
      probaPresiune += 1;
    }
  }

  return { verificare, reincarcare, probaPresiune };
}

interface RandFisaScadenta {
  readonly employee_id: string;
  readonly data_examinarii: string;
  readonly valabil_pana: string | null;
}

/** Fișele de aptitudine cu valabilitate apropiată/expirată — cea mai recentă per angajat. */
export async function contorFiseAptitudine(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const azi = todayInBucharest();

  const { data, error } = await db
    .from("occupational_health_exams")
    .select("employee_id, data_examinarii, valabil_pana")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("data_examinarii", { ascending: false })
    .limit(2000)
    .returns<RandFisaScadenta[]>();

  if (error !== null) throw error;

  const recente = new Map<string, string | null>();
  for (const rand of data ?? []) {
    if (!recente.has(rand.employee_id)) recente.set(rand.employee_id, rand.valabil_pana);
  }

  let n = 0;
  for (const valabilPana of recente.values()) {
    if (esteDeAtentionat(stareScadentaSsm(true, valabilPana, azi))) n += 1;
  }
  return n;
}

/** Autorizațiile nominale (ISCIR, lucru la înălțime etc.) cu scadență apropiată/expirată. */
export async function contorAutorizatiiNominale(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const azi = todayInBucharest();

  const { data, error } = await db
    .from("personnel_authorizations")
    .select("valabil_pana, suspendata_la")
    .eq("organization_id", organizationId)
    .is("suspendata_la", null) // o autorizație suspendată nu mai e „în uz” — nu cere atenție de reînnoire
    .is("deleted_at", null)
    .limit(2000)
    .returns<{ valabil_pana: string; suspendata_la: string | null }[]>();

  if (error !== null) throw error;

  let n = 0;
  for (const rand of data ?? []) {
    if (esteDeAtentionat(stareScadentaSsm(true, rand.valabil_pana, azi))) n += 1;
  }
  return n;
}

/**
 * `ppe_issuances` nu are o coloană „valabil_pana” — data țintă e derivată:
 * `data_inlocuirii` dacă e completată explicit, altfel `data_predarii +
 * durata_utilizare_luni`. Simplificare asumată (ca restul modulului SSM):
 * nu există azi niciun ecran care afișează o scadență calculată pentru EIP,
 * doar datele brute — asta e prima interpretare a lor ca „scadență”.
 */
function scadentaEip(
  dataPredarii: string,
  durataLuni: number | null,
  dataInlocuirii: string | null,
): string | null {
  if (dataInlocuirii !== null) return dataInlocuirii;
  if (durataLuni === null) return null;
  const [an, luna, zi] = dataPredarii.split("-").map(Number);
  const data = new Date(Date.UTC(an ?? 0, (luna ?? 1) - 1 + durataLuni, zi ?? 1));
  return data.toISOString().slice(0, 10);
}

/** Echipamentul individual de protecție încă în uz, cu scadență apropiată/expirată. */
export async function contorEip(organizationId: string): Promise<number> {
  const db = await createServerSupabase();
  const azi = todayInBucharest();

  const { data, error } = await db
    .from("ppe_issuances")
    .select("data_predarii, durata_utilizare_luni, data_inlocuirii, returnat_la")
    .eq("organization_id", organizationId)
    .is("returnat_la", null) // returnat = nu mai e în uz, nu cere atenție
    .is("deleted_at", null)
    .limit(2000)
    .returns<
      {
        data_predarii: string;
        durata_utilizare_luni: number | null;
        data_inlocuirii: string | null;
        returnat_la: string | null;
      }[]
    >();

  if (error !== null) throw error;

  let n = 0;
  for (const rand of data ?? []) {
    const scadenta = scadentaEip(
      rand.data_predarii,
      rand.durata_utilizare_luni,
      rand.data_inlocuirii,
    );
    if (scadenta !== null && esteDeAtentionat(stareScadentaSsm(true, scadenta, azi))) n += 1;
  }
  return n;
}

/**
 * Totalul pentru badge-ul de navigare „ssm_expiring” — instruiri, stingătoare,
 * fișe de aptitudine, autorizații nominale și EIP. Primele trei erau singurele
 * numărate până acum, deși autorizațiile și EIP au aceleași date de scadență.
 */
export async function numarScadenteSsm(organizationId: string): Promise<number> {
  const [instruiri, stingatoarele, fise, autorizatii, eipDeAtentionat] = await Promise.all([
    contorInstruiri(organizationId),
    contorStingatoare(organizationId),
    contorFiseAptitudine(organizationId),
    contorAutorizatiiNominale(organizationId),
    contorEip(organizationId),
  ]);

  const totalInstruiri = instruiri.reduce((suma, c) => suma + c.deAtentionat, 0);
  return (
    totalInstruiri +
    stingatoarele.verificare +
    stingatoarele.reincarcare +
    stingatoarele.probaPresiune +
    fise +
    autorizatii +
    eipDeAtentionat
  );
}
