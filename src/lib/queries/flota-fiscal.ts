// src/lib/queries/flota-fiscal.ts
// Citirile pentru fiscalul flotei (0202, F10): perioadele de regim fiscal și
// de normă ale unui vehicul, luna fiscală a parcului, regimul de impozitare al
// firmei și faptele sugestiei de avantaj în natură.
//
// Fișier separat de `fleet.ts`, pe care îl scriu și fazele paralele ale
// flotei. NU se adaugă filtre de scope: le pune RLS (`vehicles:read = all` pe
// tabelele fiscale) sau funcția care își judecă singură apelantul
// (`public.avantaj_natura_flota`, pe `payroll:read = all`).

import "server-only";

import type {
  ExceptieFiscala,
  FapteAvantaj,
  LunaVehicul,
  RegimFiscal,
  RegimImpozitare,
  TitluFolosinta,
} from "@/domain/fleet/fiscal";
import { createServerSupabase } from "@/lib/supabase/server";

export interface RandRegimFiscal {
  readonly id: string;
  readonly valabil_de_la: string;
  readonly regim: RegimFiscal;
  readonly exceptie: ExceptieFiscala | null;
  readonly motiv: string;
  readonly titlu_folosinta: TitluFolosinta;
  readonly proprietar_employee_id: string | null;
  readonly chirie_lunara: number | null;
  readonly contract_numar: string | null;
  readonly contract_data: string | null;
  readonly proprietar: Readonly<{ full_name: string | null }> | null;
}

/** Perioadele de regim fiscal ale vehiculului, cea mai nouă întâi. */
export async function regimurileVehiculului(
  organizationId: string,
  vehicleId: string,
): Promise<readonly RandRegimFiscal[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_fiscal_regimes")
    .select(
      "id, valabil_de_la, regim, exceptie, motiv, titlu_folosinta, proprietar_employee_id, chirie_lunara, contract_numar, contract_data, proprietar:employees!vfr_proprietar_fk(full_name)",
    )
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(200)
    .returns<RandRegimFiscal[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface RandNormaConsum {
  readonly id: string;
  readonly valabil_de_la: string;
  readonly l_100km: number;
  readonly decizie_numar: string | null;
  readonly decizie_data: string | null;
  readonly observatii: string | null;
}

/** Normele proprii de consum ale vehiculului, cea mai nouă întâi. */
export async function normeleVehiculului(
  organizationId: string,
  vehicleId: string,
): Promise<readonly RandNormaConsum[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("vehicle_consumption_norms")
    .select("id, valabil_de_la, l_100km, decizie_numar, decizie_data, observatii")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(200)
    .returns<RandNormaConsum[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/** Un rând al lunii fiscale, cu nullabilitatea ADEVĂRATĂ. */
export interface RandLunaFiscala extends LunaVehicul {
  readonly vehicle_id: string;
  readonly nr_inmatriculare: string;
  readonly marca: string;
  readonly model: string;
  readonly categorie: string;
  readonly status: string;
  readonly masa_maxima_kg: number | null;
  readonly numar_locuri: number | null;
  readonly exceptie: ExceptieFiscala | null;
  readonly regim_de_la: string | null;
  readonly norma_l_100km: number | null;
  readonly norma_de_la: string | null;
  readonly km_aprobati: number;
}

/**
 * Luna fiscală a parcului (`luna` = `AAAA-LL`), pe vehiculele vizibile
 * apelantului. Funcția întoarce un rând pe vehicul: sub `max_rows` cât timp
 * firma are sub 1.000 de vehicule (cea mai mare are azi câteva).
 */
export async function lunaFiscala(
  organizationId: string,
  luna: string,
): Promise<readonly RandLunaFiscala[]> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("flota_fiscal_luna", {
    p_organization_id: organizationId,
    p_luna: `${luna}-01`,
  });
  if (error !== null) throw error;
  // Generatorul tipează coloanele unui `returns table` ca NON-null; regimul,
  // excepția, norma, masa și locurile sunt des `null`. Copierea LĂRGEȘTE tipul.
  return (data ?? []).map((r): RandLunaFiscala => ({
    vehicle_id: r.vehicle_id,
    nr_inmatriculare: r.nr_inmatriculare,
    marca: r.marca,
    model: r.model,
    categorie: r.categorie,
    status: r.status,
    masa_maxima_kg: r.masa_maxima_kg as number | null,
    numar_locuri: r.numar_locuri as number | null,
    regim: r.regim as RegimFiscal | null,
    exceptie: r.exceptie as ExceptieFiscala | null,
    titlu_folosinta: r.titlu_folosinta as TitluFolosinta | null,
    regim_de_la: r.regim_de_la as string | null,
    zile_luna: r.zile_luna,
    zile_integral: r.zile_integral,
    zile_fara_regim: r.zile_fara_regim,
    norma_l_100km: r.norma_l_100km as number | null,
    norma_de_la: r.norma_de_la as string | null,
    foi_aprobate: r.foi_aprobate,
    foi_neaprobate: r.foi_neaprobate,
    km_aprobati: r.km_aprobati,
  }));
}

/** Regimul de impozitare al firmei, sau `null` (nestabilit). */
export async function regimImpozitareFirma(
  organizationId: string,
): Promise<RegimImpozitare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("organizations")
    .select("regim_impozitare")
    .eq("id", organizationId)
    .maybeSingle<{ regim_impozitare: RegimImpozitare | null }>();
  if (error !== null) throw error;
  return data?.regim_impozitare ?? null;
}

export interface FapteAvantajAlocare extends FapteAvantaj {
  readonly assignment_id: string;
  readonly vehicle_id: string;
  readonly de_la: string;
  readonly pana_la: string | null;
}

/**
 * Alocările cu folosință personală ale angajatului în luna dată (`AAAA-LL`),
 * cu faptele fiscale ale vehiculului. Cine n-are `payroll:read = all`, sau o
 * firmă cu Flota ori Salarizarea oprite, primește listă goală, fără eroare.
 */
export async function avantajeNaturaAuto(
  organizationId: string,
  employeeId: string,
  luna: string,
): Promise<readonly FapteAvantajAlocare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db.rpc("avantaj_natura_flota", {
    p_organization_id: organizationId,
    p_employee_id: employeeId,
    p_luna: `${luna}-01`,
  });
  if (error !== null) throw error;
  return (data ?? []).map((r): FapteAvantajAlocare => ({
    assignment_id: r.assignment_id,
    vehicle_id: r.vehicle_id,
    vehicul_nr: r.vehicul_nr,
    de_la: r.de_la,
    pana_la: r.pana_la as string | null,
    regim: r.regim as RegimFiscal | null,
    titlu_folosinta: r.titlu_folosinta as TitluFolosinta | null,
    valoare_intrare: r.valoare_intrare as number | null,
    chirie_lunara: r.chirie_lunara as number | null,
    regim_impozitare: r.regim_impozitare as RegimImpozitare | null,
  }));
}
