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
import { todayInBucharest } from "@/lib/format/date";
import { cereActiune, stareScadentaPlan } from "@/domain/maintenance/scadente";
import { STARI_DESCHISE_SESIZARE } from "@/domain/maintenance/sesizari";
import type {
  EntitateAtasament,
  FiltreEchipamente,
  FiltreInterventii,
  FiltreSesizari,
  MarcajCe,
  MotivRespingere,
  RezultatInterventie,
  SortareEchipamente,
  SortareInterventii,
  SortareSesizari,
  StatusEchipament,
  StatusSesizare,
  TipAtasament,
  TipContor,
  TipMentenanta,
  TipOprire,
  UrgentaSesizare,
} from "@/schemas/maintenance";
import {
  SORTARI_ECHIPAMENTE,
  SORTARI_INTERVENTII,
  SORTARI_SESIZARI,
  TIPURI_CONTOR,
} from "@/schemas/maintenance";

import {
  codificaCursor,
  decodificaCursor,
  predicatKeyset,
  sortareCeruta,
  type Directie,
  tiparContine,
} from "./cursor";

// ── Cursorul keyset ─────────────────────────────────────────────────────────
//
// Codificarea, ghilimelarea și predicatul trăiau AICI, în copii aproape
// identice răspândite prin zece fișiere de citiri. Au fost mutate în
// `./cursor.ts`, unde cursorul poartă o VALOARE opacă în loc de o coloană
// încuiată în el — deci aceeași structură servește orice sortare.

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
  // 0182
  readonly categorie: string | null;
  readonly punct_lucru_id: string | null;
  readonly garantie_expira: string | null;
  readonly parent_equipment_id: string | null;
  readonly casat_la: string | null;
  readonly folosit_in_afara_sediului: boolean;
}

export interface RezultatEchipamente {
  readonly randuri: readonly RandEchipament[];
  readonly urmatorulCursor: string | null;
  /**
   * Câte echipamente sunt în total, după filtre. „Pagina următoare” fără un
   * total e o ușă fără indicație: nu știi dacă mai urmează un ecran sau o sută.
   */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareEchipamente; directie: Directie }>;
}

export interface Echipament extends RandEchipament {
  readonly valoare_achizitie: number | null;
  readonly derogare_motiv: string | null;
  readonly derogare_acordata_de: string | null;
  readonly derogare_acordata_la: string | null;
  // 0182
  readonly service_garantie: string | null;
  readonly motiv_casare: string | null;
  readonly observatii: string | null;
  readonly marcaj_ce: MarcajCe;
  readonly risc_specific: boolean;
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
  readonly total: number;
  readonly sortare: Readonly<{ cheie: SortareInterventii; directie: Directie }>;
}

export interface RandSesizare {
  readonly id: string;
  readonly numar: string;
  readonly equipment_id: string;
  readonly raportat_de_employee_id: string | null;
  readonly raportat_de_user_id: string | null;
  readonly descriere: string;
  readonly urgenta: UrgentaSesizare;
  readonly status: StatusSesizare;
  readonly raportat_la: string;
  readonly opreste_functionarea: boolean;
  readonly intervention_id: string | null;
  readonly rezolvat_la: string | null;
  readonly inchis_la: string | null;
  readonly motiv_respingere: string | null;
  readonly motiv_respingere_tip: MotivRespingere | null;
  readonly atribuit_employee_id: string | null;
  readonly atribuit_la: string | null;
  readonly redeschisa_de_ori: number;
  readonly motiv_redeschidere: string | null;
  readonly duplicat_al_id: string | null;
  readonly nota_rezolvare: string | null;
}

export interface ComentariuSesizare {
  readonly id: string;
  readonly autor_employee_id: string | null;
  readonly autor_user_id: string | null;
  readonly continut: string;
  readonly intern: boolean;
  readonly created_at: string;
}

export interface IstoricSesizare {
  readonly id: string;
  readonly actor_user_id: string | null;
  readonly camp: string;
  readonly valoare_veche: string | null;
  readonly valoare_noua: string | null;
  readonly motiv: string | null;
  readonly created_at: string;
}

export interface Atasament {
  readonly id: string;
  readonly entity_type: EntitateAtasament;
  readonly entity_id: string;
  readonly storage_path: string;
  readonly denumire: string;
  readonly tip: TipAtasament;
  readonly mime: string | null;
  readonly marime_bytes: number | null;
  readonly created_by: string | null;
  readonly created_at: string;
}

export interface Oprire {
  readonly id: string;
  readonly equipment_id: string;
  readonly inceput: string;
  readonly sfarsit: string | null;
  readonly tip: TipOprire;
  readonly motiv: string | null;
  readonly fault_report_id: string | null;
  readonly intervention_id: string | null;
}

export interface SetariMentenanta {
  readonly id: string | null;
  readonly responsabili: readonly string[];
  readonly rsvti_employee_id: string | null;
  readonly inchidere_automata_zile: number;
  readonly prag_avertizare_zile: number;
  readonly prag_contor_necitit_zile: number;
  readonly ore_functionare_pe_zi: number;
  readonly zile_pe_saptamana: number;
  readonly cost_ora_oprire: number | null;
}

/** Implicitele din `default`-urile tabelei `maintenance_settings` (0181) — identice. */
export const SETARI_MENTENANTA_IMPLICITE: SetariMentenanta = {
  id: null,
  responsabili: [],
  rsvti_employee_id: null,
  inchidere_automata_zile: 5,
  prag_avertizare_zile: 15,
  prag_contor_necitit_zile: 30,
  ore_functionare_pe_zi: 8,
  zile_pe_saptamana: 5,
  cost_ora_oprire: null,
};

export interface RezultatSesizari {
  readonly randuri: readonly RandSesizare[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
  readonly sortare: Readonly<{ cheie: SortareSesizari; directie: Directie }>;
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

/**
 * Cheia din URL → coloana din bază. Traducerea e OBLIGATORIU explicită: numele
 * coloanei intră într-un `.order()` și într-un predicat construit ca text, deci
 * nu are voie să vină din afară. Cheile sunt românești fiindcă apar în adresa pe
 * care omul o copiază; coloanele rămân englezești, ca tot restul schemei.
 */
const COLOANA_SORTARE_ECHIPAMENT: Readonly<Record<SortareEchipamente, string>> = {
  cod: "cod",
  denumire: "denumire",
  stare: "status",
};

/** Valoarea de cursor a ultimului rând, pe fiecare sortare posibilă. */
const VALOARE_CURSOR_ECHIPAMENT: Readonly<
  Record<SortareEchipamente, (e: RandEchipament) => string>
> = {
  cod: (e) => e.cod,
  denumire: (e) => e.denumire,
  stare: (e) => e.status,
};

const SORTARE_IMPLICITA_ECHIPAMENTE = { cheie: "cod", directie: "asc" } as const;

const COLOANA_SORTARE_INTERVENTIE: Readonly<Record<SortareInterventii, string>> = {
  data: "data",
  tip: "tip",
  cost: "cost_total",
  rezultat: "rezultat",
};

const VALOARE_CURSOR_INTERVENTIE: Readonly<
  Record<SortareInterventii, (i: RandInterventie) => string>
> = {
  data: (i) => i.data,
  tip: (i) => i.tip,
  // `cost_total` e generată din două coloane `not null default 0`, deci nu e
  // niciodată NULL în bază; `?? 0` acoperă doar tipul, nu un caz real.
  cost: (i) => String(i.cost_total ?? 0),
  rezultat: (i) => i.rezultat,
};

const SORTARE_IMPLICITA_INTERVENTII = { cheie: "data", directie: "desc" } as const;

const COLOANA_SORTARE_SESIZARE: Readonly<Record<SortareSesizari, string>> = {
  raportat: "raportat_la",
  urgenta: "urgenta",
  stare: "status",
};

const VALOARE_CURSOR_SESIZARE: Readonly<Record<SortareSesizari, (s: RandSesizare) => string>> = {
  raportat: (s) => s.raportat_la,
  urgenta: (s) => s.urgenta,
  stare: (s) => s.status,
};

const SORTARE_IMPLICITA_SESIZARI = { cheie: "raportat", directie: "desc" } as const;

/**
 * `sort` e opțional în SEMNĂTURĂ, nu în schemă.
 *
 * Ecranele care listează îl parsează din URL și îl trimit întreg; apelanții care
 * cer o felie fixă — fișa echipamentului, panoul de mentenanță — n-au sortare de
 * ales și n-ar trebui să scrie `sort: null` doar ca să treacă de verificarea de
 * tipuri.
 */
export type FiltreEchipamenteCitire = Omit<FiltreEchipamente, "sort"> & {
  readonly sort?: string | null;
};

export type FiltreInterventiiCitire = Omit<FiltreInterventii, "sort"> & {
  readonly sort?: string | null;
};

export type FiltreSesizariCitire = Omit<FiltreSesizari, "sort"> & {
  readonly sort?: string | null;
};

const COLOANE_ECHIPAMENT_LISTA =
  "id, cod, denumire, serie, producator, model, an_fabricatie, locatie, department_id, " +
  "responsabil_employee_id, status, este_iscir, tip_autorizare_necesara, data_punerii_in_functiune, " +
  "categorie, punct_lucru_id, garantie_expira, parent_equipment_id, casat_la, folosit_in_afara_sediului";

const COLOANE_INTERVENTIE =
  "id, plan_id, equipment_id, tip, data, ora_start, durata_ore, executant_employee_id, " +
  "executant_extern, descriere, piese, cost_piese, cost_manopera, cost_total, rezultat, " +
  "oprire_minute, citire_contor, observatii";

const COLOANE_SESIZARE =
  "id, numar, equipment_id, raportat_de_employee_id, raportat_de_user_id, descriere, urgenta, " +
  "status, raportat_la, opreste_functionarea, intervention_id, rezolvat_la, inchis_la, " +
  "motiv_respingere, motiv_respingere_tip, atribuit_employee_id, atribuit_la, redeschisa_de_ori, " +
  "motiv_redeschidere, duplicat_al_id, nota_rezolvare";

// ── Echipamente ──────────────────────────────────────────────────────────

export async function listeazaEchipamente(
  organizationId: string,
  filtre: FiltreEchipamenteCitire,
): Promise<RezultatEchipamente> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(
    filtre.sort ?? null,
    SORTARI_ECHIPAMENTE,
    SORTARE_IMPLICITA_ECHIPAMENTE,
  );
  const coloana = COLOANA_SORTARE_ECHIPAMENT[sortare.cheie];
  const crescator = sortare.directie === "asc";

  /*
   * ── DE CE NUMĂRĂTOAREA E O A DOUA INTEROGARE ──────────────────────────
   * Aici stătea `count: "exact"` pe ACEEAȘI interogare, cu argumentul — corect
   * în sine — că așa numărătoarea respectă filtrele ȘI politicile RLS
   * din `app.ssm_acces`, 0011_ssm.sql, fără un al doilea drum la bază.
   * Argumentul rata un lucru: predicatul KEYSET e și el un filtru, iar
   * PostgREST n-are de unde ști că e „paginare”. Pus pe aceeași interogare,
   * `count` numără doar ce a rămas DUPĂ cursor.
   *
   * Consecința se vedea de la pagina a doua: `<Paginare>` scria „25 din 30 de
   * rânduri” acolo unde erau 55, iar totalul scădea cu fiecare „mai departe”.
   * O cifră greșită fără nicio eroare — lista rămânea corectă.
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
      or: (f: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.status !== null) cu = cu.eq("status", filtre.status);
    if (filtre.categorie !== null) cu = cu.eq("categorie", filtre.categorie);
    if (filtre.punct_lucru !== null) cu = cu.eq("punct_lucru_id", filtre.punct_lucru);
    if (filtre.responsabil !== null) cu = cu.eq("responsabil_employee_id", filtre.responsabil);
    // `eq` cu boolean: PostgREST acceptă `este_iscir=eq.true`; `is` ar fi tot
    // corect, dar `eq` ține filtrul în aceeași familie cu restul.
    if (filtre.iscir === "da") cu = cu.eq("este_iscir", "true");
    if (filtre.cauta !== null) {
      const termen = filtre.cauta.replace(/[,()*"]/gu, "");
      cu = cu.or(`cod.ilike.${tiparContine(termen)},denumire.ilike.${tiparContine(termen)}`);
    }
    return cu;
  };

  let interogare = filtreaza(db.from("equipment").select(COLOANE_ECHIPAMENT_LISTA))
    // Identificatorul e MEREU al doilea criteriu: coloana de sortare nu e unică
    // (două echipamente pot avea aceeași stare), iar fără el ordinea dintre ele
    // e nedefinită, deci paginarea poate sări sau repeta exact acolo.
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    // Un cursor stricat înseamnă prima pagină, nu o eroare.
    if (c !== null) interogare = interogare.or(predicatKeyset(coloana, c, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandEchipament[]>(),
    filtreaza(db.from("equipment").select("id", { count: "exact", head: true })),
  ]);
  const { data, error } = rezultat;
  if (error !== null) throw error;
  if (numarare.error !== null) throw numarare.error;
  const count = numarare.count;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: VALOARE_CURSOR_ECHIPAMENT[sortare.cheie](ultim), id: ultim.id })
        : null,
    total: count ?? randuri.length,
    sortare,
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
        "derogare_acordata_la, service_garantie, motiv_casare, observatii, marcaj_ce, " +
        "risc_specific, created_at, updated_at",
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

// ── Echipamente: ciclul de viață (0182) ──────────────────────────────────────

/**
 * Categoriile folosite deja în organizație — pentru `<datalist>`-ul câmpului
 * și pentru filtrul listei. PostgREST n-are DISTINCT, deci se citesc valorile și
 * se deduplică aici; plafonul e cel al parcului (sub 1000 pe orice firmă reală).
 */
export async function categoriiEchipamente(organizationId: string): Promise<readonly string[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment")
    .select("categorie")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("categorie", "is", null)
    .order("categorie", { ascending: true })
    .limit(1000)
    .returns<{ readonly categorie: string | null }[]>();
  if (error !== null) throw error;
  return [...new Set((data ?? []).map((r) => r.categorie).filter((c): c is string => c !== null))];
}

/** Componentele unui echipament (copiii direcți), pentru secțiunea de pe fișă. */
export async function copiiEchipament(
  organizationId: string,
  parentId: string,
): Promise<readonly RandEchipament[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment")
    .select(COLOANE_ECHIPAMENT_LISTA)
    .eq("organization_id", organizationId)
    .eq("parent_equipment_id", parentId)
    .is("deleted_at", null)
    .order("cod", { ascending: true })
    .limit(200)
    .returns<RandEchipament[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/** Echipamentele ca opțiuni de selector (părinte, filtre), fără cel exclus. */
export async function optiuniEchipamente(
  organizationId: string,
  faraId: string | null = null,
): Promise<readonly OptiuneSelect[]> {
  const db = await createServerSupabase();
  let interogare = db
    .from("equipment")
    .select("id, cod, denumire")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("status", "casat")
    .order("cod", { ascending: true })
    .limit(LIMITA_OPTIUNI);
  if (faraId !== null) interogare = interogare.neq("id", faraId);
  const { data, error } =
    await interogare.returns<
      { readonly id: string; readonly cod: string; readonly denumire: string }[]
    >();
  if (error !== null) throw error;
  return (data ?? []).map((e) => ({ id: e.id, nume: `${e.cod} — ${e.denumire}` }));
}

/**
 * Echipamentele în grija unei fișe (responsabilul), pentru portal. Sub RLS,
 * responsabilul-angajat vede exact rândurile astea (0182), deci citirea merge
 * pe clientul utilizatorului.
 */
export async function echipamenteleMele(
  organizationId: string,
  fisaId: string,
): Promise<readonly RandEchipament[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment")
    .select(COLOANE_ECHIPAMENT_LISTA)
    .eq("organization_id", organizationId)
    .eq("responsabil_employee_id", fisaId)
    .is("deleted_at", null)
    .neq("status", "casat")
    .order("cod", { ascending: true })
    .limit(200)
    .returns<RandEchipament[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface UltimaCitire {
  readonly citire: number;
  readonly data_citirii: string;
}

/**
 * Ultima citire CU DATA ei, per (echipament, tip) — pentru pagina „Contoare”,
 * unde contează și de când nu s-a mai citit. Aceeași paginare pe `equipment_id`
 * ca `ultimeleCitiriContor`; cheia hărții e `cheieContor`.
 */
export async function ultimeleCitiriCuData(
  organizationId: string,
  equipmentIds: readonly string[],
): Promise<ReadonlyMap<string, UltimaCitire>> {
  const idUnice = [...new Set(equipmentIds)];
  if (idUnice.length === 0) return new Map();
  const db = await createServerSupabase();
  const ultima = new Map<string, UltimaCitire>();

  await Promise.all(
    TIPURI_CONTOR.map(async (tip) => {
      let dupaId: string | null = null;
      for (let pagina = 0; pagina < MAXIM_PAGINI_CONTOARE; pagina += 1) {
        let interogare = db
          .from("equipment_meters")
          .select("equipment_id, tip, citire, data_citirii")
          .eq("organization_id", organizationId)
          .eq("tip", tip)
          .in("equipment_id", idUnice)
          .is("deleted_at", null)
          .order("equipment_id", { ascending: true })
          .order("data_citirii", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(LIMITA_PAGINA_CONTOARE);
        if (dupaId !== null) interogare = interogare.gt("equipment_id", dupaId);
        const { data, error } =
          await interogare.returns<(RandUltimaCitire & { readonly data_citirii: string })[]>();
        if (error !== null) throw error;
        const randuri = data ?? [];
        for (const rand of randuri) {
          const cheie = cheieContor(rand.equipment_id, rand.tip);
          if (!ultima.has(cheie)) {
            ultima.set(cheie, { citire: rand.citire, data_citirii: rand.data_citirii });
          }
        }
        if (randuri.length < LIMITA_PAGINA_CONTOARE) break;
        const ultimulRand = randuri.at(-1);
        if (ultimulRand === undefined) break;
        dupaId = ultimulRand.equipment_id;
      }
    }),
  );
  return ultima;
}

export interface EchipamentProblema {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly status: "in_reparatie" | "in_conservare" | "casat";
}

export interface RezultatEchipamenteProblema {
  readonly randuri: readonly EchipamentProblema[];
  /** Câte echipamente nu sunt „în funcțiune”, după politici — nu câte s-au citit. */
  readonly total: number;
}

/**
 * Echipamentele care NU sunt „în funcțiune”, pentru panoul de organizație.
 *
 * `count: "exact"` pe ACEEAȘI interogare: numărul din antetul panoului trebuie
 * să respecte aceleași politici RLS ca rândurile de sub el. Trăia inline în
 * `mentenanta/page.tsx`; stă aici ca `coloane.test.ts` să-i vadă coloanele și
 * ca panoul și rapoartele să numere la fel.
 */
export async function echipamenteCuProbleme(
  organizationId: string,
  limita: number,
): Promise<RezultatEchipamenteProblema> {
  const db = await createServerSupabase();
  const { data, error, count } = await db
    .from("equipment")
    .select("id, cod, denumire, status", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("status", "in_functiune")
    .order("cod", { ascending: true })
    .limit(limita)
    .returns<EchipamentProblema[]>();
  if (error !== null) throw error;
  const randuri = data ?? [];
  return { randuri, total: count ?? randuri.length };
}

// ── Selectoare ──────────────────────────────────────────────────────────────

export interface OptiuneSelect {
  readonly id: string;
  readonly nume: string;
}

/** Sub `max_rows = 1000`; cea mai mare firmă reală are opt angajați. */
const LIMITA_OPTIUNI = 500;

/**
 * Angajații organizației pentru selectoarele „Responsabil”, „Citit de”,
 * „Executant” — id și nume, sortați, cu limită explicită.
 *
 * Trăia ca interogare inline, fără limită, în două pagini. O limită ratată nu
 * dă eroare: PostgREST taie la 1000 și selectorul arată o listă subtil
 * incompletă. Aici limita e scrisă și sortarea e stabilă.
 */
export async function optiuniAngajati(organizationId: string): Promise<readonly OptiuneSelect[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .limit(LIMITA_OPTIUNI)
    .returns<AngajatRezumat[]>();
  if (error !== null) throw error;
  return (data ?? []).map((a) => ({ id: a.id, nume: a.full_name ?? "—" }));
}

export async function optiuniDepartamente(
  organizationId: string,
): Promise<readonly OptiuneSelect[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("departments")
    .select("id, denumire")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("denumire", { ascending: true })
    .limit(LIMITA_OPTIUNI)
    .returns<Array<{ id: string; denumire: string }>>();
  if (error !== null) throw error;
  return (data ?? []).map((d) => ({ id: d.id, nume: d.denumire }));
}

// ── Contoare ────────────────────────────────────────────────────────────

export async function contoareEchipament(
  organizationId: string,
  equipmentId: string,
): Promise<readonly CitireContor[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment_meters")
    .select(
      "id, tip, citire, data_citirii, resetare_contor, sursa, citit_de_employee_id, observatii",
    )
    .eq("organization_id", organizationId)
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

export async function planuriEchipament(
  organizationId: string,
  equipmentId: string,
): Promise<readonly PlanMentenanta[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("maintenance_plans")
    .select(COLOANE_PLAN)
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .is("deleted_at", null)
    .order("denumire", { ascending: true })
    .returns<PlanMentenanta[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/** Câte planuri active se citesc dintr-o dată. Sub `max_rows = 1000` al PostgREST. */
const LIMITA_PLANURI_SCADENTE = 500;

export interface RezultatPlanuriScadente {
  readonly randuri: readonly PlanMentenanta[];
  /** Câte planuri active are organizația DUPĂ politici — nu câte s-au citit. */
  readonly total: number;
  /** `true` când limita a tăiat lista; ecranul trebuie s-o spună. */
  readonly trunchiat: boolean;
}

/**
 * Planurile ACTIVE ale organizației, sortate cu cea mai apropiată scadență prima.
 *
 * Întoarce și `total`, nu doar rândurile: limita era fixată la 500 și nimic nu
 * spunea când a tăiat. Panoul de mentenanță NUMĂRĂ rândurile citite ca să scrie
 * cifra de dimineață, deci o tăiere tăcută nu producea o listă scurtă, ci un
 * indicator mai mic decât realitatea — cea mai proastă formă de defect, fiindcă
 * arată corect.
 */
export async function planuriScadente(organizationId: string): Promise<RezultatPlanuriScadente> {
  const db = await createServerSupabase();
  const { data, error, count } = await db
    .from("maintenance_plans")
    .select(COLOANE_PLAN, { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("activ", true)
    .is("deleted_at", null)
    .order("urmatoarea_scadenta", { ascending: true, nullsFirst: false })
    .limit(LIMITA_PLANURI_SCADENTE)
    .returns<PlanMentenanta[]>();

  if (error !== null) throw error;
  const randuri = data ?? [];
  return {
    randuri,
    total: count ?? randuri.length,
    trunchiat: count !== null && count > randuri.length,
  };
}

// ── Ultima citire de contor, pe (echipament, tip) ──────────────────────────

/** Cheia hărții întoarse de `ultimeleCitiriContor`. */
export function cheieContor(equipmentId: string, tip: TipContor): string {
  return `${equipmentId}:${tip}`;
}

interface RandUltimaCitire {
  readonly equipment_id: string;
  readonly tip: TipContor;
  readonly citire: number;
}

/** Cât se citește pe pagină. Sub `max_rows = 1000`, altfel PostgREST taie el, tăcut. */
const LIMITA_PAGINA_CONTOARE = 1000;

/** Plasă de siguranță: o buclă de citire nu are voie să fie nemărginită. */
const MAXIM_PAGINI_CONTOARE = 50;

/**
 * Ultima citire cunoscută a fiecărui contor, pentru un set de echipamente.
 *
 * Fără ea, `stareScadentaPlan()` nu se poate chema în afara fișei unui singur
 * echipament: scadența pe contor se compară cu o citire, iar citirea stă în
 * altă tabelă. De asta panoul și lista de planuri foloseau `stareScadentaData()`
 * — și afișau „În regulă” pentru un plan depășit cu 200 de ore.
 *
 * ── DE CE O INTEROGARE PE FIECARE TIP DE CONTOR, ȘI NU UNA SINGURĂ ────────
 * PostgREST nu are `distinct on`, deci ultima citire se alege în JavaScript din
 * rândurile ordonate. Ordonarea `equipment_id` crescător + `data_citirii`
 * descrescător grupează rândurile unui echipament la un loc ȘI îi pune primul
 * rândul cel mai nou — dar numai cu `tip` FIXAT prin `.eq()`. Cu trei tipuri
 * amestecate, primul rând al unui echipament ar fi cel mai nou al primului tip,
 * iar celelalte două tipuri ar putea cădea dincolo de tăietură.
 *
 * Cu `tip` fixat, orice pagină, chiar tăiată, e CORECTĂ pentru fiecare
 * `equipment_id` care apare în ea: prima lui apariție e citirea lui cea mai
 * nouă. Lipsesc doar echipamentele de după tăietură, iar acelea se reiau cu
 * `.gt("equipment_id", ultimul)`. De aceea bucla de mai jos n-are nevoie de
 * niciun marcaj de trunchiere: nu poate întoarce o valoare greșită, doar una
 * lipsă — iar `stareScadentaContor()` tratează lipsa ca „fara_scadenta”.
 */
export async function ultimeleCitiriContor(
  organizationId: string,
  equipmentIds: readonly string[],
  tipuri: readonly TipContor[],
): Promise<ReadonlyMap<string, number>> {
  const idUnice = [...new Set(equipmentIds)];
  const tipUnice = [...new Set(tipuri)];
  if (idUnice.length === 0 || tipUnice.length === 0) return new Map();

  const db = await createServerSupabase();

  /*
   * Tipurile de contor merg în PARALEL, nu unul după altul.
   *
   * Bucla era `for (const tip of tipUnice)` cu paginare secvențială înăuntru —
   * deci, pentru două tipuri de contor, două lanțuri de dus-întors puse cap la
   * cap. Nu era o alegere: tipurile nu depind unul de altul, iar cheile pe care
   * le scriu sunt disjuncte prin construcție (`cheieContor(equipment_id, tip)`).
   *
   * Contează mai mult decât pare: funcția e chemată de `numarScadenteMentenanta`,
   * care intră în `contoarePanouPentru`, care alimentează insignele din meniu —
   * adică se plătea la fiecare randare de înveliș, pe orice pagină a aplicației.
   *
   * Paginarea în interiorul unui tip RĂMÂNE secvențială, și trebuie: `dupaId`
   * al paginii următoare vine din ultimul rând al celei curente.
   */
  const perTip = await Promise.all(
    tipUnice.map(async (tip) => {
      const aleTipului = new Map<string, number>();
      let dupaId: string | null = null;

      for (let pagina = 0; pagina < MAXIM_PAGINI_CONTOARE; pagina += 1) {
        let interogare = db
          .from("equipment_meters")
          .select("equipment_id, tip, citire")
          .eq("organization_id", organizationId)
          .eq("tip", tip)
          .in("equipment_id", idUnice)
          .is("deleted_at", null)
          .order("equipment_id", { ascending: true })
          .order("data_citirii", { ascending: false })
          // Două citiri în aceeași zi: cea introdusă ultima e cea bună.
          .order("created_at", { ascending: false })
          .limit(LIMITA_PAGINA_CONTOARE);
        if (dupaId !== null) interogare = interogare.gt("equipment_id", dupaId);

        const { data, error } = await interogare.returns<RandUltimaCitire[]>();
        if (error !== null) throw error;

        const randuri = data ?? [];
        for (const rand of randuri) {
          const cheie = cheieContor(rand.equipment_id, rand.tip);
          // Prima citire întâlnită per echipament e cea mai recentă: sortarea de
          // mai sus o garantează. `has` păstrează exact semantica de dinainte.
          if (!aleTipului.has(cheie)) aleTipului.set(cheie, rand.citire);
        }

        if (randuri.length < LIMITA_PAGINA_CONTOARE) break;
        const ultimulRand = randuri.at(-1);
        if (ultimulRand === undefined) break;
        dupaId = ultimulRand.equipment_id;
      }

      return aleTipului;
    }),
  );

  const ultima = new Map<string, number>();
  for (const alTipului of perTip) {
    for (const [cheie, citire] of alTipului) ultima.set(cheie, citire);
  }

  return ultima;
}

// ── Intervenții ──────────────────────────────────────────────────────────

export async function interventii(
  organizationId: string,
  filtre: FiltreInterventiiCitire,
): Promise<RezultatInterventii> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(
    filtre.sort ?? null,
    SORTARI_INTERVENTII,
    SORTARE_IMPLICITA_INTERVENTII,
  );
  const coloana = COLOANA_SORTARE_INTERVENTIE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  /**
   * Filtrele mulțimii, aplicate identic pe interogarea de date și pe cea de
   * numărare — despărțirea și motivul ei sunt explicate la
   * `listeazaEchipamente`: pe o singură interogare, `count` numără doar
   * rândurile de DUPĂ cursor, deci totalul scade cu fiecare pagină.
   */
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.tip !== null) cu = cu.eq("tip", filtre.tip);
    if (filtre.rezultat !== null) cu = cu.eq("rezultat", filtre.rezultat);
    if (filtre.echipament !== null) cu = cu.eq("equipment_id", filtre.echipament);
    return cu;
  };

  let interogare = filtreaza(db.from("maintenance_interventions").select(COLOANE_INTERVENTIE))
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset(coloana, c, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandInterventie[]>(),
    filtreaza(db.from("maintenance_interventions").select("id", { count: "exact", head: true })),
  ]);
  const { data, error } = rezultat;
  if (error !== null) throw error;
  if (numarare.error !== null) throw numarare.error;
  const count = numarare.count;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({
            valoare: VALOARE_CURSOR_INTERVENTIE[sortare.cheie](ultim),
            id: ultim.id,
          })
        : null,
    total: count ?? randuri.length,
    sortare,
  };
}

/**
 * O singură intervenție, după id.
 *
 * `fault_reports.intervention_id` era scris de `rezolvaSesizare` și citit de
 * `citesteSesizare`, dar nu exista nicio funcție care să aducă intervenția
 * indicată — deci legătura scrisă în bază nu se putea afișa nicăieri.
 */
export async function citesteInterventie(
  organizationId: string,
  id: string,
): Promise<RandInterventie | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("maintenance_interventions")
    .select(COLOANE_INTERVENTIE)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<RandInterventie>();

  if (error !== null) throw error;
  return data;
}

// ── Sesizări ────────────────────────────────────────────────────────────

/** Un uuid care nu există: pentru „sesizările mele” când apelantul n-are fișă, lista e goală, nu întreagă. */
const NICIO_FISA = "00000000-0000-4000-8000-000000000000";

/**
 * Lista de sesizări. `fisaMea` e fișa apelantului, pentru filtrul `atribuit=mie`:
 * citirea nu poate ști singură cine întreabă, iar un `mie` fără fișă trebuie să
 * dea zero rânduri, nu toate rândurile — de aici și `NICIO_FISA`.
 */
export async function sesizari(
  organizationId: string,
  filtre: FiltreSesizariCitire,
  fisaMea: string | null = null,
): Promise<RezultatSesizari> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort ?? null, SORTARI_SESIZARI, SORTARE_IMPLICITA_SESIZARI);
  const coloana = COLOANA_SORTARE_SESIZARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  /**
   * Filtrele mulțimii, aplicate identic pe amândouă interogările — vezi
   * `listeazaEchipamente` pentru motivul despărțirii. Pe o singură interogare,
   * predicatul keyset intra în aceleași filtre ca `count`, iar coada de
   * sesizări își anunța totalul din ce în ce mai mic pe măsură ce paginai.
   */
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      in: (c: string, v: readonly string[]) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.status !== null) cu = cu.eq("status", filtre.status);
    else if (filtre.deschise === "da") cu = cu.in("status", STARI_DESCHISE_SESIZARE);
    if (filtre.urgenta !== null) cu = cu.eq("urgenta", filtre.urgenta);
    if (filtre.echipament !== null) cu = cu.eq("equipment_id", filtre.echipament);
    if (filtre.atribuit === "nimeni") cu = cu.is("atribuit_employee_id", null);
    else if (filtre.atribuit === "mie") cu = cu.eq("atribuit_employee_id", fisaMea ?? NICIO_FISA);
    else if (filtre.atribuit !== null) cu = cu.eq("atribuit_employee_id", filtre.atribuit);
    return cu;
  };

  let interogare = filtreaza(db.from("fault_reports").select(COLOANE_SESIZARE))
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset(coloana, c, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandSesizare[]>(),
    filtreaza(db.from("fault_reports").select("id", { count: "exact", head: true })),
  ]);
  const { data, error } = rezultat;
  if (error !== null) throw error;
  if (numarare.error !== null) throw numarare.error;
  const count = numarare.count;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: VALOARE_CURSOR_SESIZARE[sortare.cheie](ultim), id: ultim.id })
        : null,
    total: count ?? randuri.length,
    sortare,
  };
}

/**
 * Statusurile care ÎNCĂ cer o acțiune — lista explicită din domeniu
 * (`STARI_DESCHISE_SESIZARE`), nu o negație: un status nou adăugat în
 * `fault_status` n-ar trebui să intre tăcut în coada de dimineață.
 */
const STATUSURI_DESCHISE: readonly StatusSesizare[] = STARI_DESCHISE_SESIZARE;

export interface RezultatSesizariDeschise {
  readonly randuri: readonly RandSesizare[];
  /** Câte sesizări deschise are organizația — nu câte încap în panou. */
  readonly total: number;
}

/**
 * Coada de dimineață: sesizările NEÎNCHISE, în ordinea în care trebuie luate.
 *
 * Panoul de mentenanță citea cele mai recente 50 de sesizări și abia apoi le
 * filtra în JavaScript. Ordinea de citire fiind `raportat_la` descrescător, o
 * organizație care închide 50 de sesizări într-o săptămână scotea din pagină
 * exact sesizarea critică de acum o lună, iar panoul anunța senin „Nicio
 * sesizare deschisă”. Filtrul intră în interogare, deci nu mai există fereastră
 * din care ceva să cadă.
 *
 * Ordinea: utilaj oprit întâi, apoi urgența, apoi vechimea CRESCĂTOARE — o
 * coadă se golește de la capătul vechi. `fault_urgency` e declarat crescător ca
 * gravitate în `0011_ssm.sql:17` (`scazuta` → `critica`), deci `ascending:
 * false` pe el înseamnă „critica prima”; enumul, nu un `case` scris de mână.
 */
export async function sesizariDeschise(
  organizationId: string,
  limita: number,
): Promise<RezultatSesizariDeschise> {
  const db = await createServerSupabase();
  const { data, error, count } = await db
    .from("fault_reports")
    .select(COLOANE_SESIZARE, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", STATUSURI_DESCHISE)
    .order("opreste_functionarea", { ascending: false })
    .order("urgenta", { ascending: false })
    .order("raportat_la", { ascending: true })
    .limit(limita)
    .returns<RandSesizare[]>();

  if (error !== null) throw error;
  const randuri = data ?? [];
  return { randuri, total: count ?? randuri.length };
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
  // Ziua României, nu cea UTC: între 00:00 și 03:00 ora României, ziua UTC e
  // încă ieri, iar o autorizație expirată ieri apărea valabilă.
  const azi = todayInBucharest();
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

/**
 * Fișele după CONTUL de utilizator — pentru istoricul și comentariile sesizării,
 * care rețin `actor_user_id`/`autor_user_id` (un administrator fără fișă are
 * doar cont). Cheia hărții e `user_id`. Sub RLS, un `employee` vede doar fișa
 * lui: numele lipsă se afișează ca „Echipa de mentenanță", nu ca eroare.
 */
export async function angajatiDupaUserId(
  organizationId: string,
  userIds: readonly string[],
): Promise<ReadonlyMap<string, AngajatRezumat>> {
  const unice = [...new Set(userIds)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, user_id")
    .eq("organization_id", organizationId)
    .in("user_id", unice)
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .returns<(AngajatRezumat & { readonly user_id: string | null })[]>();

  if (error !== null) throw error;
  const harta = new Map<string, AngajatRezumat>();
  for (const a of data ?? []) {
    // Prima fișă (cea principală, sortată în față) câștigă.
    if (a.user_id !== null && !harta.has(a.user_id)) {
      harta.set(a.user_id, { id: a.id, full_name: a.full_name });
    }
  }
  return harta;
}

// ── Sesizări: cronologie, comentarii, atașamente, opriri (0181) ─────────────

export async function comentariiSesizare(
  organizationId: string,
  faultReportId: string,
): Promise<readonly ComentariuSesizare[]> {
  const db = await createServerSupabase();
  // Notele interne le filtrează RLS, nu noi: `fault_report_comments_select` le
  // ascunde raportorului. Aici se citește tot ce lasă politica.
  const { data, error } = await db
    .from("fault_report_comments")
    .select("id, autor_employee_id, autor_user_id, continut, intern, created_at")
    .eq("organization_id", organizationId)
    .eq("fault_report_id", faultReportId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<ComentariuSesizare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export async function istoricSesizare(
  organizationId: string,
  faultReportId: string,
): Promise<readonly IstoricSesizare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fault_report_history")
    .select("id, actor_user_id, camp, valoare_veche, valoare_noua, motiv, created_at")
    .eq("organization_id", organizationId)
    .eq("fault_report_id", faultReportId)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<IstoricSesizare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/** Bucketul privat al modulului (0181). Politicile lui proprii decid cine citește ce. */
export const BUCKET_MENTENANTA = "org-mentenanta";

export async function atasamente(
  organizationId: string,
  entityType: EntitateAtasament,
  entityId: string,
): Promise<readonly Atasament[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("maintenance_attachments")
    .select(
      "id, entity_type, entity_id, storage_path, denumire, tip, mime, marime_bytes, created_by, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(100)
    .returns<Atasament[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * URL-uri semnate de descărcare pentru o listă de atașamente — pe clientul
 * utilizatorului, deci sub politicile bucketului: cine n-are voie primește
 * `null`, nu un link. Zece minute, cât ține o pagină deschisă.
 */
export async function urlSemnate(
  randuri: readonly Atasament[],
): Promise<ReadonlyMap<string, string>> {
  if (randuri.length === 0) return new Map();
  const db = await createServerSupabase();
  const { data, error } = await db.storage.from(BUCKET_MENTENANTA).createSignedUrls(
    randuri.map((a) => a.storage_path),
    600,
  );
  if (error !== null || data === null) return new Map();
  const harta = new Map<string, string>();
  for (const semnat of data) {
    const cale: string | null = semnat.path;
    const url: string | null = semnat.signedUrl;
    if (cale !== null && url !== null && url.length > 0 && semnat.error === null) {
      harta.set(cale, url);
    }
  }
  return harta;
}

export async function opririSesizare(
  organizationId: string,
  faultReportId: string,
): Promise<readonly Oprire[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment_opriri")
    .select("id, equipment_id, inceput, sfarsit, tip, motiv, fault_report_id, intervention_id")
    .eq("organization_id", organizationId)
    .eq("fault_report_id", faultReportId)
    .is("deleted_at", null)
    .order("inceput", { ascending: false })
    .limit(20)
    .returns<Oprire[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export async function opririEchipament(
  organizationId: string,
  equipmentId: string,
  limita: number,
): Promise<readonly Oprire[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment_opriri")
    .select("id, equipment_id, inceput, sfarsit, tip, motiv, fault_report_id, intervention_id")
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .is("deleted_at", null)
    .order("inceput", { ascending: false })
    .limit(limita)
    .returns<Oprire[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Opririle încă deschise ale organizației, pe echipament — de aici se derivă
 * „Oprit” pe listă și pe panou. `equipment.status` NU se schimbă automat (vezi
 * 0181, §5): jurnalul e singura sursă.
 */
export async function opririDeschise(organizationId: string): Promise<ReadonlyMap<string, Oprire>> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("equipment_opriri")
    .select("id, equipment_id, inceput, sfarsit, tip, motiv, fault_report_id, intervention_id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("sfarsit", null)
    .order("inceput", { ascending: true })
    .limit(500)
    .returns<Oprire[]>();
  if (error !== null) throw error;
  // Prima oprire deschisă câștigă: e cea mai veche, deci cea care spune de când stă utilajul.
  const harta = new Map<string, Oprire>();
  for (const o of data ?? []) if (!harta.has(o.equipment_id)) harta.set(o.equipment_id, o);
  return harta;
}

/** Sesizarea deschisă cea mai veche pe un echipament — avertismentul de duplicat la raportare. */
export async function sesizareDeschisaPeEchipament(
  organizationId: string,
  equipmentId: string,
): Promise<RandSesizare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fault_reports")
    .select(COLOANE_SESIZARE)
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .is("deleted_at", null)
    .in("status", STARI_DESCHISE_SESIZARE)
    .order("raportat_la", { ascending: true })
    .limit(1)
    .maybeSingle<RandSesizare>();
  if (error !== null) throw error;
  return data;
}

/** Sesizările atribuite fișei date, încă deschise — „de lucrat” pentru tehnician. */
export async function sesizariAtribuite(
  organizationId: string,
  fisaId: string,
  limita: number,
): Promise<readonly RandSesizare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fault_reports")
    .select(COLOANE_SESIZARE)
    .eq("organization_id", organizationId)
    .eq("atribuit_employee_id", fisaId)
    .is("deleted_at", null)
    .in("status", STARI_DESCHISE_SESIZARE)
    .order("opreste_functionarea", { ascending: false })
    .order("urgenta", { ascending: false })
    .order("raportat_la", { ascending: true })
    .limit(limita)
    .returns<RandSesizare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Setări (0181) ───────────────────────────────────────────────────────────

/**
 * Setările modulului, cu implicitele completate. Lipsa rândului nu e o eroare:
 * o firmă care n-a deschis niciodată pagina de setări are exact valorile din
 * `default`-urile tabelei.
 */
export async function setariMentenanta(organizationId: string): Promise<SetariMentenanta> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("maintenance_settings")
    .select(
      "id, responsabili, rsvti_employee_id, inchidere_automata_zile, prag_avertizare_zile, " +
        "prag_contor_necitit_zile, ore_functionare_pe_zi, zile_pe_saptamana, cost_ora_oprire",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle<SetariMentenanta>();
  if (error !== null) throw error;
  return data ?? SETARI_MENTENANTA_IMPLICITE;
}

// ── Badge de navigare ────────────────────────────────────────────────────

/**
 * Numărul de scadențe de mentenanță pentru badge-ul „maintenance_due” din meniu
 * (`config/navigation.ts`).
 *
 * Numărătoarea trece prin `stareScadentaPlan` și `cereActiune`, exact regulile
 * după care ecranul `/mentenanta` își construiește coada. Varianta veche era o
 * pereche de `count(head)` în bază și, tocmai de asta, nu putea vedea decât
 * `urmatoarea_scadenta`: scadența pe CONTOR cere, per plan, ultima citire a
 * contorului, adică un calcul pe rând, nu un `count`. Rezultatul era o cifră
 * mai mică decât adevărul, fără nicio eroare — un plan depășit cu 200 de ore nu
 * intra în ea. Odată ce ecranele au trecut pe starea combinată, un `count` pe
 * zile ar fi rămas ca a doua sursă, care contrazice prima.
 *
 * Costul: se citesc rândurile, nu doar numărul lor. La volumele reale ale
 * produsului (zeci de echipamente pe organizație) e sub o interogare de listă;
 * dacă vreodată nu mai e, locul reparației e o vedere materializată în bază, nu
 * întoarcerea la o cifră greșită.
 *
 * Limita rămasă, asumată: dacă `planuriScadente` taie la 500, badge-ul e un
 * MINIM. Semnătura întoarce un `number` pentru `lib/queries/panou.ts`, deci n-are
 * unde purta marcajul; ecranul `/mentenanta`, care poate, îl arată.
 */
/**
 * Câte autorizații ISCIR cer acțiune — NUMĂRATE în bază, nu citite și filtrate.
 *
 * ── DE CE NU SE REFOLOSEȘTE `autorizatiiIscir()` ──────────────────────────
 * Fiindcă ea n-are `.limit()`: se sprijină pe `max_rows = 1000` din PostgREST,
 * care TAIE TĂCUT. Pentru o listă afișată, tăierea se vede (utilizatorul dă mai
 * departe); pentru un CONTOR, ea produce pur și simplu un număr mai mic, fără
 * nimic care s-o semnaleze — exact clasa de defect pe care restul modulului o
 * repară.
 *
 * Contează dublu aici: contorul alimentează insigna din meniul lateral, prin
 * `contoarePanou`, iar aceea se calculează în `(app)/layout.tsx`, adică la
 * FIECARE navigare din aplicație. O citire de listă neplafonată pe calea aia e
 * și greșită, și scumpă.
 *
 * ── DE CE PREDICATUL E ECHIVALENT ─────────────────────────────────────────
 * `cereActiune(stareScadentaData(d, azi, prag))` e adevărat exact când
 * `d < azi` (în întârziere) sau `d <= azi + prag` (scadență apropiată) —
 * adică, împreună, `d <= azi + prag`. Cazul `d === null` dă `fara_scadenta`,
 * pe care `cereActiune` îl respinge, iar `.lte()` îl exclude oricum: în SQL,
 * `null <= orice` nu e adevărat. Deci o singură comparație acoperă tot.
 */
async function numarAutorizatiiIscirScadente(
  organizationId: string,
  azi: string,
  pragZile: number,
): Promise<number> {
  const limita = new Date(`${azi}T00:00:00Z`);
  limita.setUTCDate(limita.getUTCDate() + pragZile);

  const db = await createServerSupabase();
  const { count, error } = await db
    .from("iscir_authorizations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("suspendata_la", null)
    .lte("valabil_pana", limita.toISOString().slice(0, 10));
  if (error !== null) throw error;
  return count ?? 0;
}

export async function numarScadenteMentenanta(
  organizationId: string,
  pragZile: number,
): Promise<number> {
  const azi = todayInBucharest();
  const [rezultatPlanuri, iscir] = await Promise.all([
    planuriScadente(organizationId),
    numarAutorizatiiIscirScadente(organizationId, azi, pragZile),
  ]);

  const planuriCuContor = rezultatPlanuri.randuri.filter(
    (p) => p.tip_contor !== null && p.urmatoarea_scadenta_contor !== null,
  );
  const citiri = await ultimeleCitiriContor(
    organizationId,
    planuriCuContor.map((p) => p.equipment_id),
    planuriCuContor.map((p) => p.tip_contor).filter((tip): tip is TipContor => tip !== null),
  );

  const planuri = rezultatPlanuri.randuri.filter((plan) =>
    cereActiune(
      stareScadentaPlan(
        {
          urmatoareaScadenta: plan.urmatoarea_scadenta,
          urmatoareaScadentaContor: plan.urmatoarea_scadenta_contor,
          periodicitateContor: plan.periodicitate_contor,
          ultimaCitireContor:
            plan.tip_contor === null
              ? null
              : (citiri.get(cheieContor(plan.equipment_id, plan.tip_contor)) ?? null),
        },
        azi,
        pragZile,
      ),
    ),
  ).length;

  return planuri + iscir;
}
