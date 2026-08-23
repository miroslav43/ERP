// src/lib/queries/fleet.ts
// Citirile modulului de flotă. Ca la inventar, NU se adaugă niciun filtru de
// scope (own/team/all): politicile din 0012/0016/0018 restrâng rândurile direct
// în Postgres. Un filtru duplicat aici ar fi cod care pare să apere ceva, dar
// care poate diverge tăcut de regula reală.

import type { FiltreFoi, FiltreVehicule, SortareFoi, SortareVehicule } from "@/schemas/fleet";
import type { CategorieVehicul, Combustibil, StatusFoaie, StatusVehicul } from "@/schemas/fleet";
import { SORTARI_FOI, SORTARI_VEHICULE } from "@/schemas/fleet";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  codificaCursor,
  decodificaCursor,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

export interface RandVehicul {
  readonly id: string;
  readonly nr_inmatriculare: string;
  readonly marca: string;
  readonly model: string;
  readonly categorie: CategorieVehicul;
  readonly tip_combustibil: Combustibil;
  readonly an_fabricatie: number | null;
  readonly km_curent: number;
  readonly employee_id: string | null;
  readonly department_id: string | null;
  readonly status: StatusVehicul;
  readonly prag_salt_km: number | null;
  readonly data_iesire: string | null;
  /**
   * Urcat din `Vehicul` în rândul de LISTĂ fiindcă e termenul de comparație al
   * consumului real: coada de aprobare arată „9,4 l/100 km” fără el ca pe o
   * cifră fără verdict. Costă o coloană în plus la fiecare citire de listă și
   * scutește un al doilea drum la bază pe ecranul unde se semnează.
   */
  readonly consum_mediu_declarat: number | null;
}

export interface RezultatVehicule {
  readonly randuri: readonly RandVehicul[];
  readonly urmatorulCursor: string | null;
  /**
   * Câte vehicule sunt în total, după filtre. „Pagina următoare” fără un total
   * e o ușă fără indicație: nu știi dacă mai urmează un ecran sau o sută.
   */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareVehicule; directie: Directie }>;
}

export interface Vehicul extends RandVehicul {
  readonly vin: string | null;
  readonly culoare: string | null;
  readonly capacitate_cilindrica: number | null;
  readonly masa_maxima_kg: number | null;
  readonly numar_locuri: number | null;
  readonly valoare_achizitie: number | null;
  readonly data_achizitie: string | null;
  readonly motiv_iesire: string | null;
  readonly observatii: string | null;
  readonly created_at: string;
}

export interface DocumentVehicul {
  readonly id: string;
  readonly document_type_id: string;
  readonly numar: string | null;
  readonly emitent: string | null;
  readonly valabil_de_la: string | null;
  readonly expira_la: string | null;
  readonly cost: number | null;
  readonly fisier_path: string | null;
  readonly este_curent: boolean;
  readonly observatii: string | null;
}

export interface TipDocument {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly cere_expirare: boolean;
  readonly obligatoriu: boolean;
  readonly ordine: number;
}

/** Scadența cea mai apropiată a unui vehicul, pentru semaforul din listă. */
export interface ScadentaVehicul {
  readonly vehicle_id: string;
  readonly document_type_id: string;
  readonly expira_la: string | null;
  readonly numar: string | null;
}

export interface RandFoaie {
  readonly id: string;
  readonly vehicle_id: string;
  readonly employee_id: string | null;
  readonly numar: string | null;
  readonly plecare_la: string;
  readonly sosire_la: string | null;
  readonly km_plecare: number | null;
  readonly km_sosire: number | null;
  readonly km_parcursi: number | null;
  readonly traseu: string | null;
  readonly scop: string | null;
  readonly status: StatusFoaie;
  readonly trimis_la: string | null;
  readonly aprobat_la: string | null;
}

/**
 * Foaia CITITĂ ÎNTREAGĂ — rândul de listă plus cele două câmpuri lungi.
 *
 * `citesteFoaie` le selecta dintotdeauna, dar întorcea `RandFoaie`, iar pagina
 * de detaliu ajungea la `motiv_respingere` printr-un cast scris de mână
 * (`(foaie as { motiv_respingere?: string | null })`). Un cast e o promisiune
 * neverificată: dacă selectul ar fi pierdut coloana, tipul ar fi tăcut și
 * ecranul ar fi arătat „Nu a fost consemnat niciun motiv.” pentru o respingere
 * motivată. Acum semnătura spune ce citește interogarea.
 */
export interface Foaie extends RandFoaie {
  readonly observatii: string | null;
  readonly motiv_respingere: string | null;
}

export interface RezultatFoi {
  readonly randuri: readonly RandFoaie[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
  readonly sortare: Readonly<{ cheie: SortareFoi; directie: Directie }>;
}

export interface Alimentare {
  readonly id: string;
  readonly litri: number;
  readonly cost: number;
  readonly pret_litru: number | null;
  readonly statie: string | null;
  readonly numar_bon: string | null;
  readonly alimentat_la: string;
  readonly plin: boolean;
  readonly observatii: string | null;
}

export interface Anomalie {
  readonly id: string;
  readonly vehicle_id: string;
  readonly trip_sheet_id: string | null;
  readonly km_asteptat: number;
  readonly km_declarat: number;
  readonly diferenta: number | null;
  readonly tip: "regres" | "salt";
  readonly explicatie: string | null;
  readonly confirmat_la: string | null;
  readonly nota: string | null;
  readonly created_at: string;
}

export interface AngajatRezumat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

// ── Cursorul keyset ─────────────────────────────────────────────────────────
//
// Codificarea, ghilimelarea și predicatul trăiau AICI, în copii aproape
// identice răspândite prin zece fișiere de citiri. Au fost mutate în
// `./cursor.ts`, unde cursorul poartă o VALOARE opacă în loc de o coloană
// încuiată în el — deci aceeași structură servește orice sortare, nu doar cea
// implicită. Testele lor sunt în `cursor.test.ts`.

/**
 * Cheia din URL → coloana din bază. Traducerea e OBLIGATORIU explicită: numele
 * coloanei intră într-un `.order()` și într-un predicat construit ca text, deci
 * nu are voie să vină din afară. Cheile sunt românești fiindcă apar în adresa pe
 * care omul o copiază; coloanele rămân englezești, ca tot restul schemei.
 */
const COLOANA_SORTARE_VEHICUL: Readonly<Record<SortareVehicule, string>> = {
  numar: "nr_inmatriculare",
  marca: "marca",
  km: "km_curent",
  stare: "status",
};

/** Valoarea de cursor a ultimului rând, pe fiecare sortare posibilă. */
const VALOARE_CURSOR_VEHICUL: Readonly<Record<SortareVehicule, (v: RandVehicul) => string>> = {
  numar: (v) => v.nr_inmatriculare,
  marca: (v) => v.marca,
  km: (v) => String(v.km_curent),
  stare: (v) => v.status,
};

const SORTARE_IMPLICITA_VEHICULE = { cheie: "numar", directie: "asc" } as const;

const COLOANA_SORTARE_FOAIE: Readonly<Record<SortareFoi, string>> = {
  plecare: "plecare_la",
  stare: "status",
};

const VALOARE_CURSOR_FOAIE: Readonly<Record<SortareFoi, (f: RandFoaie) => string>> = {
  plecare: (f) => f.plecare_la,
  stare: (f) => f.status,
};

const SORTARE_IMPLICITA_FOI = { cheie: "plecare", directie: "desc" } as const;

/**
 * `sort` e opțional în SEMNĂTURĂ, nu în schemă.
 *
 * Ecranele care listează îl parsează din URL și îl trimit întreg; apelanții care
 * cer o felie fixă — selectorul de vehicule din foaia nouă, lista de aprobat —
 * n-au sortare de ales și n-ar trebui să scrie `sort: null` doar ca să treacă de
 * verificarea de tipuri.
 */
export type FiltreVehiculeCitire = Omit<FiltreVehicule, "sort"> & {
  readonly sort?: string | null;
};

export type FiltreFoiCitire = Omit<FiltreFoi, "sort"> & { readonly sort?: string | null };

const COLOANE_VEHICUL_LISTA =
  "id, nr_inmatriculare, marca, model, categorie, tip_combustibil, an_fabricatie, " +
  "km_curent, employee_id, department_id, status, prag_salt_km, data_iesire, " +
  "consum_mediu_declarat";

const COLOANE_FOAIE =
  "id, vehicle_id, employee_id, numar, plecare_la, sosire_la, km_plecare, km_sosire, " +
  "km_parcursi, traseu, scop, status, trimis_la, aprobat_la";

// ── Vehicule ────────────────────────────────────────────────────────────────

export async function listeazaVehicule(
  organizationId: string,
  filtre: FiltreVehiculeCitire,
): Promise<RezultatVehicule> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort ?? null, SORTARI_VEHICULE, SORTARE_IMPLICITA_VEHICULE);
  const coloana = COLOANA_SORTARE_VEHICUL[sortare.cheie];
  const crescator = sortare.directie === "asc";

  let interogare = db
    .from("vehicles")
    .select(
      COLOANE_VEHICUL_LISTA,
      // `count: "exact"` pe ACEEAȘI interogare: numărătoarea respectă filtrele
      // ȘI politicile RLS, fără un al doilea drum la bază care le-ar putea
      // aplica altfel.
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    // Identificatorul e MEREU al doilea criteriu: coloana de sortare nu e unică
    // (două vehicule pot avea aceeași marcă), iar fără el ordinea dintre ele e
    // nedefinită, deci paginarea poate sări sau repeta exact acolo.
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);
  if (filtre.categorie !== null) interogare = interogare.eq("categorie", filtre.categorie);
  if (filtre.cauta !== null) {
    interogare = interogare.ilike("nr_inmatriculare", `%${filtre.cauta}%`);
  }

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    // Un cursor stricat înseamnă prima pagină, nu o eroare: cel mai probabil
    // vine dintr-un link vechi sau trunchiat la copiere.
    if (c !== null) interogare = interogare.or(predicatKeyset(coloana, c, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandVehicul[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: VALOARE_CURSOR_VEHICUL[sortare.cheie](ultim), id: ultim.id })
        : null,
    total: count ?? randuri.length,
    sortare,
  };
}

export async function citesteVehicul(organizationId: string, id: string): Promise<Vehicul | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicles")
    .select(
      `${COLOANE_VEHICUL_LISTA}, vin, culoare, capacitate_cilindrica, masa_maxima_kg, ` +
        "numar_locuri, valoare_achizitie, data_achizitie, " +
        "motiv_iesire, observatii, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Vehicul>();

  if (error !== null) throw error;
  return data;
}

/**
 * Scadențele curente ale unui grup de vehicule, pentru semaforul din listă.
 *
 * Se citește din `vehicle_documents`, NU din `expirables`. Politica
 * `expirabile_select` cere și `compliance:read`, pe care un administrator de
 * flotă nu-l are — semaforul ar fi fost gol tocmai pentru omul care are nevoie
 * de el. `vehicle_documents` se vede cu `vehicles:read`.
 */
export async function scadenteCurente(
  idVehicule: readonly string[],
): Promise<readonly ScadentaVehicul[]> {
  if (idVehicule.length === 0) return [];

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_documents")
    .select("vehicle_id, document_type_id, expira_la, numar")
    .in("vehicle_id", [...idVehicule])
    .eq("este_curent", true)
    .is("deleted_at", null)
    .returns<ScadentaVehicul[]>();

  if (error !== null) throw error;
  return data ?? [];
}

export async function documenteleVehiculului(
  vehiculId: string,
): Promise<readonly DocumentVehicul[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_documents")
    .select(
      "id, document_type_id, numar, emitent, valabil_de_la, expira_la, cost, " +
        "fisier_path, este_curent, observatii",
    )
    .eq("vehicle_id", vehiculId)
    .is("deleted_at", null)
    .order("expira_la", { ascending: false, nullsFirst: false })
    .returns<DocumentVehicul[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Nomenclatorul de tipuri de document.
 *
 * FĂRĂ filtru pe `organization_id`: rândurile de platformă îl au NULL și sunt
 * vizibile tuturor. Un filtru pe organizație ar fi ascuns cele unsprezece tipuri
 * implicite — ITP, RCA, casco, rovinietă, revizie, extinctor, trusă medicală,
 * licență de transport, copie conformă, tahograf, ADR — adică exact pe cele pe
 * care le folosește oricine.
 */
export async function tipuriDocument(): Promise<readonly TipDocument[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_document_types")
    .select("id, cod, denumire, descriere, cere_expirare, obligatoriu, ordine")
    .eq("activ", true)
    .is("deleted_at", null)
    .order("ordine", { ascending: true })
    .returns<TipDocument[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Foi de parcurs ──────────────────────────────────────────────────────────

export async function listeazaFoi(
  organizationId: string,
  filtre: FiltreFoiCitire,
): Promise<RezultatFoi> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort ?? null, SORTARI_FOI, SORTARE_IMPLICITA_FOI);
  const coloana = COLOANA_SORTARE_FOAIE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  let interogare = db
    .from("trip_sheets")
    .select(COLOANE_FOAIE, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);
  if (filtre.vehicul !== null) interogare = interogare.eq("vehicle_id", filtre.vehicul);

  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset(coloana, c, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandFoaie[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: VALOARE_CURSOR_FOAIE[sortare.cheie](ultim), id: ultim.id })
        : null,
    total: count ?? randuri.length,
    sortare,
  };
}

export async function citesteFoaie(organizationId: string, id: string): Promise<Foaie | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("trip_sheets")
    .select(`${COLOANE_FOAIE}, observatii, motiv_respingere`)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Foaie>();

  if (error !== null) throw error;
  return data;
}

/**
 * Kilometrajul de la care pornește o foaie nouă.
 *
 * `max(ultimul km de sosire aprobat, vehicles.km_curent)` — exact ce face
 * triggerul care prepopulează. Îl calculăm și în client ca omul să vadă cifra
 * ÎNAINTE de a salva, nu după ce baza i-o corectează pe tăcute.
 */
export async function kmDePlecareSugerat(
  organizationId: string,
  vehiculId: string,
): Promise<number | null> {
  const db = await createServerSupabase();

  const [foaie, vehicul] = await Promise.all([
    db
      .from("trip_sheets")
      .select("km_sosire")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehiculId)
      .eq("status", "aprobat")
      .not("km_sosire", "is", null)
      .is("deleted_at", null)
      .order("km_sosire", { ascending: false })
      .limit(1)
      .maybeSingle<{ km_sosire: number | null }>(),
    db
      .from("vehicles")
      .select("km_curent")
      .eq("organization_id", organizationId)
      .eq("id", vehiculId)
      .is("deleted_at", null)
      .maybeSingle<{ km_curent: number }>(),
  ]);

  if (foaie.error !== null) throw foaie.error;
  if (vehicul.error !== null) throw vehicul.error;

  const dinFoaie = foaie.data?.km_sosire ?? null;
  const dinVehicul = vehicul.data?.km_curent ?? null;
  if (dinFoaie === null && dinVehicul === null) return null;
  return Math.max(dinFoaie ?? 0, dinVehicul ?? 0);
}

/** Litrii și costul unei foi, adunate. Cifrele pe care le semnează aprobatorul. */
export interface CombustibilFoaie {
  readonly litri: number;
  readonly cost: number;
  readonly alimentari: number;
}

export interface RezultatCombustibil {
  readonly perFoaie: ReadonlyMap<string, CombustibilFoaie>;
  /**
   * Citirea a atins plafonul, deci unele alimentări lipsesc din totaluri.
   * Se raportează pe ecran: un total de litri prea mic, fără nicio eroare, e
   * exact felul de cifră greșită care trece de o aprobare.
   */
  readonly trunchiat: boolean;
}

/**
 * Combustibilul unui LOT de foi, într-o singură citire.
 *
 * Coada de aprobare avea nevoie de litri, cost și consum pentru fiecare rând;
 * `alimentarileFoii` per foaie ar fi însemnat o sută de drumuri la bază pe un
 * ecran care se deschide de zeci de ori pe zi. Agregarea se face în TypeScript,
 * nu în Postgres, fiindcă `.rpc()` nu ajunge la schema `app` și o vedere nouă ar
 * fi cerut o migrare.
 */
export async function combustibilPeFoi(idFoi: readonly string[]): Promise<RezultatCombustibil> {
  const unice = [...new Set(idFoi)];
  if (unice.length === 0) return { perFoaie: new Map(), trunchiat: false };

  const db = await createServerSupabase();
  // 20 de alimentări pe foaie e generos pentru o cursă; plafonul rămâne sub
  // `max_rows = 1000`, care ar tăia TĂCUT dacă l-am depăși.
  const plafon = Math.min(unice.length * 20, PLAFON_POSTGREST);
  const { data, error } = await db
    .from("fuel_entries")
    .select("trip_sheet_id, litri, cost")
    .in("trip_sheet_id", unice)
    .is("deleted_at", null)
    .limit(plafon)
    .returns<{ trip_sheet_id: string; litri: number; cost: number }[]>();

  if (error !== null) throw error;
  const randuri = data ?? [];

  const perFoaie = new Map<string, CombustibilFoaie>();
  for (const r of randuri) {
    const pana_acum = perFoaie.get(r.trip_sheet_id) ?? { litri: 0, cost: 0, alimentari: 0 };
    perFoaie.set(r.trip_sheet_id, {
      litri: pana_acum.litri + r.litri,
      cost: pana_acum.cost + r.cost,
      alimentari: pana_acum.alimentari + 1,
    });
  }

  return { perFoaie, trunchiat: randuri.length >= plafon };
}

export async function alimentarileFoii(foaieId: string): Promise<readonly Alimentare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_entries")
    .select("id, litri, cost, pret_litru, statie, numar_bon, alimentat_la, plin, observatii")
    .eq("trip_sheet_id", foaieId)
    .is("deleted_at", null)
    .order("alimentat_la", { ascending: true })
    .returns<Alimentare[]>();

  if (error !== null) throw error;
  return data ?? [];
}

const COLOANE_ANOMALIE =
  "id, vehicle_id, trip_sheet_id, km_asteptat, km_declarat, diferenta, tip, " +
  "explicatie, confirmat_la, nota, created_at";

/** Plafonul tăcut al PostgREST. O citire care îl atinge e trunchiată, fără eroare. */
const PLAFON_POSTGREST = 1000;

/** Câte anomalii se citesc deodată în coada de explicat. */
export const PLAFON_ANOMALII = 200;

export async function anomaliiNeconfirmate(organizationId: string): Promise<readonly Anomalie[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("odometer_anomalies")
    .select(COLOANE_ANOMALIE)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("confirmat_la", null)
    .order("created_at", { ascending: false })
    .limit(PLAFON_ANOMALII)
    .returns<Anomalie[]>();

  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Anomaliile produse de un lot de foi de parcurs, grupate pe foaie.
 *
 * Există fiindcă anomalia trăia doar în `useState`-ul formularului care a
 * declanșat-o, iar `router.refresh()` de pe rândul următor o ștergea: o foaie cu
 * un salt de 3 000 km neexplicat arăta, la reîncărcare și în coada de aprobare,
 * exact ca una curată. Se citesc și cele CONFIRMATE — o anomalie explicată tot
 * schimbă felul în care se citește foaia, doar că nu mai cere o acțiune.
 */
export async function anomaliiPeFoi(
  organizationId: string,
  idFoi: readonly string[],
): Promise<ReadonlyMap<string, readonly Anomalie[]>> {
  const unice = [...new Set(idFoi)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("odometer_anomalies")
    .select(COLOANE_ANOMALIE)
    .eq("organization_id", organizationId)
    .in("trip_sheet_id", unice)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(unice.length * 5, PLAFON_POSTGREST))
    .returns<Anomalie[]>();

  if (error !== null) throw error;

  const perFoaie = new Map<string, Anomalie[]>();
  for (const a of data ?? []) {
    if (a.trip_sheet_id === null) continue;
    const aleFoii = perFoaie.get(a.trip_sheet_id);
    if (aleFoii === undefined) perFoaie.set(a.trip_sheet_id, [a]);
    else aleFoii.push(a);
  }
  return perFoaie;
}

/**
 * Numele șoferilor, citite separat.
 *
 * Nu prin embed: un manager are `trip_sheets:read` la scope `team` dar niciun
 * drept pe `vehicles`, iar un embed refuzat de RLS vine NULL fără nicio eroare —
 * adică o coloană goală pe care nimeni n-o explică. Citirea separată face
 * absența vizibilă și tipabilă.
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

export async function vehiculeDupaId(
  organizationId: string,
  ids: readonly string[],
): Promise<ReadonlyMap<string, RandVehicul>> {
  const unice = [...new Set(ids)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicles")
    .select(COLOANE_VEHICUL_LISTA)
    .eq("organization_id", organizationId)
    .in("id", unice)
    .is("deleted_at", null)
    .returns<RandVehicul[]>();

  if (error !== null) throw error;
  return new Map((data ?? []).map((v) => [v.id, v]));
}
