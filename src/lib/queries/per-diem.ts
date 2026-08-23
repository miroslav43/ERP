// src/lib/queries/per-diem.ts
// Citirile modulului de diurnă. Ca la flotă și concedii, NU se adaugă niciun
// filtru de scope (own/team/all): politicile din 0015 (app.poate_accesa_deplasare)
// restrâng rândurile direct în Postgres.
//
// Motorul de calcul (app.calculeaza_zile_diurna / app.recalculeaza_diurna)
// trăiește în schema `app`, neexpusă prin PostgREST — de aceea acest fișier
// oferă și adaptoarele care leagă rândurile citite de aici cu motorul PUR din
// `@/domain/per-diem`, portat 1:1 din 0015_per_diem.sql.

import { calculeazaZileDiurna, type FereastraDiurna } from "@/domain/per-diem/ferestre";
import type { PunctTara } from "@/domain/per-diem/ore-pe-tara";
import {
  calculeazaSume,
  type BaremTara,
  type PoliticaDiurna,
  type RezultatDiurna,
} from "@/domain/per-diem/sume";
import {
  SORTARI_DEPLASARI,
  type FiltreDeplasari,
  type MijlocTransport,
  type RegulaTrecereFrontiera,
  type SortareDeplasari,
  type StatusDeplasare,
  type TipCheltuiala,
} from "@/schemas/per-diem";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  codificaCursor,
  decodificaCursor,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

// ── Forme de rând ─────────────────────────────────────────────────────────

export interface Tara {
  readonly id: string;
  readonly cod_alpha2: string;
  readonly denumire: string;
  readonly moneda: string;
  readonly este_ue: boolean;
}

export interface PoliticaRand {
  readonly id: string;
  readonly denumire: string;
  readonly country_id_intern: string;
  readonly moneda_interna: string;
  readonly diurna_interna_zi: number;
  readonly diurna_baza_legala_interna: number;
  readonly multiplu_plafon_neimpozabil: number;
  readonly multiplu_diurna_externa: number;
  readonly categorie_barem: string;
  readonly prag_ore_minim: number;
  readonly prag_ore_zi_intreaga: number;
  readonly fractiune_zi_partiala: number;
  readonly acorda_diurna_ziua_trecerii: boolean;
  readonly regula_tara_trecere: RegulaTrecereFrontiera;
  readonly tarif_km_auto_personal: number;
  readonly moneda_tarif_km: string;
  readonly plafon_salarii_baza_luna: number;
  readonly valabil_de_la: string;
  readonly valabil_pana: string | null;
}

export interface RandDeplasare {
  readonly id: string;
  readonly employee_id: string;
  readonly numar_document: string | null;
  readonly scop: string;
  readonly country_id: string | null;
  readonly localitate: string | null;
  readonly plecare_la: string;
  readonly sosire_la: string;
  readonly plecare_efectiva_la: string | null;
  readonly sosire_efectiva_la: string | null;
  readonly mijloc_transport: MijlocTransport;
  readonly vehicle_id: string | null;
  readonly km_parcursi: number | null;
  readonly avans_acordat: number;
  readonly moneda_avans: string | null;
  readonly curs_diurna: number | null;
  readonly status: StatusDeplasare;
  readonly detasare_transnationala: boolean;
}

export interface Deplasare extends RandDeplasare {
  readonly observatii: string | null;
  readonly stat_gazda_country_id: string | null;
  readonly salariu_minim_stat_gazda: number | null;
  readonly moneda_salariu_minim: string | null;
  readonly created_at: string;
}

export interface RezultatDeplasari {
  readonly randuri: readonly RandDeplasare[];
  readonly urmatorulCursor: string | null;
  /**
   * Câte deplasări sunt în total, după filtre. „Pagina următoare" fără un total
   * e o ușă fără indicație — nu știi dacă mai urmează un ecran sau o sută.
   */
  readonly total: number;
  /** Sortarea EFECTIV aplicată, după îngustarea la coloanele permise. */
  readonly sortare: Readonly<{ cheie: SortareDeplasari; directie: Directie }>;
}

export interface CalculSalvat {
  readonly business_trip_id: string;
  readonly policy_id: string;
  readonly calculat_la: string;
  readonly zile_total: number;
  readonly valoare_lei: number | null;
  readonly plafon_neimpozabil_lei: number | null;
  readonly parte_neimpozabila_lei: number | null;
  readonly parte_impozabila_lei: number | null;
  readonly curs_incomplet: boolean;
}

export interface EtapaDeplasare {
  readonly id: string;
  readonly ordine: number;
  readonly from_country_id: string;
  readonly to_country_id: string;
  readonly plecare_la: string;
  readonly sosire_la: string;
  readonly mijloc_transport: MijlocTransport | null;
  readonly localitate_sosire: string | null;
  readonly observatii: string | null;
}

export interface CheltuialaDeplasare {
  readonly id: string;
  readonly tip: TipCheltuiala;
  readonly descriere: string | null;
  readonly data_cheltuielii: string;
  readonly suma: number;
  readonly moneda: string;
  readonly curs_valutar: number;
  readonly suma_lei: number;
  readonly document_tip: string | null;
  readonly document_numar: string | null;
  readonly document_cale: string | null;
  readonly aprobata: boolean;
  readonly aprobata_la: string | null;
  readonly motiv_respingere: string | null;
}

export interface AngajatRezumat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

const COLOANE_POLITICA =
  "id, denumire, country_id_intern, moneda_interna, diurna_interna_zi, " +
  "diurna_baza_legala_interna, multiplu_plafon_neimpozabil, multiplu_diurna_externa, " +
  "categorie_barem, prag_ore_minim, prag_ore_zi_intreaga, fractiune_zi_partiala, " +
  "acorda_diurna_ziua_trecerii, regula_tara_trecere, tarif_km_auto_personal, " +
  "moneda_tarif_km, plafon_salarii_baza_luna, valabil_de_la, valabil_pana";

const COLOANE_DEPLASARE =
  "id, employee_id, numar_document, scop, country_id, localitate, plecare_la, " +
  "sosire_la, plecare_efectiva_la, sosire_efectiva_la, mijloc_transport, vehicle_id, " +
  "km_parcursi, avans_acordat, moneda_avans, curs_diurna, status, detasare_transnationala";

/**
 * Deplasările unui angajat anume, cu filtru EXPLICIT pe fișă.
 *
 * `listeazaDeplasari` se sprijină pe RLS pentru îngustare, iar
 * `app.poate_accesa_deplasare` (`0015_per_diem.sql:673-700`) trece tot pentru
 * `per_diem:read = all`. Sub eticheta „deplasările mele" asta ar însemna toate
 * deplasările firmei. Vezi avertismentul din capul lui `queries/portal.ts`.
 *
 * Fără cursor: cincizeci de deplasări acoperă mai mult de un an pentru un
 * angajat obișnuit, iar paginarea pe telefon nu-și merită complexitatea. Limita
 * e explicită și cu mult sub `max_rows`, deci nu poate fi trunchiată tăcut.
 */
export async function deplasarileMele(
  organizationId: string,
  employeeId: string,
  limita = 50,
): Promise<readonly RandDeplasare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("business_trips")
    .select(COLOANE_DEPLASARE)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("plecare_la", { ascending: false })
    .limit(limita)
    .returns<RandDeplasare[]>();

  if (error !== null) throw error;
  return data ?? [];
}

// ── Cursorul keyset ─────────────────────────────────────────────────────────
//
// Codificarea, ghilimelarea și predicatul trăiau AICI, într-o copie aproape
// identică cu cele din alte nouă fișiere de citiri. Au fost mutate în
// `./cursor.ts`, unde cursorul poartă o valoare OPACĂ în loc de un nume fix,
// deci aceeași funcție servește orice coloană de sortare.

/**
 * Cheia din URL → coloana din bază. Traducerea e OBLIGATORIU explicită: numele
 * coloanei intră într-un predicat construit ca text, deci nu are voie să vină
 * din afară. Cheile sunt românești fiindcă apar în adresa pe care omul o
 * copiază; coloanele rămân englezești, ca tot restul schemei.
 */
const COLOANA_SORTARE_DEPLASARE: Readonly<Record<SortareDeplasari, string>> = {
  plecare: "plecare_la",
  scop: "scop",
  stare: "status",
};

/** Cea mai recentă plecare prima — ordinea pe care o avea lista dinainte. */
const SORTARE_IMPLICITA_DEPLASARI = { cheie: "plecare", directie: "desc" } as const;

// ── Nomenclatoare globale ────────────────────────────────────────────────

/** `countries`, USING(true) — nomenclator global, nu multi-tenant. */
export async function tari(): Promise<readonly Tara[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("countries")
    .select("id, cod_alpha2, denumire, moneda, este_ue")
    .is("deleted_at", null)
    .order("denumire")
    .returns<Tara[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Baremul pe țări — toate rândurile istorice pentru un set de țări, oricare
 * categorie. Alegerea rândului valabil la o dată exactă se face în TS, cu
 * `baremLaData`, ca fiecare fereastră de 24h să-și poată folosi PROPRIA dată,
 * exact ca `app.per_diem_barem` apelat per fereastră în bază.
 */
interface RandBaremTara {
  readonly country_id: string;
  readonly categorie: string;
  readonly valoare: number;
  readonly moneda: string;
  readonly valabil_de_la: string;
  readonly valabil_pana: string | null;
}

export async function baremeleTarilor(idTari: readonly string[]): Promise<readonly BaremTara[]> {
  const unice = [...new Set(idTari)];
  if (unice.length === 0) return [];

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("per_diem_country_rates")
    .select("country_id, categorie, valoare, moneda, valabil_de_la, valabil_pana")
    .in("country_id", unice)
    .is("deleted_at", null)
    .returns<RandBaremTara[]>();
  if (error !== null) throw error;

  return (data ?? []).map((r) => ({
    countryId: r.country_id,
    categorie: r.categorie,
    valoare: r.valoare,
    moneda: r.moneda,
    valabilDeLa: r.valabil_de_la,
    valabilPana: r.valabil_pana,
  }));
}

/**
 * Baremul unei singure țări, la o dată exactă — folosit când e nevoie de un
 * singur punct de date (ex. previzualizarea din formularul de politică).
 * Politica de SELECT e USING(true) — vizibil tuturor autentificați.
 */
export async function baremTara(
  countryId: string,
  categorie: string,
  dataISO: string,
): Promise<Readonly<{ valoare: number; moneda: string }> | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("per_diem_country_rates")
    .select("valoare, moneda")
    .eq("country_id", countryId)
    .eq("categorie", categorie)
    .is("deleted_at", null)
    .lte("valabil_de_la", dataISO)
    .or(`valabil_pana.is.null,valabil_pana.gte.${dataISO}`)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle<{ valoare: number; moneda: string }>();
  if (error !== null) throw error;
  return data;
}

// ── Politica firmei ──────────────────────────────────────────────────────

/**
 * Politica valabilă la o dată — versionată. `dataISO` trebuie să fie
 * `plecare_la::date` a DEPLASĂRII, nu ziua de azi: o deplasare din martie se
 * calculează cu politica din martie. Nu memoiza „politica curentă”.
 */
export async function politicaLaData(
  organizationId: string,
  dataISO: string,
): Promise<PoliticaRand | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("per_diem_policies")
    .select(COLOANE_POLITICA)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .lte("valabil_de_la", dataISO)
    .or(`valabil_pana.is.null,valabil_pana.gte.${dataISO}`)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle<PoliticaRand>();
  if (error !== null) throw error;
  return data;
}

/** Toate versiunile politicii organizației, pentru ecranul de administrare. */
export async function politiciOrganizatie(
  organizationId: string,
): Promise<readonly PoliticaRand[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("per_diem_policies")
    .select(COLOANE_POLITICA)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .returns<PoliticaRand[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Deplasări ────────────────────────────────────────────────────────────

export async function listeazaDeplasari(
  organizationId: string,
  filtre: FiltreDeplasari,
): Promise<RezultatDeplasari> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(
    filtre.sort ?? null,
    SORTARI_DEPLASARI,
    SORTARE_IMPLICITA_DEPLASARI,
  );
  const coloana = COLOANA_SORTARE_DEPLASARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  let interogare = db
    .from("business_trips")
    .select(
      COLOANE_DEPLASARE,
      // `count: "exact"` pe aceeași interogare: numărătoarea respectă filtrele
      // ȘI politicile RLS, fără un al doilea drum la bază care le-ar putea
      // aplica altfel.
      { count: "exact" },
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    // Identificatorul e MEREU al doilea criteriu: nici scopul, nici data
    // plecării nu sunt unice, iar fără el ordinea dintre două rânduri egale e
    // nedefinită, deci paginarea poate sări sau repeta exact acolo.
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  if (filtre.status !== null) interogare = interogare.eq("status", filtre.status);

  // Un cursor stricat înseamnă prima pagină, nu o eroare.
  const cursor = filtre.cursor === null ? null : decodificaCursor(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const { data, error, count } = await interogare.returns<RandDeplasare[]>();
  if (error !== null) throw error;

  const toate = data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const randuri = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;
  const ultim = randuri.at(-1);
  const valoareCursor =
    ultim === undefined
      ? null
      : sortare.cheie === "scop"
        ? ultim.scop
        : sortare.cheie === "stare"
          ? ultim.status
          : ultim.plecare_la;

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

export async function citesteDeplasare(
  organizationId: string,
  id: string,
): Promise<Deplasare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("business_trips")
    .select(
      `${COLOANE_DEPLASARE}, observatii, stat_gazda_country_id, salariu_minim_stat_gazda, ` +
        "moneda_salariu_minim, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Deplasare>();
  if (error !== null) throw error;
  return data;
}

/**
 * Rezultatul salvat de `app.recalculeaza_diurna` — poate fi GOL pentru toate
 * rândurile, fiindcă acea funcție nu e apelabilă din client (schema `app` nu
 * e expusă prin PostgREST). Când lipsește, ecranele afișează suma calculată
 * în TS, marcată „estimare”.
 */
export async function calculeSalvate(
  idDeplasari: readonly string[],
): Promise<ReadonlyMap<string, CalculSalvat>> {
  const unice = [...new Set(idDeplasari)];
  if (unice.length === 0) return new Map();

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("per_diem_calculations")
    .select(
      "business_trip_id, policy_id, calculat_la, zile_total, valoare_lei, " +
        "plafon_neimpozabil_lei, parte_neimpozabila_lei, parte_impozabila_lei, curs_incomplet",
    )
    .in("business_trip_id", unice)
    .returns<CalculSalvat[]>();
  if (error !== null) throw error;
  return new Map((data ?? []).map((c) => [c.business_trip_id, c]));
}

export async function etapele(tripId: string): Promise<readonly EtapaDeplasare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("business_trip_legs")
    .select(
      "id, ordine, from_country_id, to_country_id, plecare_la, sosire_la, " +
        "mijloc_transport, localitate_sosire, observatii",
    )
    .eq("business_trip_id", tripId)
    .is("deleted_at", null)
    .order("ordine")
    .returns<EtapaDeplasare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export async function cheltuielile(tripId: string): Promise<readonly CheltuialaDeplasare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("trip_expenses")
    .select(
      "id, tip, descriere, data_cheltuielii, suma, moneda, curs_valutar, suma_lei, " +
        "document_tip, document_numar, document_cale, aprobata, aprobata_la, motiv_respingere",
    )
    .eq("business_trip_id", tripId)
    .is("deleted_at", null)
    .order("data_cheltuielii")
    .returns<CheltuialaDeplasare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Numele angajaților, citite separat — nu prin embed: un manager are
 * `per_diem:read = team` dar niciun drept pe `employees`, iar un embed
 * refuzat de RLS ar veni NULL fără nicio eroare.
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

// ── Adaptorul spre motorul PUR (@/domain/per-diem) ──────────────────────

/** Rândul minim din `business_trips` de care are nevoie motorul de calcul. */
export interface DeplasarePentruCalcul {
  readonly countryId: string | null;
  readonly plecareLa: string;
  readonly sosireLa: string;
  readonly plecareEfectivaLa: string | null;
  readonly sosireEfectivaLa: string | null;
  readonly cursDiurna: number | null;
}

/** Rândul minim dintr-o etapă de care are nevoie motorul de calcul. */
export interface EtapaPentruCalcul {
  readonly ordine: number;
  readonly fromCountryId: string;
  readonly toCountryId: string;
  readonly sosireLa: string;
}

function politicaDinRand(rand: PoliticaRand): PoliticaDiurna {
  return {
    countryIdIntern: rand.country_id_intern,
    monedaInterna: rand.moneda_interna,
    diurnaInternaZi: rand.diurna_interna_zi,
    diurnaBazaLegalaInterna: rand.diurna_baza_legala_interna,
    multiploPlafonNeimpozabil: rand.multiplu_plafon_neimpozabil,
    multiploDiurnaExterna: rand.multiplu_diurna_externa,
    categorieBarem: rand.categorie_barem,
  };
}

/**
 * Reconstituie cronologia „în ce țară e angajatul”, exact ca CTE-ul `puncte`
 * din `app.recalculeaza_diurna`: primul reper e țara primei etape (sau țara
 * proprie a deplasării, sau țara internă din politică), urmat de câte un
 * reper la sosirea fiecărei etape, în ordinea `ordine`.
 */
export function puncteDinDeplasare(
  trip: DeplasarePentruCalcul,
  etapeTrip: readonly EtapaPentruCalcul[],
  taraImplicitaId: string,
): readonly PunctTara[] {
  const ordonate = [...etapeTrip].sort((a, b) => a.ordine - b.ordine);
  const primaTara = ordonate[0]?.fromCountryId ?? trip.countryId ?? taraImplicitaId;

  return [
    { deLa: new Date(trip.plecareLa), countryId: primaTara },
    ...ordonate.map((e) => ({ deLa: new Date(e.sosireLa), countryId: e.toCountryId })),
  ];
}

/**
 * Pipeline complet: deplasare + etape + politică + barem ⇒ ferestre și sumă.
 * Folosit identic pe listă (fără etape reale — vezi nota din pagina listei),
 * pe fișa deplasării și pe decont.
 */
export function calculeazaDiurnaDeplasare(
  trip: DeplasarePentruCalcul,
  etapeTrip: readonly EtapaPentruCalcul[],
  politicaRand: PoliticaRand,
  baremuri: readonly BaremTara[],
): Readonly<{ ferestre: readonly FereastraDiurna[]; rezultat: RezultatDiurna; durataOre: number }> {
  const politica = politicaDinRand(politicaRand);
  const taraImplicita = trip.countryId ?? politica.countryIdIntern;
  const puncte = puncteDinDeplasare(trip, etapeTrip, taraImplicita);

  const plecare = new Date(trip.plecareEfectivaLa ?? trip.plecareLa);
  const sosire = new Date(trip.sosireEfectivaLa ?? trip.sosireLa);
  const durataOre = Math.max(0, (sosire.getTime() - plecare.getTime()) / 3_600_000);

  const ferestre = calculeazaZileDiurna({
    plecare,
    sosire,
    pragOreMinim: politicaRand.prag_ore_minim,
    pragOreZiIntreaga: politicaRand.prag_ore_zi_intreaga,
    fractiuneZiPartiala: politicaRand.fractiune_zi_partiala,
    acordaZiuaTrecerii: politicaRand.acorda_diurna_ziua_trecerii,
    regulaTrecere: politicaRand.regula_tara_trecere,
    taraImplicitaId: taraImplicita,
    etape: puncte,
    cautaValoareBarem: (countryId, dataFereastra) => {
      const barem = baremuri.find(
        (b) =>
          b.countryId === countryId &&
          b.categorie === politicaRand.categorie_barem &&
          b.valabilDeLa <= dataFereastra &&
          (b.valabilPana === null || b.valabilPana >= dataFereastra),
      );
      return barem?.valoare ?? null;
    },
  });

  const rezultat = calculeazaSume(ferestre, politica, baremuri, trip.cursDiurna);
  return { ferestre, rezultat, durataOre };
}
