// src/lib/queries/fleet-rapoarte.ts
// Citirile rapoartelor flotei și ale pachetului lunar (F8). Ca în `fleet.ts`, NU
// se adaugă filtre de scope: vizibilitatea o dau politicile, iar poarta rapoartelor
// (`vehicles:read` și `trip_sheets:read` la `all`) stă în pagină și în rutele de
// export. Cine ar citi cu mai puțin ar primi agregate PARȚIALE, fără nicio eroare.
//
// ── DE CE LUNA E MEREU ÎN FILTRU ────────────────────────────────────────────
// Fiecare citire primește un interval închis de zile. `max_rows = 1000` taie
// TĂCUT un răspuns mai mare, iar o agregare nu-și vede niciodată cifra prea mică;
// de aceea toate citirile de calcul trec prin `citesteTot` (keyset pe `id`), care
// aruncă în loc să trunchieze.

import "server-only";

import {
  consumPeVehicul,
  costPeVehicul,
  intervalLuna,
  kmPeSofer,
  registruFoi,
  totaluriCost,
  totaluriLuna,
  type AlimentareRaport,
  type EtichetaSoferi,
  type EtichetaVehicule,
  type FoaieRaport,
  type IntervalLuna,
  type RandConsum,
  type RandCost,
  type RandRegistru,
  type RandSofer,
  type SurseCost,
  type TotalCost,
  type TotaluriLuna,
} from "@/domain/fleet/rapoarte";
import type { CursaFoaie } from "@/domain/fleet/foaie";
import { createServerSupabase } from "@/lib/supabase/server";

import { citesteTot } from "./citeste-tot";
import { angajatiDupaId, vehiculeDupaId } from "./fleet";

/**
 * Câte foi poate cuprinde un pachet lunar. Fiecare foaie e un PDF generat în
 * cererea HTTP; peste plafon ruta refuză cu un mesaj, nu se întrerupe la mijloc.
 */
export const PLAFON_FOI_PACHET = 400;

/** Câte foi aduce o pagină din citirea detaliată: curse și alimentări vin în același răspuns. */
const PAS_FOI_DETALIATE = 100;

/** Câte id-uri intră într-un `.in()`: adresa cererii nu crește fără limită. */
const FELIE_ID = 100;

// ── Foile aprobate ──────────────────────────────────────────────────────────

/** Exportate ca testul să le poată lipi de `database.ts`: poarta `coloane.test.ts` nu rezolvă `.select(CONSTANTA)`. */
export const COLOANE_FOAIE_RAPORT =
  "id, vehicle_id, employee_id, numar, data, km_parcursi, vehicul_nr, vehicul_combustibil, " +
  "norma_l_100km, alimentari:fuel_entries!trip_sheet_id(litri, cost)";

/**
 * Foile APROBATE ale lunii (ziua foii, `trip_sheets.data`), cu litrii și costul
 * alimentărilor lor vii. `vehicul` ales = doar foile lui.
 */
export async function foiAprobateLuna(
  organizationId: string,
  interval: IntervalLuna,
  vehicul: string | null,
): Promise<readonly FoaieRaport[]> {
  const db = await createServerSupabase();
  return citesteTot<FoaieRaport>(
    (dupa, pas) => {
      let q = db
        .from("trip_sheets")
        .select(COLOANE_FOAIE_RAPORT)
        .eq("organization_id", organizationId)
        .eq("status", "aprobat")
        .is("deleted_at", null)
        .is("alimentari.deleted_at", null)
        .gte("data", interval.deLa)
        .lte("data", interval.panaLa);
      if (vehicul !== null) q = q.eq("vehicle_id", vehicul);
      if (dupa !== null) q = q.gt("id", dupa);
      return q.order("id", { ascending: true }).limit(pas).returns<FoaieRaport[]>();
    },
    (r) => r.id,
    { nume: "foi aprobate" },
  );
}

/** Alimentarea cu ce trebuie tipărit pe foaie. */
export interface AlimentareDetaliata extends AlimentareRaport {
  readonly alimentat_la: string;
  readonly statie: string | null;
  readonly numar_bon: string | null;
  readonly plin: boolean;
}

/** Foaia aprobată cu tot ce cere PDF-ul ei: curse, alimentări, aprobarea. */
export interface FoaieDetaliata extends Omit<FoaieRaport, "alimentari"> {
  readonly alimentari: readonly AlimentareDetaliata[];
  readonly curse: readonly CursaFoaie[];
  readonly km_plecare: number | null;
  readonly km_sosire: number | null;
  readonly observatii: string | null;
  readonly trimis_la: string | null;
  readonly aprobat_de: string | null;
  readonly aprobat_la: string | null;
  readonly vehicul_categorie: string | null;
}

export const COLOANE_FOAIE_DETALIATA =
  "id, vehicle_id, employee_id, numar, data, km_plecare, km_sosire, km_parcursi, observatii, " +
  "trimis_la, aprobat_de, aprobat_la, vehicul_nr, vehicul_categorie, vehicul_combustibil, " +
  "norma_l_100km, " +
  "alimentari:fuel_entries!trip_sheet_id(alimentat_la, litri, cost, statie, numar_bon, plin), " +
  "curse:trip_sheet_curse!trip_sheet_id(id, ordine, plecare_la, sosire_la, de_la_loc, " +
  "pana_la_loc, scop, km_plecare, km_sosire, km_parcursi)";

/**
 * Foile aprobate ale lunii, ÎNTREGI: pachetul lunar generează câte un PDF din
 * fiecare. Curse și alimentări vin prin embed, nu prin `.in(ids)`: lista de
 * id-uri a unei luni întregi ar face din adresa cererii un text de zeci de kilobaiți.
 */
export async function foiAprobateDetaliate(
  organizationId: string,
  interval: IntervalLuna,
  vehicul: string | null,
): Promise<readonly FoaieDetaliata[]> {
  const db = await createServerSupabase();
  return citesteTot<FoaieDetaliata>(
    (dupa, pas) => {
      let q = db
        .from("trip_sheets")
        .select(COLOANE_FOAIE_DETALIATA)
        .eq("organization_id", organizationId)
        .eq("status", "aprobat")
        .is("deleted_at", null)
        .is("alimentari.deleted_at", null)
        .is("curse.deleted_at", null)
        .gte("data", interval.deLa)
        .lte("data", interval.panaLa);
      if (vehicul !== null) q = q.eq("vehicle_id", vehicul);
      if (dupa !== null) q = q.gt("id", dupa);
      return q.order("id", { ascending: true }).limit(pas).returns<FoaieDetaliata[]>();
    },
    (r) => r.id,
    { nume: "foi aprobate (detaliat)", pas: PAS_FOI_DETALIATE },
  );
}

/** Câte foi aprobate are luna, fără să le aducă. */
export async function numarFoiAprobateLuna(
  organizationId: string,
  interval: IntervalLuna,
  vehicul: string | null,
): Promise<number> {
  const db = await createServerSupabase();
  let q = db
    .from("trip_sheets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "aprobat")
    .is("deleted_at", null)
    .gte("data", interval.deLa)
    .lte("data", interval.panaLa);
  if (vehicul !== null) q = q.eq("vehicle_id", vehicul);
  const { count, error } = await q;
  if (error !== null) throw error;
  return count ?? 0;
}

// ── Foile care NU intră în cifre ────────────────────────────────────────────

export interface FoiNeaprobate {
  readonly ciorne: number;
  readonly trimise: number;
  readonly respinse: number;
}

/**
 * Câte foi ale lunii nu sunt (încă) aprobate: ciorne, trimise spre aprobare,
 * respinse. Nu intră în nicio cifră a raportului, dar un total mic ar fi luat
 * drept consum mic dacă nimeni nu spune că mai sunt foi de aprobat.
 */
export async function foiNeaprobateLuna(
  organizationId: string,
  interval: IntervalLuna,
  vehicul: string | null,
): Promise<FoiNeaprobate> {
  const db = await createServerSupabase();
  const randuri = await citesteTot<{ readonly id: string; readonly status: string }>(
    (dupa, pas) => {
      let q = db
        .from("trip_sheets")
        .select("id, status")
        .eq("organization_id", organizationId)
        .in("status", ["draft", "trimis", "respins"])
        .is("deleted_at", null)
        .gte("data", interval.deLa)
        .lte("data", interval.panaLa);
      if (vehicul !== null) q = q.eq("vehicle_id", vehicul);
      if (dupa !== null) q = q.gt("id", dupa);
      return q
        .order("id", { ascending: true })
        .limit(pas)
        .returns<{ id: string; status: string }[]>();
    },
    (r) => r.id,
    { nume: "foi neaprobate" },
  );
  const numara = (status: string): number => randuri.filter((r) => r.status === status).length;
  return { ciorne: numara("draft"), trimise: numara("trimis"), respinse: numara("respins") };
}

// ── Celelalte surse de cost ─────────────────────────────────────────────────

export interface SurseCostLuna {
  readonly servicii: readonly Readonly<{ id: string; vehicle_id: string; cost_total: number }>[];
  readonly cheltuieli: readonly Readonly<{ id: string; vehicle_id: string; suma: number }>[];
  readonly documente: readonly Readonly<{ id: string; vehicle_id: string; cost: number | null }>[];
}

/**
 * Service, cheltuieli fără foaie și documentele a căror valabilitate începe în
 * lună, pe TOATE vehiculele (sau doar pe cel ales). Combustibilul foilor vine
 * din `foiAprobateLuna`: două surse nu se numără niciodată de două ori.
 */
export async function surseDeCostLuna(
  organizationId: string,
  interval: IntervalLuna,
  vehicul: string | null,
): Promise<SurseCostLuna> {
  const db = await createServerSupabase();
  const [servicii, cheltuieli, documente] = await Promise.all([
    citesteTot<SurseCostLuna["servicii"][number]>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_service_entries")
          .select("id, vehicle_id, cost_total")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .gte("data_interventiei", interval.deLa)
          .lte("data_interventiei", interval.panaLa);
        if (vehicul !== null) q = q.eq("vehicle_id", vehicul);
        if (dupa !== null) q = q.gt("id", dupa);
        return q
          .order("id", { ascending: true })
          .limit(pas)
          .returns<{ id: string; vehicle_id: string; cost_total: number }[]>();
      },
      (r) => r.id,
      { nume: "intervenții de service" },
    ),
    citesteTot<SurseCostLuna["cheltuieli"][number]>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_expenses")
          .select("id, vehicle_id, suma")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .gte("data_cheltuielii", interval.deLa)
          .lte("data_cheltuielii", interval.panaLa);
        if (vehicul !== null) q = q.eq("vehicle_id", vehicul);
        if (dupa !== null) q = q.gt("id", dupa);
        return q
          .order("id", { ascending: true })
          .limit(pas)
          .returns<{ id: string; vehicle_id: string; suma: number }[]>();
      },
      (r) => r.id,
      { nume: "cheltuieli de vehicul" },
    ),
    citesteTot<SurseCostLuna["documente"][number]>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_documents")
          .select("id, vehicle_id, cost")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .not("cost", "is", null)
          .not("valabil_de_la", "is", null)
          .gte("valabil_de_la", interval.deLa)
          .lte("valabil_de_la", interval.panaLa);
        if (vehicul !== null) q = q.eq("vehicle_id", vehicul);
        if (dupa !== null) q = q.gt("id", dupa);
        return q
          .order("id", { ascending: true })
          .limit(pas)
          .returns<{ id: string; vehicle_id: string; cost: number | null }[]>();
      },
      (r) => r.id,
      { nume: "documente de vehicul" },
    ),
  ]);
  return { servicii, cheltuieli, documente };
}

// ── Etichetele ──────────────────────────────────────────────────────────────

/** Împarte o listă de id-uri în felii și adună rezultatele, ca `.in()` să rămână scurt. */
async function inFelii<T>(
  ids: readonly string[],
  citeste: (felie: readonly string[]) => Promise<ReadonlyMap<string, T>>,
): Promise<ReadonlyMap<string, T>> {
  const unice = [...new Set(ids)];
  const felii: string[][] = [];
  for (let i = 0; i < unice.length; i += FELIE_ID) felii.push(unice.slice(i, i + FELIE_ID));
  const parti = await Promise.all(felii.map((felie) => citeste(felie)));
  return new Map(parti.flatMap((harta) => [...harta]));
}

async function etichetaVehicule(
  organizationId: string,
  ids: readonly string[],
): Promise<EtichetaVehicule> {
  const vehicule = await inFelii(ids, (felie) => vehiculeDupaId(organizationId, felie));
  return new Map([...vehicule].map(([id, v]) => [id, v.nr_inmatriculare]));
}

async function etichetaSoferi(
  organizationId: string,
  ids: readonly string[],
): Promise<EtichetaSoferi> {
  const angajati = await inFelii(ids, (felie) => angajatiDupaId(organizationId, felie));
  return new Map([...angajati].map(([id, a]) => [id, a.full_name ?? a.marca]));
}

// ── Raportul lunii ──────────────────────────────────────────────────────────

export interface RaportLunar {
  readonly luna: string;
  readonly interval: IntervalLuna;
  /** `null` = toată flota. */
  readonly vehicul: string | null;
  readonly totaluri: TotaluriLuna;
  readonly foiNeaprobate: FoiNeaprobate;
  readonly consum: readonly RandConsum[];
  readonly soferi: readonly RandSofer[];
  readonly costuri: readonly RandCost[];
  readonly totalCost: TotalCost;
  readonly registru: readonly RandRegistru[];
}

/**
 * Raportul unei luni, compus din citirile de mai sus și din funcțiile pure ale
 * domeniului. `foiPreincarcate`: pachetul lunar a citit deja foile detaliat, iar
 * XLSX-ul din pachet trebuie să listeze EXACT foile din PDF-uri, nu o a doua
 * citire care ar fi putut prinde între timp o aprobare.
 */
export async function incarcaRaportLunar(
  organizationId: string,
  luna: string,
  vehicul: string | null,
  foiPreincarcate?: readonly FoaieRaport[],
): Promise<RaportLunar> {
  const interval = intervalLuna(luna);
  const [foi, foiNeaprobate, surse] = await Promise.all([
    foiPreincarcate !== undefined
      ? Promise.resolve(foiPreincarcate)
      : foiAprobateLuna(organizationId, interval, vehicul),
    foiNeaprobateLuna(organizationId, interval, vehicul),
    surseDeCostLuna(organizationId, interval, vehicul),
  ]);

  const [vehicule, soferi] = await Promise.all([
    etichetaVehicule(organizationId, [
      ...foi.map((f) => f.vehicle_id),
      ...surse.servicii.map((s) => s.vehicle_id),
      ...surse.cheltuieli.map((c) => c.vehicle_id),
      ...surse.documente.map((d) => d.vehicle_id),
    ]),
    etichetaSoferi(
      organizationId,
      foi.map((f) => f.employee_id).filter((id): id is string => id !== null),
    ),
  ]);

  const sursePentruCost: SurseCost = {
    foi,
    servicii: surse.servicii,
    cheltuieli: surse.cheltuieli,
    documente: surse.documente,
  };
  const costuri = costPeVehicul(sursePentruCost, vehicule);
  return {
    luna,
    interval,
    vehicul,
    totaluri: totaluriLuna(foi),
    foiNeaprobate,
    consum: consumPeVehicul(foi, vehicule),
    soferi: kmPeSofer(foi, soferi),
    costuri,
    totalCost: totaluriCost(costuri),
    registru: registruFoi(foi, vehicule, soferi),
  };
}
