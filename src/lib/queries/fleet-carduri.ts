// src/lib/queries/fleet-carduri.ts
// Citirile pentru cardurile de combustibil și extrasele lor (0214, F12b).
//
// Fișier separat de `fleet.ts`, pe care îl scriu și fazele paralele ale
// flotei. NU se adaugă filtre de scope: le pun politicile (`carduri_select`
// urmează vehiculul sau șoferul; tranzacțiile, loturile și profilurile cer
// `vehicles:read/update = all`). Filtrul pe `organization_id` e explicit doar ca
// plasă, nu ca autorizare. Tipurile vin din `database.ts` (selecturi literale),
// nu din generice scrise de mână; `coloane.test.ts` verifică fiecare coloană.
//
// ── FĂRĂ TRUNCHIERE TĂCUTĂ ────────────────────────────────────────────────
// `max_rows = 1000` taie tăcut orice răspuns PostgREST. Citirile care alimentează
// potrivirea numără (`count: "exact"`) și REFUZĂ la plafon: o potrivire făcută
// pe o parte din foi ar declara „fără foaie” tranzacții care au foaie.

import "server-only";

import { intervalLuna } from "@/domain/fleet/rapoarte";
import type {
  AlimentareContext,
  AlocareContext,
  CardContext,
  FoaieContext,
  StarePotrivire,
  VehiculContext,
} from "@/domain/fleet/carduri/potrivire";
import { limitExceeded } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import type { FiltreTranzactii } from "@/schemas/fleet-carduri";

import { codificaCursor, decodificaCursor, predicatKeyset } from "./cursor";

/** Plafonul PostgREST (`max_rows`). La el, citirea se refuză, nu se taie. */
export const PLAFON_CITIRE = 1000;
/** Bucățile pentru `.in(...)`: un URL PostgREST prea lung cade cu 414. */
const BUCATA_IN = 200;

function verificaPlafon(count: number | null, ce: string): void {
  if ((count ?? 0) >= PLAFON_CITIRE) {
    throw limitExceeded(
      `Prea multe înregistrări (${ce}) pentru o singură potrivire. Importați extrasul pe perioade mai scurte.`,
    );
  }
}

function bucati<T>(lista: readonly T[]): T[][] {
  const iesire: T[][] = [];
  for (let i = 0; i < lista.length; i += BUCATA_IN) iesire.push(lista.slice(i, i + BUCATA_IN));
  return iesire;
}

/** `AAAA-LL-ZZ` ± zile, fără `Date` local (ziua e calendaristică). */
function ziMutata(zi: string, delta: number): string {
  const d = new Date(`${zi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ── Cardurile ─────────────────────────────────────────────────────────────

/**
 * Embed-urile vin NULL fără eroare când RLS-ul ascunde vehiculul sau fișa
 * (capcana #18): un manager vede cardul vehiculului pool, nu și fișa șoferului
 * din altă echipă. Ecranul afișează „—”.
 */
export async function listeazaCarduri(
  organizationId: string,
  filtre: Readonly<{
    vehicul?: string | null;
    sofer?: string | null;
    doarActive?: boolean;
  }> = {},
) {
  const db = await createServerSupabase();
  let q = db
    .from("fuel_cards")
    .select(
      "id, emitent, denumire, ultimele_cifre, amprenta_numar, vehicle_id, employee_id, valabil_pana, status, observatii, created_at, vehicul:vehicles!vehicle_id(id, nr_inmatriculare, status, deleted_at), sofer:employees!employee_id(id, full_name)",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  const vehicul = filtre.vehicul ?? null;
  const sofer = filtre.sofer ?? null;
  if (vehicul !== null) q = q.eq("vehicle_id", vehicul);
  if (sofer !== null) q = q.eq("employee_id", sofer);
  if (filtre.doarActive === true) q = q.eq("status", "activ");
  const { data, error, count } = await q
    .order("status")
    .order("emitent")
    .order("ultimele_cifre")
    .order("id")
    .limit(PLAFON_CITIRE);
  if (error !== null) throw error;
  verificaPlafon(count, "carduri");
  return data ?? [];
}
export type RandCard = Awaited<ReturnType<typeof listeazaCarduri>>[number];

/** Câte carduri arată „Mașina mea”: un om are unul, două, nu sute. */
export const PLAFON_CARDURI_MELE = 20;

/**
 * Cardurile de combustibil ale omului din portal (F12b): pe fișa lui SAU pe una
 * dintre mașinile pe care le conduce (alocată lui, ori comună). Notificarea
 * cardului care expiră îl duce, fără `team`/`all`, la `/portal/masina-mea`;
 * de aceea cardul trebuie să fie acolo.
 *
 * Filtrul pe fișă e EXPLICIT (ca `pvurileMele`): un administrator care e și
 * șofer vede prin RLS toate cardurile firmei. Fără anulate. Doar ultimele cifre:
 * numărul întreg nu se păstrează, iar amprenta nu iese din server.
 */
export async function carduleMele(
  organizationId: string,
  employeeId: string,
  vehiculIds: readonly string[],
) {
  const unice = [...new Set(vehiculIds)];
  const conditii = [`employee_id.eq.${employeeId}`];
  if (unice.length > 0) conditii.push(`vehicle_id.in.(${unice.join(",")})`);
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_cards")
    .select("id, emitent, denumire, ultimele_cifre, vehicle_id, employee_id, valabil_pana, status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("status", "anulat")
    .or(conditii.join(","))
    .order("emitent")
    .order("ultimele_cifre")
    .order("id")
    .limit(PLAFON_CARDURI_MELE);
  if (error !== null) throw error;
  return data ?? [];
}
export type CardulMeu = Awaited<ReturnType<typeof carduleMele>>[number];

export async function citesteCard(organizationId: string, id: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_cards")
    .select(
      "id, emitent, denumire, ultimele_cifre, vehicle_id, employee_id, valabil_pana, status, observatii",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

/** Toate cardurile neșterse, inclusiv anulate: tranzacțiile vechi încă se potrivesc pe ele. */
export async function cardurilePentruPotrivire(
  organizationId: string,
): Promise<readonly CardContext[]> {
  const db = await createServerSupabase();
  const { data, error, count } = await db
    .from("fuel_cards")
    .select("id, emitent, ultimele_cifre, amprenta_numar, vehicle_id, employee_id", {
      count: "exact",
    })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .limit(PLAFON_CITIRE);
  if (error !== null) throw error;
  verificaPlafon(count, "carduri");
  return data ?? [];
}

/** Vehiculele care pot primi un card: neșterse, nici vândute, nici casate. */
export async function vehiculePentruCard(organizationId: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicles")
    .select("id, nr_inmatriculare, marca, model")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("status", "in", "(vandut,casat)")
    .order("nr_inmatriculare")
    .limit(500);
  if (error !== null) throw error;
  return data ?? [];
}

/** Șoferii care pot fi titulari de card: fișele neșterse ale firmei. */
export async function soferiPentruCard(organizationId: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("full_name")
    .limit(500);
  if (error !== null) throw error;
  return data ?? [];
}

// ── Contextul potrivirii ──────────────────────────────────────────────────

export type ContextCitit = Readonly<{
  vehicule: readonly VehiculContext[];
  alocari: readonly AlocareContext[];
  foi: readonly FoaieContext[];
  alimentari: readonly AlimentareContext[];
  /** Alimentare → tranzacția care o ține legată acum. */
  legaturi: ReadonlyMap<string, string>;
}>;

/**
 * Tot ce cere `potrivesteTranzactii` pentru perioada `[deLa, panaLa]` (zile
 * românești), cu o zi în plus la fiecare capăt: vehiculele (și cele șterse,
 * ca un extras vechi să-și găsească mașina), alocările care intersectează
 * perioada, foile, alimentările lor și legăturile deja făcute.
 */
export async function contextPotrivire(
  organizationId: string,
  deLa: string,
  panaLa: string,
): Promise<ContextCitit> {
  const db = await createServerSupabase();
  const inceput = ziMutata(deLa, -1);
  const sfarsit = ziMutata(panaLa, 1);

  const [vehicule, alocari, foi] = await Promise.all([
    db
      .from("vehicles")
      // `data_iesire` (0218, I-h2): numărul păstrat poate sta pe două vehicule neșterse.
      .select("id, nr_inmatriculare, tip_combustibil, deleted_at, data_iesire", {
        count: "exact",
      })
      .eq("organization_id", organizationId)
      .limit(PLAFON_CITIRE),
    db
      .from("vehicle_assignments")
      .select("vehicle_id, employee_id, de_la, pana_la", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .lte("de_la", `${sfarsit}T23:59:59Z`)
      .or(`pana_la.is.null,pana_la.gte.${inceput}T00:00:00Z`)
      .limit(PLAFON_CITIRE),
    db
      .from("trip_sheets")
      .select("id, vehicle_id, employee_id, data, status, km_plecare, km_sosire", {
        count: "exact",
      })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("data", inceput)
      .lte("data", sfarsit)
      .limit(PLAFON_CITIRE),
  ]);
  if (vehicule.error !== null) throw vehicule.error;
  if (alocari.error !== null) throw alocari.error;
  if (foi.error !== null) throw foi.error;
  verificaPlafon(vehicule.count, "vehicule");
  verificaPlafon(alocari.count, "alocări");
  verificaPlafon(foi.count, "foi de parcurs");

  const idFoi = (foi.data ?? []).map((f) => f.id);
  const alimentari: AlimentareContext[] = [];
  for (const bucata of bucati(idFoi)) {
    const r = await db
      .from("fuel_entries")
      .select("id, trip_sheet_id, litri, cost, alimentat_la, numar_bon", {
        count: "exact",
      })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("trip_sheet_id", bucata)
      .limit(PLAFON_CITIRE);
    if (r.error !== null) throw r.error;
    verificaPlafon(r.count, "alimentări");
    alimentari.push(...(r.data ?? []));
  }
  if (alimentari.length >= PLAFON_CITIRE) verificaPlafon(alimentari.length, "alimentări");

  const legaturi = new Map<string, string>();
  for (const bucata of bucati(alimentari.map((a) => a.id))) {
    const r = await db
      .from("fuel_card_transactions")
      .select("id, fuel_entry_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("fuel_entry_id", bucata)
      .limit(PLAFON_CITIRE);
    if (r.error !== null) throw r.error;
    for (const t of r.data ?? []) if (t.fuel_entry_id !== null) legaturi.set(t.fuel_entry_id, t.id);
  }

  return {
    vehicule: vehicule.data ?? [],
    alocari: alocari.data ?? [],
    foi: foi.data ?? [],
    alimentari,
    legaturi,
  };
}

/** Cheile de dedup deja importate (neșterse) ale emitentului, din lista dată. */
export async function cheiDejaImportate(
  organizationId: string,
  emitent: string,
  chei: readonly string[],
): Promise<ReadonlySet<string>> {
  const db = await createServerSupabase();
  const gasite = new Set<string>();
  for (const bucata of bucati([...new Set(chei)])) {
    const { data, error } = await db
      .from("fuel_card_transactions")
      .select("cheie_dedup")
      .eq("organization_id", organizationId)
      .eq("emitent", emitent)
      .is("deleted_at", null)
      .in("cheie_dedup", bucata)
      .limit(PLAFON_CITIRE);
    if (error !== null) throw error;
    for (const r of data ?? []) gasite.add(r.cheie_dedup);
  }
  return gasite;
}

/** Importurile neanulate ale aceluiași fișier (sha256): „Fișierul a mai fost importat la …”. */
export async function importuriCuAcelasiFisier(organizationId: string, sha256: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_card_imports")
    .select("id, created_at, fisier_nume, finalizat_la")
    .eq("organization_id", organizationId)
    .eq("fisier_sha256", sha256)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error !== null) throw error;
  return data ?? [];
}

export async function citesteImport(organizationId: string, id: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_card_imports")
    .select("id, organization_id, emitent, fisier_sha256, randuri_fisier, finalizat_la, deleted_at")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

/** Ultimele importuri, pentru lista din ecranul tranzacțiilor. */
export async function listeazaImporturi(organizationId: string, limita = 20) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_card_imports")
    .select(
      "id, emitent, fisier_nume, perioada_de_la, perioada_pana_la, randuri_fisier, importate, duplicate, respinse, finalizat_la, created_at",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limita);
  if (error !== null) throw error;
  return data ?? [];
}
export type RandImport = Awaited<ReturnType<typeof listeazaImporturi>>[number];

export async function profilImport(organizationId: string, emitent: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_card_import_profiles")
    .select(
      "id, emitent, mapare, format_data, separator_zecimal, delimitator, codificare, rand_antet",
    )
    .eq("organization_id", organizationId)
    .eq("emitent", emitent)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

// ── Tranzacțiile ──────────────────────────────────────────────────────────

export type RezultatTranzactii<T> = Readonly<{
  randuri: readonly T[];
  urmatorulCursor: string | null;
  total: number;
}>;

/** Tranzacțiile lunii, cele mai noi întâi (keyset pe `efectuat_la desc, id desc`). */
export async function listeazaTranzactii(organizationId: string, filtre: FiltreTranzactii) {
  const db = await createServerSupabase();
  const { deLa, panaLa } = intervalLuna(filtre.luna);

  const filtreaza = <
    Q extends {
      eq: (c: string, v: string) => Q;
      is: (c: string, v: null) => Q;
      gte: (c: string, v: string) => Q;
      lte: (c: string, v: string) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("data_ro", deLa)
      .lte("data_ro", panaLa);
    if (filtre.stare !== null) cu = cu.eq("stare_potrivire", filtre.stare);
    if (filtre.card !== null) cu = cu.eq("card_id", filtre.card);
    if (filtre.vehicul !== null) cu = cu.eq("vehicle_id", filtre.vehicul);
    return cu;
  };

  let interogare = filtreaza(
    db
      .from("fuel_card_transactions")
      .select(
        "id, import_id, emitent, card_id, card_ultimele_cifre, efectuat_la, data_ro, are_ora, produs, categorie, tip_combustibil, cantitate, valoare_bruta, moneda, statie, localitate, nr_inmatriculare_extras, km_declarat, numar_bon, vehicle_id, trip_sheet_id, fuel_entry_id, stare_potrivire, motiv, nota",
      ),
  )
    .order("efectuat_la", { ascending: false })
    .order("id", { ascending: false })
    .limit(filtre.limita + 1);
  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) interogare = interogare.or(predicatKeyset("efectuat_la", c, "desc"));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare,
    filtreaza(db.from("fuel_card_transactions").select("id", { count: "exact", head: true })),
  ]);
  if (rezultat.error !== null) throw rezultat.error;
  if (numarare.error !== null) throw numarare.error;

  const toate = rezultat.data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: ultim.efectuat_la, id: ultim.id })
        : null,
    total: numarare.count ?? randuri.length,
  };
}
export type RandTranzactie = Awaited<ReturnType<typeof listeazaTranzactii>>["randuri"][number];

export type SumarStare = Readonly<{
  numar: number;
  valoareRon: number;
  alteMonede: number;
}>;

/**
 * Raportul de nepotriviri al lunii: numărul și valoarea pe fiecare stare.
 * Valoarea se adună doar în RON (fără conversie valutară, F12b „Ce NU se face”);
 * tranzacțiile în altă monedă se numără separat.
 */
export async function sumarLuna(
  organizationId: string,
  luna: string,
): Promise<ReadonlyMap<StarePotrivire, SumarStare>> {
  const db = await createServerSupabase();
  const { deLa, panaLa } = intervalLuna(luna);
  const { data, error, count } = await db
    .from("fuel_card_transactions")
    .select("stare_potrivire, valoare_bruta, moneda", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("data_ro", deLa)
    .lte("data_ro", panaLa)
    .limit(PLAFON_CITIRE);
  if (error !== null) throw error;
  verificaPlafon(count, "tranzacții în lună");
  const sumar = new Map<
    StarePotrivire,
    { numar: number; valoareRon: number; alteMonede: number }
  >();
  for (const r of data ?? []) {
    const s = sumar.get(r.stare_potrivire) ?? {
      numar: 0,
      valoareRon: 0,
      alteMonede: 0,
    };
    s.numar += 1;
    if (r.moneda === "RON") s.valoareRon += Number(r.valoare_bruta);
    else s.alteMonede += 1;
    sumar.set(r.stare_potrivire, s);
  }
  return sumar;
}

/**
 * Tranzacțiile lunii care se pot repotrivi: toate, mai puțin cele ignorate.
 * Acțiunea decide singură pe care le atinge (legăturile manuale rămân).
 */
export async function tranzactiiDeRepotrivit(organizationId: string, luna: string) {
  const db = await createServerSupabase();
  const { deLa, panaLa } = intervalLuna(luna);
  const { data, error, count } = await db
    .from("fuel_card_transactions")
    .select(
      "id, emitent, card_id, card_ultimele_cifre, nr_inmatriculare_extras, efectuat_la, data_ro, are_ora, categorie, tip_combustibil, cantitate, valoare_bruta, moneda, km_declarat, numar_bon, vehicle_id, trip_sheet_id, fuel_entry_id, stare_potrivire, motiv",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("stare_potrivire", "ignorata")
    .gte("data_ro", deLa)
    .lte("data_ro", panaLa)
    .order("efectuat_la")
    .order("id")
    .limit(PLAFON_CITIRE);
  if (error !== null) throw error;
  verificaPlafon(count, "tranzacții în lună");
  return data ?? [];
}

/** Câteva câmpuri ale unei tranzacții, pentru legarea manuală și reactivare. */
export async function citesteTranzactie(organizationId: string, id: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_card_transactions")
    .select(
      "id, categorie, card_id, vehicle_id, trip_sheet_id, data_ro, stare_potrivire, fuel_entry_id",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

/** O alimentare cu foaia ei (vehicul, zi), pentru legarea manuală. */
export async function alimentareCuFoaie(organizationId: string, id: string) {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fuel_entries")
    .select("id, trip_sheet_id, foaie:trip_sheets!trip_sheet_id(id, vehicle_id, data)")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data;
}

export type CandidatAlimentare = Readonly<{
  id: string;
  tripSheetId: string;
  litri: number;
  cost: number;
  alimentatLa: string;
  numarBon: string | null;
}>;

/**
 * Alimentările nelegate de pe foile acelorași vehicule, din aceleași zile, ca
 * rândurile arătate: opțiunile casetei „Leagă”. Cheia e `vehicul|zi`. Pagina
 * arată cel mult 100 de rânduri, deci perechile sunt puține; citirile merg
 * totuși pe bucăți și numără, nu taie.
 */
export async function alimentariCandidate(
  organizationId: string,
  perechi: readonly Readonly<{ vehicleId: string; dataRo: string }>[],
): Promise<ReadonlyMap<string, readonly CandidatAlimentare[]>> {
  const rezultat = new Map<string, CandidatAlimentare[]>();
  if (perechi.length === 0) return rezultat;
  const db = await createServerSupabase();
  const dorite = new Set(perechi.map((p) => `${p.vehicleId}|${p.dataRo}`));
  const zile = [...new Set(perechi.map((p) => p.dataRo))];

  const cheiFoaie = new Map<string, string>();
  for (const bucata of bucati([...new Set(perechi.map((p) => p.vehicleId))])) {
    const foi = await db
      .from("trip_sheets")
      .select("id, vehicle_id, data", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("status", "respins")
      .in("vehicle_id", bucata)
      .in("data", zile)
      .limit(PLAFON_CITIRE);
    if (foi.error !== null) throw foi.error;
    verificaPlafon(foi.count, "foi de parcurs");
    for (const f of foi.data ?? []) {
      const cheie = `${f.vehicle_id}|${f.data ?? ""}`;
      if (dorite.has(cheie)) cheiFoaie.set(f.id, cheie);
    }
  }
  if (cheiFoaie.size === 0) return rezultat;

  const alimentari: {
    id: string;
    trip_sheet_id: string;
    litri: number;
    cost: number;
    alimentat_la: string;
    numar_bon: string | null;
  }[] = [];
  for (const bucata of bucati([...cheiFoaie.keys()])) {
    const r = await db
      .from("fuel_entries")
      .select("id, trip_sheet_id, litri, cost, alimentat_la, numar_bon", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("trip_sheet_id", bucata)
      .order("alimentat_la")
      .limit(PLAFON_CITIRE);
    if (r.error !== null) throw r.error;
    verificaPlafon(r.count, "alimentări");
    alimentari.push(...(r.data ?? []));
  }

  const legate = new Set<string>();
  for (const bucata of bucati(alimentari.map((a) => a.id))) {
    const l = await db
      .from("fuel_card_transactions")
      .select("fuel_entry_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("fuel_entry_id", bucata)
      .limit(PLAFON_CITIRE);
    if (l.error !== null) throw l.error;
    for (const r of l.data ?? []) if (r.fuel_entry_id !== null) legate.add(r.fuel_entry_id);
  }

  for (const a of alimentari) {
    if (legate.has(a.id)) continue;
    const cheie = cheiFoaie.get(a.trip_sheet_id);
    if (cheie === undefined) continue;
    const lista = rezultat.get(cheie) ?? [];
    lista.push({
      id: a.id,
      tripSheetId: a.trip_sheet_id,
      litri: Number(a.litri),
      cost: Number(a.cost),
      alimentatLa: a.alimentat_la,
      numarBon: a.numar_bon,
    });
    rezultat.set(cheie, lista);
  }
  return rezultat;
}

/** Tranzacțiile lunii care NU sunt potrivite, pentru raportul descărcabil. */
export async function nepotrivirileLunii(organizationId: string, luna: string) {
  const db = await createServerSupabase();
  const { deLa, panaLa } = intervalLuna(luna);
  const { data, error, count } = await db
    .from("fuel_card_transactions")
    .select(
      "id, emitent, card_ultimele_cifre, efectuat_la, are_ora, produs, categorie, cantitate, valoare_bruta, moneda, statie, localitate, nr_inmatriculare_extras, km_declarat, numar_bon, vehicle_id, trip_sheet_id, stare_potrivire, motiv, nota",
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .neq("stare_potrivire", "potrivita")
    .gte("data_ro", deLa)
    .lte("data_ro", panaLa)
    .order("efectuat_la")
    .order("id")
    .limit(PLAFON_CITIRE);
  if (error !== null) throw error;
  verificaPlafon(count, "nepotriviri în lună");
  return data ?? [];
}
