// src/lib/queries/soferi.ts
// Citirile pentru șoferii flotei (0204, F9): permisul de conducere, faptele
// verificărilor încrucișate și deplasările de care se poate lega o foaie.
//
// Fișier separat de `fleet.ts`, pe care îl scriu și fazele paralele ale
// flotei. Ca acolo, NU se adaugă filtre de scope: le pune RLS
// (`driver_licenses_select` pe `app.ssm_acces`), iar faptele vin dintr-o
// funcție care își judecă singură apelantul (`public.verificari_soferi`).

import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";
import { getEnabledFeatures } from "@/lib/auth/features";
import { idFisaProprie } from "@/lib/queries/employees";
import { listeazaVehicule, vehicululMeu } from "@/lib/queries/fleet";
import type { FapteSofer, VehiculPentruPermis } from "@/domain/fleet/soferi";
import type { CategorieVehicul } from "@/schemas/fleet";

export interface RandPermis {
  readonly id: string;
  readonly employee_id: string;
  readonly numar: string;
  readonly categorii: string[];
  readonly eliberat_la: string | null;
  readonly expira_la: string;
  readonly observatii: string | null;
  readonly fisier_path: string | null;
}

const COLOANE_PERMIS =
  "id, employee_id, numar, categorii, eliberat_la, expira_la, observatii, fisier_path";

/**
 * Permisul ACTIV al angajatului, sau `null` (n-are, ori apelantul nu-l vede —
 * pentru ecran e același lucru: „niciun permis înregistrat”).
 */
export async function permisulAngajatului(
  organizationId: string,
  employeeId: string,
): Promise<RandPermis | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("driver_licenses")
    .select(COLOANE_PERMIS)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .maybeSingle<RandPermis>();
  if (error !== null) throw error;
  return data;
}

/** Plafonul funcției SQL: un apel nu judecă mai mult de atât. */
const PLAFON_FAPTE = 500;

/**
 * Faptele verificărilor pentru fiecare angajat VIZIBIL apelantului, în ziua
 * dată (`AAAA-LL-ZZ`). Cei pe care nu-i poate judeca lipsesc din hartă, fără
 * eroare — ecranul nu arată nimic despre ei. Modulul de flotă oprit = hartă
 * goală.
 */
export async function verificariSoferi(
  organizationId: string,
  employeeIds: readonly string[],
  zi: string,
): Promise<ReadonlyMap<string, FapteSofer>> {
  const unici = [...new Set(employeeIds)];
  if (unici.length === 0) return new Map();
  const db = await createServerSupabase();
  const loturi: string[][] = [];
  for (let i = 0; i < unici.length; i += PLAFON_FAPTE)
    loturi.push(unici.slice(i, i + PLAFON_FAPTE));

  // Generatorul tipează coloanele unui `returns table` ca NON-null (nu poate
  // deduce nullabilitatea), deși `concediu`, `aviz` și `delegatie` sunt des
  // `null`, iar `permis_exista`, `permis_expira_la` și `permis_categorii` sunt
  // `null` pentru cine n-ar trece `driver_licenses_select` pe acel angajat
  // („nu se știe”, nu „fără permis”). Copierea în `FapteSofer` LĂRGEȘTE tipul la
  // cel adevărat; proba `proba-flota-soferi.sql` (11)–(14) și (28)–(35) îl fixează.
  const rezultate = await Promise.all(
    loturi.map((lot) =>
      db.rpc("verificari_soferi", {
        p_organization_id: organizationId,
        p_employee_ids: lot,
        p_zi: zi,
      }),
    ),
  );
  const harta = new Map<string, FapteSofer>();
  for (const { data, error } of rezultate) {
    if (error !== null) throw error;
    for (const r of data ?? []) {
      const fapte: FapteSofer = {
        employee_id: r.employee_id,
        concediu: r.concediu,
        contract_incetat: r.contract_incetat,
        permis_exista: r.permis_exista,
        permis_expira_la: r.permis_expira_la,
        permis_categorii: r.permis_categorii,
        aviz: r.aviz,
        delegatie: r.delegatie,
      };
      harta.set(r.employee_id, fapte);
    }
  }
  return harta;
}

/** Orașul sediului firmei, pentru verificarea „deplasare fără delegație”. */
export async function orasulFirmei(organizationId: string): Promise<string | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("organizations")
    .select("oras")
    .eq("id", organizationId)
    .maybeSingle<{ readonly oras: string | null }>();
  if (error !== null) throw error;
  const oras = data?.oras?.trim() ?? "";
  return oras.length === 0 ? null : oras;
}

/**
 * Ce trebuie verificării de categorie: categoria, masa și locurile. Prin RLS;
 * vehiculul pe care apelantul nu-l mai vede întoarce `null`, iar apelantul
 * cade pe instantaneul foii (doar categoria).
 */
export async function vehiculPentruPermis(
  organizationId: string,
  vehicleId: string,
): Promise<VehiculPentruPermis | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicles")
    .select("categorie, masa_maxima_kg, numar_locuri")
    .eq("organization_id", organizationId)
    .eq("id", vehicleId)
    .maybeSingle<{
      readonly categorie: CategorieVehicul;
      readonly masa_maxima_kg: number | null;
      readonly numar_locuri: number | null;
    }>();
  if (error !== null) throw error;
  return data;
}

export interface OptiuneDeplasare {
  readonly id: string;
  readonly scop: string;
  readonly localitate: string | null;
  readonly plecare_la: string;
  readonly sosire_la: string;
  readonly status: string;
  readonly numar_document: string | null;
}

const COLOANE_DEPLASARE = "id, scop, localitate, plecare_la, sosire_la, status, numar_document";

/**
 * Deplasările șoferului care se suprapun cu ziua foii (cu o zi de toleranță
 * în fiecare parte, pentru fusul orar și pentru plecarea de cu seară), fără
 * cele anulate. Prin RLS: șoferul își vede deplasările lui (`per_diem:read =
 * own`), administratorul pe ale tuturor.
 */
export async function deplasariPentruFoaie(
  organizationId: string,
  employeeId: string,
  zi: string,
): Promise<readonly OptiuneDeplasare[]> {
  const inceput = new Date(`${zi}T00:00:00Z`);
  const deLa = new Date(inceput.getTime() - 24 * 3600 * 1000).toISOString();
  const panaLa = new Date(inceput.getTime() + 2 * 24 * 3600 * 1000).toISOString();
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("business_trips")
    .select(COLOANE_DEPLASARE)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .neq("status", "anulata")
    .is("deleted_at", null)
    .lt("plecare_la", panaLa)
    .gte("sosire_la", deLa)
    .order("plecare_la", { ascending: false })
    .limit(20)
    .returns<OptiuneDeplasare[]>();
  if (error !== null) throw error;
  return data;
}

/** Deplasarea legată de foaie (0204), sau `null`. Prin RLS. */
export async function deplasareaFoii(
  organizationId: string,
  foaieId: string,
): Promise<OptiuneDeplasare | null> {
  const db = await createServerSupabase();
  const { data: foaie, error } = await db
    .from("trip_sheets")
    .select("business_trip_id")
    .eq("organization_id", organizationId)
    .eq("id", foaieId)
    .maybeSingle<{ readonly business_trip_id: string | null }>();
  if (error !== null) throw error;
  if (foaie?.business_trip_id == null) return null;
  const { data, error: eroare } = await db
    .from("business_trips")
    .select(COLOANE_DEPLASARE)
    .eq("organization_id", organizationId)
    .eq("id", foaie.business_trip_id)
    .maybeSingle<OptiuneDeplasare>();
  if (eroare !== null) throw eroare;
  // Legătura există, dar apelantul nu vede deplasarea (diurna oprită pentru
  // rolul lui): se spune că e legată, fără detalii.
  return (
    data ?? {
      id: foaie.business_trip_id,
      scop: "Deplasare",
      localitate: null,
      plecare_la: "",
      sosire_la: "",
      status: "",
      numar_document: null,
    }
  );
}

export interface VehiculDeplasare {
  readonly id: string;
  readonly nr_inmatriculare: string;
  readonly marca: string;
  readonly model: string;
}

/**
 * Vehiculele din care se alege mașina de serviciu a unei deplasări noi (F9).
 *
 * Cu flota oprită sau fără `vehicles:read`, lista e goală și formularul nu
 * arată selectorul. Cine creează deplasări pentru oricine (`per_diem:create =
 * all`) alege din tot parcul activ; restul, din mașina alocată lui și din
 * pool — exact mulțimea pe care o poate și conduce. Garda de firmă rămâne
 * `internal.valideaza_deplasare` (0159).
 */
export async function vehiculePentruDeplasare(
  organizationId: string,
  userId: string,
  optiuni: Readonly<{ poateVedeaVehicule: boolean; pentruOricine: boolean }>,
): Promise<readonly VehiculDeplasare[]> {
  if (!optiuni.poateVedeaVehicule) return [];
  const moduleActive = await getEnabledFeatures(organizationId);
  if (!moduleActive.has("fleet")) return [];

  const reduce = (v: Readonly<VehiculDeplasare>): VehiculDeplasare => ({
    id: v.id,
    nr_inmatriculare: v.nr_inmatriculare,
    marca: v.marca,
    model: v.model,
  });

  if (optiuni.pentruOricine) {
    const parcul = await listeazaVehicule(organizationId, {
      status: "activ",
      categorie: null,
      conformitate: null,
      cauta: null,
      cursor: null,
      limita: 100,
    });
    return parcul.randuri.map(reduce);
  }
  const fisaId = await idFisaProprie(organizationId, userId);
  if (fisaId === null) return [];
  const { alocate, pool } = await vehicululMeu(organizationId, fisaId);
  return [...alocate, ...pool].map(reduce);
}
