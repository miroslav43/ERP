// src/lib/queries/flota-asistent.ts
// Citirile uneltelor de flotă ale asistentului (F12e). Fișier separat de
// `fleet.ts` (D5), pe care îl ating și fazele paralele ale flotei.
//
// ── CE SE PĂSTREAZĂ DIN `fleet.ts` ──────────────────────────────────────────
// Ca acolo, NU se adaugă filtre de scope: vizibilitatea o dau politicile, iar
// uneltele citesc prin clientul de SESIUNE, cu RLS-ul celui care întreabă
// (niciodată `createAdminSupabase`). Ce se adaugă, peste `fleet.ts`:
//  - `organization_id` explicit în FIECARE citire (D12): politicile flotei au
//    ramura `app.is_platform_admin()`, care vede toate firmele;
//  - `deleted_at is null` în fiecare citire: din 0018, politicile de SELECT ale
//    flotei nu mai cer `deleted_at is null`, deci filtrul de aici e singura
//    barieră contra rândurilor șterse logic, nu o redundanță;
//  - coloanele folosite ca FILTRU (`data`, `expira_la`, `este_curent`,
//    `pana_la`, `termen_raspuns`) apar și în `select`, cu literal: poarta
//    `coloane.test.ts` citește doar `select`/`order`, deci o coloană doar în
//    `.eq`/`.lte` ar scăpa de ea și ar cădea la runtime cu 42703.
//
// Agregările trec prin `citesteTot`: `max_rows = 1000` trunchiază TĂCUT, iar un
// asistent care spune „3 vehicule fără foi” în loc de 30 nu se vede niciodată.

import "server-only";

import type { StadiuAmenda } from "@/domain/fleet/amenzi";
import type { RegimFiscal } from "@/domain/fleet/fiscal";
import type { StatusRezervare } from "@/domain/fleet/rezervari";
import { createServerSupabase } from "@/lib/supabase/server";
import type { CategorieVehicul, StatusFoaie, StatusVehicul } from "@/schemas/fleet";

import { citesteTot } from "./citeste-tot";

/** Câte id-uri intră într-un `.in()`: adresa cererii nu crește fără limită. */
const FELIE_ID = 100;

function felii(ids: readonly string[]): string[][] {
  const unice = [...new Set(ids)];
  const rezultat: string[][] = [];
  for (let i = 0; i < unice.length; i += FELIE_ID) rezultat.push(unice.slice(i, i + FELIE_ID));
  return rezultat;
}

/** O citire completă pe fiecare felie de id-uri, lipite la loc. Listă goală → niciun drum la bază. */
async function peFelii<T>(
  ids: readonly string[],
  citeste: (felie: readonly string[]) => Promise<readonly T[]>,
): Promise<readonly T[]> {
  const rezultate = await Promise.all(felii(ids).map((felie) => citeste(felie)));
  return rezultate.flat();
}

// ── Vehiculele ──────────────────────────────────────────────────────────────

export interface VehiculScurt {
  readonly id: string;
  readonly nr_inmatriculare: string;
  readonly status: StatusVehicul;
  readonly pool: boolean;
  readonly km_curent: number;
  readonly categorie: CategorieVehicul;
  readonly masa_maxima_kg: number | null;
  readonly consum_mediu_declarat: number | null;
  readonly data_achizitie: string | null;
  readonly data_iesire: string | null;
}

/**
 * Vehiculele vizibile al căror număr CONȚINE `nr` (deja normalizat: doar
 * litere și cifre, deci fără nimic de scăpat în `ilike`). Căutarea nu filtrează
 * pe `status`: „cine conducea pe 3 octombrie” poate privi o mașină vândută azi.
 */
export async function vehiculeDupaNumar(
  organizationId: string,
  nr: string,
  limita: number,
): Promise<readonly VehiculScurt[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicles")
    .select(
      "id, nr_inmatriculare, status, pool, km_curent, categorie, masa_maxima_kg, consum_mediu_declarat, data_achizitie, data_iesire",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .ilike("nr_inmatriculare", `%${nr}%`)
    .order("nr_inmatriculare", { ascending: true })
    .order("id", { ascending: true })
    .limit(limita)
    .returns<VehiculScurt[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/** Tot parcul VIZIBIL (vândute și casate incluse), pentru calcule. */
export async function vehiculeFirmei(organizationId: string): Promise<readonly VehiculScurt[]> {
  const db = await createServerSupabase();
  return citesteTot<VehiculScurt>(
    (dupa, pas) => {
      let q = db
        .from("vehicles")
        .select(
          "id, nr_inmatriculare, status, pool, km_curent, categorie, masa_maxima_kg, consum_mediu_declarat, data_achizitie, data_iesire",
        )
        .eq("organization_id", organizationId)
        .is("deleted_at", null);
      if (dupa !== null) q = q.gt("id", dupa);
      return q.order("id", { ascending: true }).limit(pas).returns<VehiculScurt[]>();
    },
    (r) => r.id,
    { nume: "vehicule (asistent)" },
  );
}

// ── Documentele ─────────────────────────────────────────────────────────────

export interface DocumentCurent {
  readonly id: string;
  readonly vehicle_id: string;
  readonly document_type_id: string;
  readonly expira_la: string | null;
  readonly este_curent: boolean;
}

/**
 * Documentele CURENTE ale vehiculelor date, din `vehicle_documents` — niciodată
 * din `expirables`, al cărei `expirabile_select` cere `compliance:read`: un
 * manager sau un angajat ar primi zero rânduri, fără eroare (capcanele #19, #26).
 *
 * Lista de vehicule e OBLIGATORIE: documentele unui vehicul vândut rămân
 * `este_curent`, deci o citire fără ea le-ar scoate drept scadențe. Toate cele
 * curente, nu doar cele care expiră: tipurile obligatorii LIPSĂ se văd numai pe
 * mulțimea întreagă.
 */
export async function documenteCurente(
  organizationId: string,
  idVehicule: readonly string[],
): Promise<readonly DocumentCurent[]> {
  const db = await createServerSupabase();
  return peFelii(idVehicule, (felie) =>
    citesteTot<DocumentCurent>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_documents")
          .select("id, vehicle_id, document_type_id, expira_la, este_curent")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .eq("este_curent", true)
          .in("vehicle_id", [...felie]);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas).returns<DocumentCurent[]>();
      },
      (r) => r.id,
      { nume: "documente curente (asistent)" },
    ),
  );
}

// ── Foile și cursele ────────────────────────────────────────────────────────

export interface FoaieScurta {
  readonly id: string;
  readonly vehicle_id: string;
  readonly employee_id: string;
  readonly numar: string | null;
  /** Ziua foii (0200), `AAAA-LL-ZZ`. */
  readonly data: string;
  readonly status: StatusFoaie;
}

/** Foile cu ziua în `[deLa, panaLa]` (zile românești, coloana `data` din 0200). */
export async function foiInInterval(
  organizationId: string,
  deLa: string,
  panaLa: string,
  filtre: Readonly<{ vehicleId?: string; statusuri?: readonly StatusFoaie[] }> = {},
): Promise<readonly FoaieScurta[]> {
  const db = await createServerSupabase();
  return citesteTot<FoaieScurta>(
    (dupa, pas) => {
      let q = db
        .from("trip_sheets")
        .select("id, vehicle_id, employee_id, numar, data, status")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .gte("data", deLa)
        .lte("data", panaLa);
      if (filtre.vehicleId !== undefined) q = q.eq("vehicle_id", filtre.vehicleId);
      if (filtre.statusuri !== undefined) q = q.in("status", [...filtre.statusuri]);
      if (dupa !== null) q = q.gt("id", dupa);
      return q.order("id", { ascending: true }).limit(pas).returns<FoaieScurta[]>();
    },
    (r) => r.id,
    { nume: "foi (asistent)" },
  );
}

export interface CursaScurta {
  readonly id: string;
  readonly trip_sheet_id: string;
  readonly plecare_la: string;
  readonly sosire_la: string | null;
}

/**
 * Intervalele orare ale curselor, FĂRĂ locuri: `de_la_loc → pana_la_loc` nu se
 * citește deloc (decizia I-T6 / e D7 a). Textul uneltei pleacă la furnizorul
 * modelului, iar locul unui om identificat la o oră dată e o dată de localizare;
 * pastila duce la foaie, unde omul vede traseul sub propriul drept.
 */
export async function curseleFoilor(
  organizationId: string,
  idFoi: readonly string[],
): Promise<readonly CursaScurta[]> {
  const db = await createServerSupabase();
  return peFelii(idFoi, (felie) =>
    citesteTot<CursaScurta>(
      (dupa, pas) => {
        let q = db
          .from("trip_sheet_curse")
          .select("id, trip_sheet_id, plecare_la, sosire_la")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .in("trip_sheet_id", [...felie]);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas).returns<CursaScurta[]>();
      },
      (r) => r.id,
      { nume: "curse (asistent)" },
    ),
  );
}

// ── Alocările și rezervările ────────────────────────────────────────────────

export interface AlocareScurta {
  readonly id: string;
  readonly employee_id: string;
  readonly de_la: string;
  readonly pana_la: string | null;
}

/**
 * Alocările vehiculului începute înainte de `inainteDe` (ISO). Suprapunerea cu
 * ziua (`pana_la` nul sau după începutul ei) se judecă în `alegeSoferul`.
 * `alocari_select` filtrează pe șoferul ALOCĂRII: o alocare a unui
 * ne-subordonat lipsește pentru manager, fără eroare.
 */
export async function alocarileInceputeInainte(
  organizationId: string,
  vehicleId: string,
  inainteDe: string,
): Promise<readonly AlocareScurta[]> {
  const db = await createServerSupabase();
  return citesteTot<AlocareScurta>(
    (dupa, pas) => {
      let q = db
        .from("vehicle_assignments")
        .select("id, employee_id, de_la, pana_la")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .eq("vehicle_id", vehicleId)
        .lt("de_la", inainteDe);
      if (dupa !== null) q = q.gt("id", dupa);
      return q.order("id", { ascending: true }).limit(pas).returns<AlocareScurta[]>();
    },
    (r) => r.id,
    { nume: "alocări (asistent)" },
  );
}

export interface RezervareScurta {
  readonly id: string;
  readonly employee_id: string;
  readonly de_la: string;
  readonly pana_la: string;
  readonly status: StatusRezervare;
}

/** Rezervările cerute sau confirmate ale vehiculului care cuprind ziua (F12d, zile întregi). */
export async function rezervarileZilei(
  organizationId: string,
  vehicleId: string,
  zi: string,
): Promise<readonly RezervareScurta[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_reservations")
    .select("id, employee_id, de_la, pana_la, status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("vehicle_id", vehicleId)
    .in("status", ["ceruta", "confirmata"])
    .lte("de_la", zi)
    .gte("pana_la", zi)
    .order("de_la", { ascending: true })
    .limit(20)
    .returns<RezervareScurta[]>();
  if (error !== null) throw error;
  return data ?? [];
}

// ── Service, amenzi, permise (F7, F11, F9) ──────────────────────────────────

export interface PlanScadent {
  readonly id: string;
  readonly vehicle_id: string;
  readonly denumire: string;
  readonly activ: boolean;
  readonly urmatoarea_data: string | null;
  readonly urmatorii_km: number | null;
  readonly prag_avertizare_km: number;
}

/**
 * Planurile de service ACTIVE ale vehiculelor date (F7). `vsp_select` cere
 * `vehicles:read >= team`: un angajat primește zero rânduri, deci unealta nu
 * cheamă citirea pentru el și nu afirmă nimic despre revizii.
 */
export async function planuriServiceActive(
  organizationId: string,
  idVehicule: readonly string[],
): Promise<readonly PlanScadent[]> {
  const db = await createServerSupabase();
  return peFelii(idVehicule, (felie) =>
    citesteTot<PlanScadent>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_service_plans")
          .select(
            "id, vehicle_id, denumire, activ, urmatoarea_data, urmatorii_km, prag_avertizare_km",
          )
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .eq("activ", true)
          .in("vehicle_id", [...felie]);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas).returns<PlanScadent[]>();
      },
      (r) => r.id,
      { nume: "planuri de service (asistent)" },
    ),
  );
}

export interface AmendaScadenta {
  readonly id: string;
  readonly vehicle_id: string;
  readonly numar_pv: string;
  readonly termen_raspuns: string | null;
  readonly stadiu: StadiuAmenda;
  readonly raspuns_trimis_la: string | null;
}

/**
 * Amenzile cu termenul de răspuns până la `panaLa` și răspunsul încă neplecat
 * (F11). Ce înseamnă „neplecat” decide `raspunsInAsteptare` în unealtă, ca pe
 * ecranul amenzilor; filtrul de aici doar îngustează.
 */
export async function amenziCuTermen(
  organizationId: string,
  panaLa: string,
): Promise<readonly AmendaScadenta[]> {
  const db = await createServerSupabase();
  return citesteTot<AmendaScadenta>(
    (dupa, pas) => {
      let q = db
        .from("vehicle_fines")
        .select("id, vehicle_id, numar_pv, termen_raspuns, stadiu, raspuns_trimis_la")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .is("raspuns_trimis_la", null)
        .lte("termen_raspuns", panaLa);
      if (dupa !== null) q = q.gt("id", dupa);
      return q.order("id", { ascending: true }).limit(pas).returns<AmendaScadenta[]>();
    },
    (r) => r.id,
    { nume: "amenzi (asistent)" },
  );
}

export interface PermisScadent {
  readonly id: string;
  readonly employee_id: string;
  readonly categorii: string[];
  readonly expira_la: string;
}

/**
 * Permisele care expiră până la `panaLa` (F9). FĂRĂ `numar`: numărul permisului
 * n-are ce căuta în contextul modelului, ca CNP-ul (`tip.ts`, proprietatea 3).
 * `driver_licenses_select` (`app.ssm_acces`) dă own/team/all după rol.
 */
export async function permiseCareExpira(
  organizationId: string,
  panaLa: string,
): Promise<readonly PermisScadent[]> {
  const db = await createServerSupabase();
  return citesteTot<PermisScadent>(
    (dupa, pas) => {
      let q = db
        .from("driver_licenses")
        .select("id, employee_id, categorii, expira_la")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .lte("expira_la", panaLa);
      if (dupa !== null) q = q.gt("id", dupa);
      return q.order("id", { ascending: true }).limit(pas).returns<PermisScadent[]>();
    },
    (r) => r.id,
    { nume: "permise (asistent)" },
  );
}

// ── Normele și regimul fiscal (F10) ─────────────────────────────────────────

export interface NormaVehicul {
  readonly id: string;
  readonly vehicle_id: string;
  readonly valabil_de_la: string;
  readonly l_100km: number;
}

/** Normele proprii de consum ale vehiculelor (F10; `vehicles:read = all` în politică). */
export async function normeConsum(
  organizationId: string,
  idVehicule: readonly string[],
): Promise<readonly NormaVehicul[]> {
  const db = await createServerSupabase();
  return peFelii(idVehicule, (felie) =>
    citesteTot<NormaVehicul>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_consumption_norms")
          .select("id, vehicle_id, valabil_de_la, l_100km")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .in("vehicle_id", [...felie]);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas).returns<NormaVehicul[]>();
      },
      (r) => r.id,
      { nume: "norme de consum (asistent)" },
    ),
  );
}

export interface RegimVehicul {
  readonly id: string;
  readonly vehicle_id: string;
  readonly regim: RegimFiscal;
  readonly valabil_de_la: string;
}

/** Perioadele de regim fiscal ale vehiculelor (F10; `vehicles:read = all` în politică). */
export async function regimuriFiscale(
  organizationId: string,
  idVehicule: readonly string[],
): Promise<readonly RegimVehicul[]> {
  const db = await createServerSupabase();
  return peFelii(idVehicule, (felie) =>
    citesteTot<RegimVehicul>(
      (dupa, pas) => {
        let q = db
          .from("vehicle_fiscal_regimes")
          .select("id, vehicle_id, regim, valabil_de_la")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .in("vehicle_id", [...felie]);
        if (dupa !== null) q = q.gt("id", dupa);
        return q.order("id", { ascending: true }).limit(pas).returns<RegimVehicul[]>();
      },
      (r) => r.id,
      { nume: "regimuri fiscale (asistent)" },
    ),
  );
}
