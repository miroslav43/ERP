// src/lib/queries/fleet-rezervari.ts
//
// Citirile rezervărilor mașinilor de pool (0216, F12d).
//
// Ca în `fleet.ts`, NU se adaugă niciun filtru de scope: `rezervari_select`
// decide ce vede omul (ale lui; ale echipei pentru manager; toată firma pentru
// administrator). Excepția sunt citirile „ale mele” din portal, care filtrează
// EXPLICIT pe fișa proprie: un administrator care e și șofer ar vedea altfel
// toată firma în „Mașina mea”.
//
// Colegii nu se văd între ei sub `read = own`: zilele ocupate vin DOAR prin
// `public.ocuparea_vehiculelor_pool`, care nu întoarce identitatea lor.
//
// Selecturile sunt LITERALE, fără generic explicit: tipul vine din
// `src/types/database.ts` (memoria „Tipuri scrise de mână”), iar poarta
// `coloane.test.ts` le citește. Embed-urile se declară `| null` în tipurile de
// ieșire: un vehicul scos din pool dispare pentru angajat, deci embed-ul vine
// NULL fără eroare (capcana 18).
//
// Fișier propriu, nu adăugiri în `fleet.ts` (decizia 12).

import "server-only";

import {
  REZERVARI_MAX_ZILE_IMPLICIT,
  type Ocupare,
  type StatusRezervare,
  type SursaOcupare,
} from "@/domain/fleet/rezervari";
import type { FiltreRezervari } from "@/schemas/fleet-rezervari";
import { createServerSupabase } from "@/lib/supabase/server";

import { codificaCursor, decodificaCursor, predicatKeyset } from "./cursor";

/** Rânduri pe pagină în lista de rezervări. */
export const PE_PAGINA_REZERVARI = 50;
/** Plafonul cozii „De aprobat”, sub `max_rows = 1000`, care ar tăia TĂCUT. */
export const PLAFON_DE_APROBAT = 200;
/** Plafonul rezervărilor viitoare ale unui vehicul, pe fișa lui. */
export const PLAFON_REZERVARI_VEHICUL = 100;

export interface VehiculRezervare {
  readonly nr_inmatriculare: string;
  readonly marca: string;
  readonly model: string;
}

/** O rezervare, cu vehiculul și angajatul încorporate (`null` = nevăzut prin RLS). */
export interface RandRezervare {
  readonly id: string;
  readonly vehicle_id: string;
  readonly employee_id: string;
  readonly de_la: string;
  readonly pana_la: string;
  readonly scop: string;
  readonly destinatie: string | null;
  readonly observatii: string | null;
  readonly status: StatusRezervare;
  readonly decis_la: string | null;
  readonly motiv_respingere: string | null;
  readonly anulat_la: string | null;
  readonly motiv_anulare: string | null;
  readonly created_at: string;
  readonly vehicul: VehiculRezervare | null;
  /** `full_name` e GENERATED în bază, deci nullable în tipurile generate. */
  readonly angajat: Readonly<{ full_name: string | null }> | null;
}

export interface PaginaRezervari {
  readonly randuri: readonly RandRezervare[];
  readonly urmatorulCursor: string | null;
}

interface RandBrut {
  readonly id: string;
  readonly vehicle_id: string;
  readonly employee_id: string;
  readonly de_la: string;
  readonly pana_la: string;
  readonly scop: string;
  readonly destinatie: string | null;
  readonly observatii: string | null;
  readonly status: StatusRezervare;
  readonly decis_la: string | null;
  readonly motiv_respingere: string | null;
  readonly anulat_la: string | null;
  readonly motiv_anulare: string | null;
  readonly created_at: string;
  readonly vehicul: VehiculRezervare | null;
  readonly angajat: Readonly<{ full_name: string | null }> | null;
}

function dinBrut(r: RandBrut): RandRezervare {
  return {
    id: r.id,
    vehicle_id: r.vehicle_id,
    employee_id: r.employee_id,
    de_la: r.de_la,
    pana_la: r.pana_la,
    scop: r.scop,
    destinatie: r.destinatie,
    observatii: r.observatii,
    status: r.status,
    decis_la: r.decis_la,
    motiv_respingere: r.motiv_respingere,
    anulat_la: r.anulat_la,
    motiv_anulare: r.motiv_anulare,
    created_at: r.created_at,
    vehicul: r.vehicul,
    angajat: r.angajat,
  };
}

function pagina(toate: readonly RandBrut[], pePagina: number): PaginaRezervari {
  const areUrmatoarea = toate.length > pePagina;
  const randuri = (areUrmatoarea ? toate.slice(0, pePagina) : toate).map(dinBrut);
  const ultim = randuri.at(-1);
  return {
    randuri,
    urmatorulCursor:
      areUrmatoarea && ultim !== undefined
        ? codificaCursor({ valoare: ultim.de_la, id: ultim.id })
        : null,
  };
}

/**
 * Toate rezervările vizibile apelantului, cele mai noi primele (keyset pe
 * `de_la desc, id desc`, nu `.range()`).
 */
export async function listeazaRezervari(
  organizationId: string,
  filtre: FiltreRezervari,
): Promise<PaginaRezervari> {
  const db = await createServerSupabase();
  let q = db
    .from("vehicle_reservations")
    .select(
      "id, vehicle_id, employee_id, de_la, pana_la, scop, destinatie, observatii, status, decis_la, motiv_respingere, anulat_la, motiv_anulare, created_at, vehicul:vehicles!vehicle_id(nr_inmatriculare, marca, model), angajat:employees!employee_id(full_name)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (filtre.stare !== null) q = q.eq("status", filtre.stare);
  if (filtre.vehicul !== null) q = q.eq("vehicle_id", filtre.vehicul);
  if (filtre.angajat !== null) q = q.eq("employee_id", filtre.angajat);
  if (filtre.cursor !== null) {
    const c = decodificaCursor(filtre.cursor);
    if (c !== null) q = q.or(predicatKeyset("de_la", c, "desc"));
  }
  const { data, error } = await q
    .order("de_la", { ascending: false })
    .order("id", { ascending: false })
    .limit(PE_PAGINA_REZERVARI + 1);
  if (error !== null) throw error;
  return pagina(data, PE_PAGINA_REZERVARI);
}

/**
 * Rezervările proprii (portalul), cu filtru EXPLICIT pe fișă. Aceeași paginare
 * keyset ca lista mare.
 */
export async function rezervarileMele(
  organizationId: string,
  fisaMeaId: string,
  cursor: string | null,
): Promise<PaginaRezervari> {
  const db = await createServerSupabase();
  let q = db
    .from("vehicle_reservations")
    .select(
      "id, vehicle_id, employee_id, de_la, pana_la, scop, destinatie, observatii, status, decis_la, motiv_respingere, anulat_la, motiv_anulare, created_at, vehicul:vehicles!vehicle_id(nr_inmatriculare, marca, model), angajat:employees!employee_id(full_name)",
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", fisaMeaId)
    .is("deleted_at", null);
  if (cursor !== null) {
    const c = decodificaCursor(cursor);
    if (c !== null) q = q.or(predicatKeyset("de_la", c, "desc"));
  }
  const { data, error } = await q
    .order("de_la", { ascending: false })
    .order("id", { ascending: false })
    .limit(PE_PAGINA_REZERVARI + 1);
  if (error !== null) throw error;
  return pagina(data, PE_PAGINA_REZERVARI);
}

/**
 * Următoarele rezervări proprii (cardul din „Mașina mea”): active, care nu s-au
 * încheiat, cele mai apropiate primele.
 */
export async function urmatoareleMeleRezervari(
  organizationId: string,
  fisaMeaId: string,
  azi: string,
  cate: number,
): Promise<readonly RandRezervare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_reservations")
    .select(
      "id, vehicle_id, employee_id, de_la, pana_la, scop, destinatie, observatii, status, decis_la, motiv_respingere, anulat_la, motiv_anulare, created_at, vehicul:vehicles!vehicle_id(nr_inmatriculare, marca, model), angajat:employees!employee_id(full_name)",
    )
    .eq("organization_id", organizationId)
    .eq("employee_id", fisaMeaId)
    .in("status", ["ceruta", "confirmata"])
    .gte("pana_la", azi)
    .is("deleted_at", null)
    .order("de_la", { ascending: true })
    .order("id", { ascending: true })
    .limit(cate);
  if (error !== null) throw error;
  return data.map(dinBrut);
}

/**
 * Cererile care așteaptă decizia apelantului: `ceruta`, neexpirate, fără ale lui
 * (baza refuză oricum auto-decizia). Contorul din panou folosește ACELAȘI filtru
 * (`numarRezervariDeAprobat`): altfel ar număra la nesfârșit ce lista nu mai arată.
 */
export async function rezervariDeAprobat(
  organizationId: string,
  fisaMeaId: string | null,
  azi: string,
): Promise<readonly RandRezervare[]> {
  const db = await createServerSupabase();
  let q = db
    .from("vehicle_reservations")
    .select(
      "id, vehicle_id, employee_id, de_la, pana_la, scop, destinatie, observatii, status, decis_la, motiv_respingere, anulat_la, motiv_anulare, created_at, vehicul:vehicles!vehicle_id(nr_inmatriculare, marca, model), angajat:employees!employee_id(full_name)",
    )
    .eq("organization_id", organizationId)
    .eq("status", "ceruta")
    .gte("pana_la", azi)
    .is("deleted_at", null);
  if (fisaMeaId !== null) q = q.neq("employee_id", fisaMeaId);
  const { data, error } = await q
    .order("de_la", { ascending: true })
    .order("id", { ascending: true })
    .limit(PLAFON_DE_APROBAT);
  if (error !== null) throw error;
  return data.map(dinBrut);
}

/** Câte cereri ar arăta `rezervariDeAprobat`, cu exact același filtru. */
export async function numarRezervariDeAprobat(
  organizationId: string,
  fisaMeaId: string | null,
  azi: string,
): Promise<number> {
  const db = await createServerSupabase();
  let q = db
    .from("vehicle_reservations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "ceruta")
    .gte("pana_la", azi)
    .is("deleted_at", null);
  if (fisaMeaId !== null) q = q.neq("employee_id", fisaMeaId);
  const { count, error } = await q;
  if (error !== null) throw error;
  return Math.min(count ?? 0, PLAFON_DE_APROBAT);
}

/** Rezervările active care nu s-au încheiat, pe fișa unui vehicul. */
export async function rezervarileVehiculului(
  organizationId: string,
  vehicleId: string,
  azi: string,
): Promise<readonly RandRezervare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_reservations")
    .select(
      "id, vehicle_id, employee_id, de_la, pana_la, scop, destinatie, observatii, status, decis_la, motiv_respingere, anulat_la, motiv_anulare, created_at, vehicul:vehicles!vehicle_id(nr_inmatriculare, marca, model), angajat:employees!employee_id(full_name)",
    )
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .in("status", ["ceruta", "confirmata"])
    .gte("pana_la", azi)
    .is("deleted_at", null)
    .order("de_la", { ascending: true })
    .order("id", { ascending: true })
    .limit(PLAFON_REZERVARI_VEHICUL);
  if (error !== null) throw error;
  return data.map(dinBrut);
}

export interface FoaieRezervare {
  readonly id: string;
  readonly vehicle_reservation_id: string | null;
  readonly data: string | null;
  readonly status: string;
  readonly numar: string | null;
}

/**
 * Foile LEGATE de rezervări (legătura o pune triggerul `foi_parcurs_rezervare`).
 * Atenție: gărzile bazei (anulare, scurtare, ieșirea din pool) privesc și foile
 * NELEGATE ale omului pe vehicul în zilele rezervării (`internal.rezervari_ultima_foaie`):
 * foaia făcută cât cererea aștepta nu se leagă retroactiv la aprobare.
 */
export async function foileRezervarii(
  organizationId: string,
  idRezervari: readonly string[],
): Promise<readonly FoaieRezervare[]> {
  if (idRezervari.length === 0) return [];
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("trip_sheets")
    .select("id, vehicle_reservation_id, data, status, numar")
    .eq("organization_id", organizationId)
    .in("vehicle_reservation_id", [...idRezervari])
    .is("deleted_at", null)
    .order("data", { ascending: true })
    .limit(500);
  if (error !== null) throw error;
  return data;
}

const SURSE: ReadonlySet<string> = new Set<SursaOcupare>(["rezervare", "foaie", "alocare"]);

/**
 * Ocuparea mașinilor de pool pe o fereastră de zile (cel mult 63, altfel
 * 22023), tăiată la azi: zilele trecute nu ies. Fără identitatea colegilor și
 * fără starea foilor lor; `rezervare_id` doar pe ale apelantului. Zero rânduri,
 * fără eroare, pentru cine nu poate rezerva.
 */
export async function ocupareaPool(
  organizationId: string,
  deLa: string,
  panaLa: string,
): Promise<readonly Ocupare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("ocuparea_vehiculelor_pool", {
    p_organization_id: organizationId,
    p_de_la: deLa,
    p_pana_la: panaLa,
  });
  if (error !== null) throw error;
  return data.flatMap((o): Ocupare[] =>
    SURSE.has(o.sursa)
      ? [
          {
            vehicle_id: o.vehicle_id,
            de_la: o.de_la,
            pana_la: o.pana_la,
            sursa: o.sursa as SursaOcupare,
            status: o.status,
            a_mea: o.a_mea,
            rezervare_id: o.rezervare_id,
          },
        ]
      : [],
  );
}

export interface SetariRezervari {
  readonly cuAprobare: boolean;
  readonly obligatorie: boolean;
  readonly maxZile: number;
}

export const SETARI_REZERVARI_IMPLICITE: SetariRezervari = {
  cuAprobare: false,
  obligatorie: false,
  maxZile: REZERVARI_MAX_ZILE_IMPLICIT,
};

/**
 * Cele trei setări ale rezervărilor, pentru orice membru al firmei (nu doar
 * pentru administratori, cum e `fleet_settings`). Rând gol = implicitele.
 */
export async function setarileRezervarilor(organizationId: string): Promise<SetariRezervari> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("setarile_rezervarilor", {
    p_organization_id: organizationId,
  });
  if (error !== null) throw error;
  const rand = data[0];
  if (rand === undefined) return SETARI_REZERVARI_IMPLICITE;
  return { cuAprobare: rand.cu_aprobare, obligatorie: rand.obligatorie, maxZile: rand.max_zile };
}

export interface VehiculPool {
  readonly id: string;
  readonly nr_inmatriculare: string;
  readonly marca: string;
  readonly model: string;
  readonly status: "activ" | "in_service" | "vandut" | "casat";
}

/** Mașinile de pool rezervabile (vizibile prin RLS și sub own/team, din 0199). */
export async function vehiculePool(organizationId: string): Promise<readonly VehiculPool[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicles")
    .select("id, nr_inmatriculare, marca, model, status")
    .eq("organization_id", organizationId)
    .eq("pool", true)
    .in("status", ["activ", "in_service"])
    .is("deleted_at", null)
    .order("nr_inmatriculare", { ascending: true })
    .limit(200);
  if (error !== null) throw error;
  return data;
}

export interface AngajatRezervare {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/** Angajații activi, pentru selectul celui cu `vehicle_reservations:create = all`. */
export async function angajatiPentruRezervare(
  organizationId: string,
): Promise<readonly AngajatRezervare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id, full_name, marca")
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .limit(500);
  if (error !== null) throw error;
  return data;
}
