// src/lib/queries/kpi.ts

/**
 * Citirile KPI-ului lunar.
 *
 * ── SCORUL SE CITEȘTE, NU SE RECALCULEAZĂ ─────────────────────────────────
 * `kpi_evaluari_lunare.scor_procent` e scris la fiecare salvare, din aceeași
 * funcție pură pe care o folosește și formularul. Seria din portal — douăsprezece
 * luni pe ecran — atinge deci o singură coloană, fără să citească nicio linie.
 * Excepția e luna DESCHISĂ, unde liniile se citesc oricum ca să fie afișate,
 * iar scorul se recalculează local ca ecranul să nu arate o cifră mai veche
 * decât rândurile de sub ea.
 *
 * ── DE CE `.returns<T[]>()` PESTE TOT ─────────────────────────────────────
 * Embed-urile PostgREST vin tipate ca `unknown` prin clientul generat, iar un
 * `select` cu două niveluri de embed pierde complet forma. Tipul se declară o
 * dată, lângă interogare, și se verifică prin `readonly` la consumatori.
 */

import "server-only";

import {
  calculeazaScorLunar,
  procentLinie,
  type LinieKpi,
  type ScorLunar,
  type SensKpi,
  type TipIndicatorKpi,
} from "@/domain/evaluations/kpi";
import { createServerSupabase } from "@/lib/supabase/server";
import type { StatusEvaluare } from "@/schemas/evaluation";

import {
  codificaCursor as codificaKeyset,
  decodificaCursor as decodificaKeyset,
  predicatKeyset,
  sortareCeruta,
  type Directie,
} from "./cursor";

export const SORTARI_KPI = ["perioada", "angajat", "scor", "status"] as const;
export type SortareKpi = (typeof SORTARI_KPI)[number];

const COLOANA_SORTARE: Readonly<Record<SortareKpi, string>> = {
  perioada: "perioada",
  angajat: "employee_id",
  scor: "scor_procent",
  status: "status",
};

const SORTARE_IMPLICITA: Readonly<{ cheie: SortareKpi; directie: Directie }> = {
  cheie: "perioada",
  directie: "desc",
};

const EMBED_ANGAJAT = "employee:employees!inner(full_name, marca)";

/**
 * Aceeași normalizare ca a coloanei generate `kpi_seturi.functie_norm`.
 *
 * Trebuie să rămână identică cu `lower(btrim(...))` din 0119: dacă cele două
 * diverg, potrivirea eșuează TĂCUT — angajatul pur și simplu n-are set, fără
 * nicio eroare nicăieri.
 */
export function normalizeazaFunctie(functie: string | null): string | null {
  if (functie === null) return null;
  const curata = functie.trim().toLowerCase();
  return curata === "" ? null : curata;
}

// ── Seturi de indicatori ──────────────────────────────────────────────────────

export interface IndicatorKpi {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly tip: TipIndicatorKpi;
  readonly unitate: string | null;
  readonly sens: SensKpi | null;
  readonly tinta_implicita: number | null;
  readonly scala_max: number | null;
  readonly pondere: number;
  readonly ordine: number;
}

export interface SetKpi {
  readonly id: string;
  /** Denumirea funcției, exact cum a scris-o managerul. */
  readonly functie: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly activ: boolean;
  readonly indicatori: readonly IndicatorKpi[];
}

interface RandSetBrut {
  readonly id: string;
  readonly functie: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly activ: boolean;
  readonly indicatori: readonly IndicatorKpi[] | null;
}

const SELECT_SET = `id, functie, denumire, descriere, activ,
   indicatori:kpi_indicatori(id, cod, denumire, descriere, tip, unitate, sens,
     tinta_implicita, scala_max, pondere, ordine)`;

/**
 * Indicatorii vin din embed, deci NEORDONAȚI: PostgREST nu garantează ordinea
 * unui embed fără `order` explicit, iar `ordine` există tocmai ca formularul să
 * arate liniile în șirul pus de manager. Sortarea se face aici, o dată.
 */
const ordoneazaIndicatori = (indicatori: readonly IndicatorKpi[] | null): readonly IndicatorKpi[] =>
  [...(indicatori ?? [])].sort(
    (a, b) => a.ordine - b.ordine || a.denumire.localeCompare(b.denumire, "ro"),
  );

const laSet = (b: RandSetBrut): SetKpi => ({
  id: b.id,
  functie: b.functie,
  denumire: b.denumire,
  descriere: b.descriere,
  activ: b.activ,
  indicatori: ordoneazaIndicatori(b.indicatori),
});

export async function listeazaSeturiKpi(organizationId: string): Promise<readonly SetKpi[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("kpi_seturi")
    .select(SELECT_SET)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .is("indicatori.deleted_at", null)
    .order("denumire", { ascending: true })
    .limit(200)
    .returns<RandSetBrut[]>();
  if (error !== null) throw error;
  return (data ?? []).map(laSet);
}

export async function citesteSetKpi(organizationId: string, setId: string): Promise<SetKpi | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("kpi_seturi")
    .select(SELECT_SET)
    .eq("organization_id", organizationId)
    .eq("id", setId)
    .is("deleted_at", null)
    .is("indicatori.deleted_at", null)
    .maybeSingle<RandSetBrut>();
  if (error !== null) throw error;
  return data === null ? null : laSet(data);
}

/**
 * Setul care se aplică unui angajat, plus abaterile lui de țintă.
 *
 * ── DE CE ÎNTOARCE UN MOTIV, NU DOAR `null` ───────────────────────────────
 * Sunt trei feluri de „n-are KPI", și ecranul trebuie să le spună diferit:
 * angajatul n-are funcție atribuită, funcția n-are set, sau setul e arhivat.
 * Un `null` unic ar fi produs aceeași listă goală în toate trei — capcana
 * tăcută pe care documentația proiectului o numără prima.
 */
export type MotivFaraSetKpi = "fara_functie" | "fara_set";

export interface SetAplicabil {
  readonly set: SetKpi | null;
  readonly motiv: MotivFaraSetKpi | null;
  /** `indicator_id` → ținta pusă anume pentru angajatul ăsta. */
  readonly abateri: ReadonlyMap<string, number>;
}

export async function setPentruAngajat(
  organizationId: string,
  employeeId: string,
): Promise<SetAplicabil> {
  const db = await createServerSupabase();

  const { data: angajat, error: eroareAngajat } = await db
    .from("employees")
    .select("functie")
    .eq("organization_id", organizationId)
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle<{ functie: string | null }>();
  if (eroareAngajat !== null) throw eroareAngajat;

  // Normalizată la fel ca `kpi_seturi.functie_norm`, ca potrivirea să fie o
  // egalitate obișnuită și nu un `ilike` în care un `%` din denumire ar fi jocher.
  const functie = normalizeazaFunctie(angajat?.functie ?? null);
  if (functie === null) return { set: null, motiv: "fara_functie", abateri: new Map() };

  const { data, error } = await db
    .from("kpi_seturi")
    .select(SELECT_SET)
    .eq("organization_id", organizationId)
    .eq("functie_norm", functie)
    .eq("activ", true)
    .is("deleted_at", null)
    .is("indicatori.deleted_at", null)
    .maybeSingle<RandSetBrut>();
  if (error !== null) throw error;
  if (data === null) return { set: null, motiv: "fara_set", abateri: new Map() };

  const set = laSet(data);

  const { data: tinte, error: eroareTinte } = await db
    .from("kpi_tinte_angajat")
    .select("indicator_id, tinta")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .returns<{ indicator_id: string; tinta: number }[]>();
  if (eroareTinte !== null) throw eroareTinte;

  return {
    set,
    motiv: null,
    abateri: new Map((tinte ?? []).map((t) => [t.indicator_id, t.tinta])),
  };
}

// ── Luna ──────────────────────────────────────────────────────────────────────

export interface ValoareKpi extends LinieKpi {
  readonly id: string;
  readonly denumire: string;
  readonly unitate: string | null;
  readonly comentariu: string | null;
  readonly ordine: number;
  /** Recalculat la citire, ca ecranul să nu arate o cifră mai veche decât rândul. */
  readonly procent: number | null;
}

interface RandValoareBrut {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly tip: TipIndicatorKpi;
  readonly unitate: string | null;
  readonly sens: SensKpi | null;
  readonly pondere: number;
  readonly scala_max: number | null;
  readonly tinta: number | null;
  readonly realizat: number | null;
  readonly nota: number | null;
  readonly comentariu: string | null;
  readonly ordine: number;
}

const laValoare = (b: RandValoareBrut): ValoareKpi => ({
  id: b.id,
  cod: b.cod,
  denumire: b.denumire,
  tip: b.tip,
  unitate: b.unitate,
  sens: b.sens,
  pondere: b.pondere,
  scala_max: b.scala_max,
  tinta: b.tinta,
  realizat: b.realizat,
  nota: b.nota,
  comentariu: b.comentariu,
  ordine: b.ordine,
  procent: procentLinie(b),
});

export interface LunaKpi {
  readonly id: string;
  readonly employee_id: string;
  readonly angajat: string | null;
  readonly marca: string | null;
  readonly an: number;
  readonly luna: number;
  readonly status: StatusEvaluare;
  readonly concluzie: string | null;
  readonly finalizat_la: string | null;
  readonly valori: readonly ValoareKpi[];
  readonly scor: ScorLunar;
}

interface RandLunaBrut {
  readonly id: string;
  readonly employee_id: string;
  readonly an: number;
  readonly luna: number;
  readonly status: StatusEvaluare;
  readonly concluzie: string | null;
  readonly finalizat_la: string | null;
  readonly employee: { readonly full_name: string | null; readonly marca: string | null } | null;
  readonly valori: readonly RandValoareBrut[] | null;
}

const SELECT_LUNA = `id, employee_id, an, luna, status, concluzie, finalizat_la, ${EMBED_ANGAJAT},
   valori:kpi_valori(id, cod, denumire, tip, unitate, sens, pondere, scala_max,
     tinta, realizat, nota, comentariu, ordine)`;

const laLuna = (b: RandLunaBrut): LunaKpi => {
  const valori = [...(b.valori ?? [])]
    .sort((x, y) => x.ordine - y.ordine || x.denumire.localeCompare(y.denumire, "ro"))
    .map(laValoare);
  return {
    id: b.id,
    employee_id: b.employee_id,
    angajat: b.employee?.full_name ?? null,
    marca: b.employee?.marca ?? null,
    an: b.an,
    luna: b.luna,
    status: b.status,
    concluzie: b.concluzie,
    finalizat_la: b.finalizat_la,
    valori,
    scor: calculeazaScorLunar(valori),
  };
};

export async function citesteLunaKpi(organizationId: string, id: string): Promise<LunaKpi | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("kpi_evaluari_lunare")
    .select(SELECT_LUNA)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .is("valori.deleted_at", null)
    .maybeSingle<RandLunaBrut>();
  if (error !== null) throw error;
  return data === null ? null : laLuna(data);
}

// ── Lista echipei ─────────────────────────────────────────────────────────────

export interface FiltreKpi {
  readonly an: number | null;
  readonly luna: number | null;
  readonly status: StatusEvaluare | null;
  readonly employee_id: string | null;
  readonly sort: string | null;
  readonly cursor: string | null;
  readonly limita: number;
}

export interface RandKpi {
  readonly id: string;
  readonly employee_id: string;
  readonly angajat: string | null;
  readonly marca: string | null;
  readonly an: number;
  readonly luna: number;
  readonly status: StatusEvaluare;
  readonly scor_procent: number | null;
  readonly nrLinii: number;
  readonly completate: number;
}

export interface RezultatKpi {
  readonly randuri: readonly RandKpi[];
  readonly urmatorulCursor: string | null;
  readonly total: number;
  readonly sortare: Readonly<{ cheie: SortareKpi; directie: Directie }>;
}

interface RandListaBrut {
  readonly id: string;
  readonly employee_id: string;
  readonly an: number;
  readonly luna: number;
  readonly perioada: string;
  readonly status: StatusEvaluare;
  readonly scor_procent: number | null;
  readonly employee: { readonly full_name: string | null; readonly marca: string | null } | null;
  readonly valori:
    | readonly Pick<
        RandValoareBrut,
        "cod" | "tip" | "sens" | "pondere" | "scala_max" | "tinta" | "realizat" | "nota"
      >[]
    | null;
}

export async function listeazaLuniKpi(
  organizationId: string,
  filtre: FiltreKpi,
): Promise<RezultatKpi> {
  const db = await createServerSupabase();
  const sortare = sortareCeruta(filtre.sort, SORTARI_KPI, SORTARE_IMPLICITA);
  const coloana = COLOANA_SORTARE[sortare.cheie];
  const crescator = sortare.directie === "asc";

  // Numărătoarea NU stă pe interogarea paginată: predicatul keyset e un filtru,
  // deci totalul ar scădea la fiecare „mai departe". Vezi `listeazaEvaluari`.
  const filtreaza = <
    Q extends {
      eq: (c: string, v: string | number) => Q;
      is: (c: string, v: null) => Q;
    },
  >(
    q: Q,
  ): Q => {
    let cu = q.eq("organization_id", organizationId).is("deleted_at", null);
    if (filtre.an !== null) cu = cu.eq("an", filtre.an);
    if (filtre.luna !== null) cu = cu.eq("luna", filtre.luna);
    if (filtre.status !== null) cu = cu.eq("status", filtre.status);
    if (filtre.employee_id !== null) cu = cu.eq("employee_id", filtre.employee_id);
    return cu;
  };

  let interogare = filtreaza(
    db.from("kpi_evaluari_lunare").select(
      `id, employee_id, an, luna, perioada, status, scor_procent, ${EMBED_ANGAJAT},
       valori:kpi_valori(cod, tip, sens, pondere, scala_max, tinta, realizat, nota)`,
    ),
  )
    .order(coloana, { ascending: crescator, nullsFirst: false })
    .order("id", { ascending: crescator })
    .limit(filtre.limita + 1);

  const cursor = filtre.cursor === null ? null : decodificaKeyset(filtre.cursor);
  if (cursor !== null) {
    interogare = interogare.or(predicatKeyset(coloana, cursor, sortare.directie));
  }

  const [rezultat, numarare] = await Promise.all([
    interogare.returns<RandListaBrut[]>(),
    filtreaza(db.from("kpi_evaluari_lunare").select("id", { count: "exact", head: true })),
  ]);
  if (rezultat.error !== null) throw rezultat.error;
  if (numarare.error !== null) throw numarare.error;

  const toate = rezultat.data ?? [];
  const areUrmatoarea = toate.length > filtre.limita;
  const brute = areUrmatoarea ? toate.slice(0, filtre.limita) : toate;

  const randuri: readonly RandKpi[] = brute.map((b) => {
    const linii = b.valori ?? [];
    const scor = calculeazaScorLunar(linii);
    return {
      id: b.id,
      employee_id: b.employee_id,
      angajat: b.employee?.full_name ?? null,
      marca: b.employee?.marca ?? null,
      an: b.an,
      luna: b.luna,
      status: b.status,
      // Coloana stocată e sursa; scorul recalculat acoperă doar rândurile
      // scrise înainte ca o linie să fie adăugată setului.
      scor_procent: b.scor_procent ?? scor.procent,
      nrLinii: linii.length,
      completate: scor.completate,
    };
  });

  const ultimul = brute.at(-1);
  const valoareCursor =
    ultimul === undefined
      ? null
      : sortare.cheie === "perioada"
        ? ultimul.perioada
        : sortare.cheie === "angajat"
          ? ultimul.employee_id
          : sortare.cheie === "scor"
            ? (ultimul.scor_procent?.toString() ?? null)
            : ultimul.status;

  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultimul !== undefined && valoareCursor !== null
        ? codificaKeyset({ valoare: valoareCursor, id: ultimul.id })
        : null,
    total: numarare.count ?? randuri.length,
    sortare,
  };
}

// ── Portalul angajatului ──────────────────────────────────────────────────────

export interface PunctSerie {
  readonly id: string;
  readonly an: number;
  readonly luna: number;
  readonly status: StatusEvaluare;
  readonly scor_procent: number | null;
}

export interface KpiAngajat {
  /** Luna cerută, dacă a fost deschisă de manager. */
  readonly luna: LunaKpi | null;
  /** Lunile anterioare, cea mai recentă prima. Doar coloana de scor. */
  readonly serie: readonly PunctSerie[];
  /** Ce se așteaptă de la angajat, când luna nu e încă deschisă. */
  readonly aplicabil: SetAplicabil;
}

/**
 * Ce vede angajatul în portal.
 *
 * ── DE CE SE CITEȘTE ȘI SETUL, NU DOAR LUNA ───────────────────────────────
 * Cerința e ca țintele să fie vizibile de la ÎNCEPUTUL lunii. Dar rândul lunii
 * apare abia când managerul o deschide, iar asta se poate întâmpla pe 20. Fără
 * set, portalul ar fi arătat o pagină goală trei săptămâni pe lună, exact
 * pentru omul căruia i s-a promis că-și vede KPI-ul constant.
 */
export async function kpiAngajat(
  organizationId: string,
  employeeId: string,
  an: number,
  luna: number,
  luniInSerie = 12,
): Promise<KpiAngajat> {
  const db = await createServerSupabase();

  const [lunaCurenta, serie, aplicabil] = await Promise.all([
    db
      .from("kpi_evaluari_lunare")
      .select(SELECT_LUNA)
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("an", an)
      .eq("luna", luna)
      .is("deleted_at", null)
      .is("valori.deleted_at", null)
      .maybeSingle<RandLunaBrut>(),
    db
      .from("kpi_evaluari_lunare")
      .select("id, an, luna, status, scor_procent")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .is("deleted_at", null)
      .order("perioada", { ascending: false })
      .limit(luniInSerie)
      .returns<PunctSerie[]>(),
    setPentruAngajat(organizationId, employeeId),
  ]);

  if (lunaCurenta.error !== null) throw lunaCurenta.error;
  if (serie.error !== null) throw serie.error;

  return {
    luna: lunaCurenta.data === null ? null : laLuna(lunaCurenta.data),
    serie: serie.data ?? [],
    aplicabil,
  };
}

// ── Cine poate primi o lună ───────────────────────────────────────────────────

export interface OptiuneAngajatKpi {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly functie: string | null;
}

/**
 * Angajații pentru care se poate DESCHIDE o lună.
 *
 * ── DE CE SE FILTREAZĂ PE MANAGERUL DIRECT, NU PE SUBARBORE ───────────────
 * Politica de scriere din 0119 cere `app.este_manager_direct`. Politica de
 * CITIRE a fișelor lasă însă tot subarborele, deci o listă nefiltrată i-ar fi
 * arătat directorului toți oamenii din structură — și l-ar fi lăsat să aleagă
 * pe cineva pentru care baza apoi refuză scrierea, cu un mesaj care sună a
 * defect. Ecranul nu oferă ce baza va refuza; e regula din
 * `angajatiPentruPontaj`.
 *
 * `propriaFisa === null` înseamnă scope `all` (hr / org_admin): acolo lista e
 * întreagă, fiindcă și `can_access_kpi` întoarce `true` peste tot.
 */
export async function angajatiPentruKpi(
  organizationId: string,
  propriaFisa: string | null,
): Promise<readonly OptiuneAngajatKpi[]> {
  const db = await createServerSupabase();
  let interogare = db
    .from("employees")
    .select("id, full_name, marca, functie")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["activ", "suspendat", "preaviz"]);
  if (propriaFisa !== null) interogare = interogare.eq("manager_employee_id", propriaFisa);

  const { data, error } = await interogare
    .order("full_name", { ascending: true })
    .limit(500)
    .returns<OptiuneAngajatKpi[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/**
 * Ținta pe care o vede angajatul înainte ca luna să fie deschisă.
 *
 * Aceeași regulă ca `tintaEfectiva` din domeniu — abaterea proprie bate
 * implicita funcției — dar aplicată pe un indicator încă neînghețat. Există ca
 * portalul să nu repete `abateri.get(...) ?? tinta_implicita` în JSX, unde un
 * `||` scris din reflex ar fi înlocuit tăcut o țintă de zero.
 */
export function tintaEfectivaAfisata(
  indicator: IndicatorKpi,
  abateri: ReadonlyMap<string, number>,
): number | null {
  if (indicator.tip !== "masurat") return null;
  const abatere = abateri.get(indicator.id);
  return abatere ?? indicator.tinta_implicita;
}
