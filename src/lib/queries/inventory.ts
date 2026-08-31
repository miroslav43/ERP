// src/lib/queries/inventory.ts
// Citirile de inventar: listă cu paginare keyset, fișă de obiect, istoric de
// alocări și „ce am eu în primire". Spre deosebire de queries/employees.ts,
// aici NU se mai adaugă niciun filtru de scope (own/team/all) în interogări —
// RLS din 0010/0016/0019 restrânge singură rândurile, direct în Postgres.

import {
  SORTARI_INVENTAR,
  type FiltreInventar,
  type SortareInventar,
  type StareObiect,
  type StatusObiect,
} from "@/schemas/inventory";
import { aduna, dinLei, inLei, ZERO_BANI } from "@/domain/bani";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  codificaCursor as codificaKeyset,
  decodificaCursor as decodificaKeyset,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

export interface RandInventar {
  readonly id: string;
  readonly denumire: string;
  readonly numar_inventar: string;
  readonly serie: string | null;
  readonly model: string | null;
  readonly producator: string | null;
  readonly category_id: string | null;
  readonly status: StatusObiect;
  readonly stare: StareObiect;
  readonly locatie: string | null;
  readonly valoare: number | null;
  readonly data_achizitie: string | null;
  readonly garantie_expira: string | null;
}

export interface RezultatInventar {
  readonly randuri: readonly RandInventar[];
  readonly urmatorulCursor: string | null;
  /**
   * Câte obiecte sunt în total, după filtre. Lista nu spunea nimic despre
   * mărimea ei: „Pagina următoare" fără un total nu-ți spune dacă mai urmează
   * un ecran sau o sută.
   */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareInventar; directie: Directie }>;
}

export interface ObiectInventar extends RandInventar {
  readonly observatii: string | null;
  readonly import_batch_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface DetinatorAlocare {
  readonly id: string;
  readonly itemId: string;
  readonly employeeId: string;
  readonly angajatNume: string | null;
  readonly angajatMarca: string | null;
  readonly predatLa: string;
  readonly confirmatDeAngajatLa: string | null;
}

export interface IstoricAlocare {
  readonly id: string;
  readonly employee_id: string;
  readonly predat_la: string;
  readonly returnat_la: string | null;
  readonly stare_la_predare: StareObiect;
  readonly stare_la_returnare: StareObiect | null;
  readonly observatii: string | null;
  readonly pv_document_path: string | null;
  readonly confirmat_de_angajat_la: string | null;
}

export interface AngajatRezumat {
  readonly id: string;
  // `employees.full_name` e o coloană generată din `last_name`/`first_name`
  // (ambele NOT NULL), dar Postgres nu o marchează NOT NULL, deci generatorul
  // de tipuri o dă drept `string | null` — respectat aici, nu forțat cu `!`.
  readonly full_name: string | null;
  readonly marca: string;
}

export interface Categorie {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly ordine: number;
}

interface ObiectInPrimire {
  readonly id: string;
  readonly denumire: string;
  readonly numar_inventar: string;
  readonly serie: string | null;
}

export interface RandInPrimire {
  readonly id: string;
  readonly item_id: string;
  readonly predat_la: string;
  readonly stare_la_predare: StareObiect;
  readonly observatii: string | null;
  readonly confirmat_de_angajat_la: string | null;
  readonly obiect: ObiectInPrimire;
}

/*
 * Cursorul, ghilimelarea și predicatul keyset trăiau aici, într-o copie proprie
 * cu numele coloanei ÎNCUIAT în structură (`{ denumire, id }`) — una dintre
 * cele zece copii aproape identice din fișierele de citiri. Acum vin din
 * `./cursor.ts`, unde cursorul poartă o valoare opacă, deci aceeași structură
 * servește orice coloană de sortare.
 */

/**
 * Cheia din URL → coloana din bază. Traducerea e OBLIGATORIU explicită: numele
 * coloanei intră într-un predicat construit ca text, deci nu are voie să vină
 * din afară.
 */
const COLOANA_SORTARE: Readonly<Record<SortareInventar, string>> = {
  denumire: "denumire",
  numar: "numar_inventar",
};

const SORTARE_IMPLICITA = { cheie: "denumire", directie: "asc" } as const;

const COLOANE_LISTA =
  "id, denumire, numar_inventar, serie, model, producator, category_id, status, stare, locatie, valoare, data_achizitie, garantie_expira";

export async function listeazaObiecte(
  organizationId: string,
  filtre: FiltreInventar,
): Promise<RezultatInventar> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort, SORTARI_INVENTAR, SORTARE_IMPLICITA);
  const coloana = COLOANA_SORTARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  /*
   * ── DE CE NUMĂRĂTOAREA E O A DOUA INTEROGARE ──────────────────────────
   * Aici stătea `count: "exact"` pe ACEEAȘI interogare, cu argumentul — corect
   * în sine — că așa numărătoarea respectă filtrele ȘI politicile RLS din
   * 0010/0016/0019, fără un al doilea drum la bază. Argumentul rata un lucru:
   * predicatul KEYSET e și el un filtru, iar PostgREST n-are de unde ști că e
   * „paginare”. Pus pe aceeași interogare, `count` numără doar ce a rămas DUPĂ
   * cursor.
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
      ilike: (c: string, v: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId);
    if (filtre.status !== null) cu = cu.eq("status", filtre.status);
    if (filtre.stare !== null) cu = cu.eq("stare", filtre.stare);
    if (filtre.category_id !== null) cu = cu.eq("category_id", filtre.category_id);
    // Filtre separate, NU `.or(...)`: textul utilizatorului nu se interpolează
    // niciodată în sintaxa `or=()`.
    if (filtre.q !== null) cu = cu.ilike("denumire", `%${filtre.q}%`);
    if (filtre.numar !== null) cu = cu.ilike("numar_inventar", `%${filtre.numar}%`);
    return cu;
  };

  let interogare = filtreaza(db.from("inventory_items").select(COLOANE_LISTA))
    // Identificatorul e MEREU al doilea criteriu: nici denumirea, nici numărul
    // de inventar nu sunt unice pe organizație, iar fără el ordinea dintre două
    // rânduri egale e nedefinită — exact acolo poate paginarea să sară.
    .order(coloana, { ascending: crescator })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaKeyset(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandInventar[]>(),
    filtreaza(db.from("inventory_items").select("id", { count: "exact", head: true })),
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
      : sortare.cheie === "numar"
        ? ultimul.numar_inventar
        : ultimul.denumire;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && valoareCursor !== null && ultimul !== undefined
        ? codificaKeyset({ valoare: valoareCursor, id: ultimul.id })
        : null,
    total: count ?? randuri.length,
    sortare,
  };
}

/** Perechea id → nume/marcă, pentru rândurile de alocare care nu au embed direct. */
/**
 * Angajații activi, pentru selectorul din caseta de predare.
 *
 * Interogarea asta stătea scrisă direct în `inventar/[id]/page.tsx`, singura
 * din modul care nu trecea prin stratul de citiri. Locul ei e aici: caseta de
 * predare se montează abia la deschidere, dar lista trebuie să existe pe server
 * la randarea fișei, deci apelantul o cere o dată și o dă mai departe ca prop.
 */
export async function angajatiActivi(organizationId: string): Promise<readonly AngajatRezumat[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .order("full_name")
    // `max_rows = 1000` (supabase/config.toml) TRUNCHIAZĂ TĂCUT, fără eroare și
    // fără vreun semn în date. O limită cerută explicit spune cel puțin unde se
    // oprește lista; geamăna din `flota/foi/date-foaie-noua.ts` cere același
    // 500. Peste atâția angajați activi, selectorul are oricum nevoie de
    // căutare, nu de încă o mie de opțiuni.
    .limit(500);
  if (error !== null) throw error;
  return data ?? [];
}

export async function numeleAngajatilor(
  organizationId: string,
  employeeIds: readonly string[],
): Promise<ReadonlyMap<string, AngajatRezumat>> {
  const idUnice = [...new Set(employeeIds)];
  if (idUnice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .in("id", idUnice);
  if (error !== null) throw error;

  return new Map((data ?? []).map((angajat) => [angajat.id, angajat] as const));
}

/** Deținătorii curenți ai unui lot de obiecte — pentru coloana „Deținut de" din listă. */
export async function alocariDeschise(
  organizationId: string,
  itemIds: readonly string[],
): Promise<ReadonlyMap<string, DetinatorAlocare>> {
  if (itemIds.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_allocations")
    .select("id, item_id, employee_id, predat_la, confirmat_de_angajat_la")
    .eq("organization_id", organizationId)
    .in("item_id", itemIds)
    .is("returnat_la", null)
    .is("deleted_at", null);
  if (error !== null) throw error;

  const randuri = data ?? [];
  if (randuri.length === 0) return new Map();

  const angajati = await numeleAngajatilor(
    organizationId,
    randuri.map((rand) => rand.employee_id),
  );

  const rezultat = new Map<string, DetinatorAlocare>();
  for (const rand of randuri) {
    const angajat = angajati.get(rand.employee_id) ?? null;
    rezultat.set(rand.item_id, {
      id: rand.id,
      itemId: rand.item_id,
      employeeId: rand.employee_id,
      angajatNume: angajat?.full_name ?? null,
      angajatMarca: angajat?.marca ?? null,
      predatLa: rand.predat_la,
      confirmatDeAngajatLa: rand.confirmat_de_angajat_la,
    });
  }
  return rezultat;
}

export async function citesteObiect(
  organizationId: string,
  itemId: string,
): Promise<ObiectInventar | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_items")
    .select(`${COLOANE_LISTA}, observatii, import_batch_id, created_at, updated_at`)
    .eq("organization_id", organizationId)
    .eq("id", itemId)
    .maybeSingle<ObiectInventar>();
  if (error !== null) throw error;
  return data;
}

export async function istoricAlocari(
  organizationId: string,
  itemId: string,
): Promise<readonly IstoricAlocare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_allocations")
    .select(
      "id, employee_id, predat_la, returnat_la, stare_la_predare, stare_la_returnare, observatii, pv_document_path, confirmat_de_angajat_la",
    )
    .eq("organization_id", organizationId)
    .eq("item_id", itemId)
    .is("deleted_at", null)
    .order("predat_la", { ascending: false })
    .returns<IstoricAlocare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Catalogul de categorii, platformă + proprii. `organization_id` e nullable
 * (categoriile de platformă nu aparțin niciunei organizații), iar RLS arată
 * ambele seturi oricui are măcar `inventory:read = own` — de aceea funcția nu
 * primește și nu filtrează după `organizationId`.
 */
export async function categorii(): Promise<readonly Categorie[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("inventory_categories")
    .select("id, cod, denumire, ordine")
    .is("deleted_at", null)
    .eq("activ", true)
    .order("ordine")
    .order("denumire");
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * „Ce am eu în primire acum". Pentru scope `own`, `propriaFisaId` trebuie
 * trimis `null`: RLS restrânge deja singură la `employee_id = current_employee_id`.
 * Pentru `team`/`all`, RLS NU restrânge la propria fișă — apelantul trebuie să
 * dea `propriaFisaId` explicit (obținut cu `idFisaProprie()`), altfel funcția
 * ar întoarce alocările deschise ale ÎNTREGII organizații.
 */
export async function inPrimireaMea(
  organizationId: string,
  propriaFisaId: string | null,
): Promise<readonly RandInPrimire[]> {
  const db = await createServerSupabase();
  let interogare = db
    .from("inventory_allocations")
    .select(
      "id, item_id, predat_la, stare_la_predare, observatii, confirmat_de_angajat_la, obiect:inventory_items!item_id(id, denumire, numar_inventar, serie)",
    )
    .eq("organization_id", organizationId)
    .is("returnat_la", null)
    .is("deleted_at", null)
    .order("predat_la", { ascending: false });

  if (propriaFisaId !== null) {
    interogare = interogare.eq("employee_id", propriaFisaId);
  }

  const { data, error } = await interogare.returns<RandInPrimire[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/* ────────────────────────── Rezumatul registrului ──────────────────────── */

export interface RezumatInventar {
  readonly inStoc: number;
  readonly alocate: number;
  readonly inReparatie: number;
  readonly casate: number;
  /**
   * Suma valorilor, în lei, FĂRĂ obiectele casate.
   *
   * Un obiect scos din uz nu mai e patrimoniu utilizabil, iar întrebarea la care
   * răspunde cifra e „cât valorează ce am”, nu „cât am cumpărat vreodată”.
   * Obiectele fără valoare completată contează 0 — la fel ca în bază, unde
   * coloana e nullable, nu `default 0`.
   */
  readonly valoareTotala: number;
}

/** Câte rânduri sunt pe fiecare stare de circuit; zero rânduri transferate. */
async function numaraPeStatus(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  status: StatusObiect,
): Promise<number> {
  const { count, error } = await db
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", status);
  if (error !== null) throw error;
  return count ?? 0;
}

/** Câte rânduri se cer într-o felie la însumare. Egal cu `max_rows` din PostgREST. */
const FELIE_INSUMARE = 1000;

/**
 * Suma valorilor, adunată în felii de 1000, pe cursor keyset.
 *
 * ── DE CE NU `.select("valoare.sum()")` ───────────────────────────────────
 * Agregatele PostgREST nu sunt folosite nicăieri în `src/lib/queries` și nu
 * sunt activate în `supabase/config.toml`. Un agregat care nu e activat nu dă
 * eroare de compilare — dă un rezultat greșit sau un 400 în producție.
 *
 * ── DE CE NU O SINGURĂ CITIRE ─────────────────────────────────────────────
 * `max_rows = 1000` (`supabase/config.toml:18`) TRUNCHIAZĂ TĂCUT. Un
 * `.select("valoare")` fără paginare merge perfect pe registrul de azi și
 * începe să mintă exact la al 1001-lea obiect, fără nicio eroare — adică
 * tocmai la firma pentru care contorul contează.
 *
 * ── DE CE KEYSET, NU `.range()` ───────────────────────────────────────────
 * `.range()` fără `order` stabil poate întoarce același rând de două ori și
 * sări altul între două cereri, fiindcă Postgres nu promite nicio ordine. La o
 * listă asta se vede; la o sumă, nu. `id` e uuid, deci ordinea e totală.
 *
 * Adunarea se face în bani întregi, prin `@/domain/bani`: 1000 de adunări în
 * virgulă mobilă adună și eroarea de reprezentare, iar rezultatul ar fi apărut
 * pe ecran ca „12.345,67000000001 lei”.
 */
async function insumeazaValoarea(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
): Promise<number> {
  let total = ZERO_BANI;
  let ultimulId: string | null = null;

  for (;;) {
    let interogare = db
      .from("inventory_items")
      .select("id, valoare")
      .eq("organization_id", organizationId)
      .neq("status", "casat")
      .order("id")
      .limit(FELIE_INSUMARE);
    if (ultimulId !== null) interogare = interogare.gt("id", ultimulId);

    const { data, error } = await interogare.returns<{ id: string; valoare: number | null }[]>();
    if (error !== null) throw error;

    const randuri = data ?? [];
    for (const rand of randuri) {
      if (rand.valoare !== null) total = aduna(total, dinLei(rand.valoare));
    }

    if (randuri.length < FELIE_INSUMARE) return inLei(total);
    const ultimul = randuri[randuri.length - 1];
    if (ultimul === undefined) return inLei(total);
    ultimulId = ultimul.id;
  }
}

/**
 * Forma registrului: câte obiecte sunt pe fiecare stare de circuit și cât
 * valorează la un loc.
 *
 * Trece prin RLS ca orice altă citire, deci contoarele sunt deja restrânse la
 * ce are voie să vadă cel care întreabă. La `inventory:read = own` sau `team`,
 * politica de pe `inventory_items` arată numai obiectele alocate persoanei sau
 * echipei — deci rezumatul ar fi un rând de zerouri care par o defecțiune.
 * Apelantul îl cere DOAR la scope `all`; funcția nu impune asta singură,
 * fiindcă nu are de unde ști permisiunile.
 */
export async function rezumatInventar(organizationId: string): Promise<RezumatInventar> {
  const db = await createServerSupabase();
  const [inStoc, alocate, inReparatie, casate, valoareTotala] = await Promise.all([
    numaraPeStatus(db, organizationId, "in_stoc"),
    numaraPeStatus(db, organizationId, "alocat"),
    numaraPeStatus(db, organizationId, "in_reparatie"),
    numaraPeStatus(db, organizationId, "casat"),
    insumeazaValoarea(db, organizationId),
  ]);
  return { inStoc, alocate, inReparatie, casate, valoareTotala };
}
