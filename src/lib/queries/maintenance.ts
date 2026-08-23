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
import type {
  FiltreEchipamente,
  FiltreInterventii,
  FiltreSesizari,
  RezultatInterventie,
  SortareEchipamente,
  SortareInterventii,
  SortareSesizari,
  StatusEchipament,
  StatusSesizare,
  TipContor,
  TipMentenanta,
  UrgentaSesizare,
} from "@/schemas/maintenance";
import { SORTARI_ECHIPAMENTE, SORTARI_INTERVENTII, SORTARI_SESIZARI } from "@/schemas/maintenance";

import {
  codificaCursor,
  decodificaCursor,
  predicatKeyset,
  sortareCeruta,
  type Directie,
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

  let interogare = db
    .from("equipment")
    .select(
      COLOANE_ECHIPAMENT_LISTA,
      // `count: "exact"` pe ACEEAȘI interogare: numărătoarea respectă filtrele
      // ȘI politicile RLS, fără un al doilea drum la bază care le-ar putea
      // aplica altfel.
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    // Identificatorul e MEREU al doilea criteriu: coloana de sortare nu e unică
    // (două echipamente pot avea aceeași stare), iar fără el ordinea dintre ele
    // e nedefinită, deci paginarea poate sări sau repeta exact acolo.
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);
  if (filtre.cauta !== null) {
    const termen = filtre.cauta.replace(/[,()*"]/gu, "");
    interogare = interogare.or(`cod.ilike.%${termen}%,denumire.ilike.%${termen}%`);
  }

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    // Un cursor stricat înseamnă prima pagină, nu o eroare.
    if (c !== null) interogare = interogare.or(predicatKeyset(coloana, c, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandEchipament[]>();
  if (error !== null) throw error;

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
  const ultima = new Map<string, number>();

  for (const tip of tipUnice) {
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
        if (!ultima.has(cheie)) ultima.set(cheie, rand.citire);
      }

      if (randuri.length < LIMITA_PAGINA_CONTOARE) break;
      const ultimulRand = randuri.at(-1);
      if (ultimulRand === undefined) break;
      dupaId = ultimulRand.equipment_id;
    }
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

  let interogare = db
    .from("maintenance_interventions")
    .select(COLOANE_INTERVENTIE, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.tip !== null) interogare = interogare.eq("tip", filtre.tip);
  if (filtre.rezultat !== null) interogare = interogare.eq("rezultat", filtre.rezultat);
  if (filtre.echipament !== null) interogare = interogare.eq("equipment_id", filtre.echipament);

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset(coloana, c, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandInterventie[]>();
  if (error !== null) throw error;

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

export async function sesizari(
  organizationId: string,
  filtre: FiltreSesizariCitire,
): Promise<RezultatSesizari> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort ?? null, SORTARI_SESIZARI, SORTARE_IMPLICITA_SESIZARI);
  const coloana = COLOANA_SORTARE_SESIZARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  let interogare = db
    .from("fault_reports")
    .select(COLOANE_SESIZARE, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);
  if (filtre.urgenta !== null) interogare = interogare.eq("urgenta", filtre.urgenta);
  if (filtre.echipament !== null) interogare = interogare.eq("equipment_id", filtre.echipament);

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset(coloana, c, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandSesizare[]>();
  if (error !== null) throw error;

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
 * Statusurile care ÎNCĂ cer o acțiune — complementul lui `rezolvat`/`respins`.
 * Scris ca listă, nu ca negație, ca să fie o alegere explicită: un status nou
 * adăugat în `fault_status` n-ar trebui să intre tăcut în coada de dimineață.
 */
const STATUSURI_DESCHISE: readonly StatusSesizare[] = ["nou", "in_analiza", "in_lucru"];

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
