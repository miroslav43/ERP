// src/lib/queries/rapoarte.ts
// Statistici anuale pentru proprietar: concediu (odihnă/medical), venit
// brut/net, tichete de masă, ore suplimentare — per angajat și agregat pe
// organizație. `payroll_entries` reține deja aceste cifre pe fiecare
// perioadă calculată — nu se re-derivă din `leave_balances`/pontaj, se
// citesc direct de acolo (reutilizare, nu un nou drum de calcul).
import { createServerSupabase } from "@/lib/supabase/server";

export interface StatisticaAngajat {
  readonly employeeId: string;
  readonly fullName: string;
  readonly marca: string;
  readonly zileConcediuOdihna: number;
  readonly zileConcediuMedical: number;
  readonly venitBrutAnual: number;
  readonly venitNetAnual: number;
  readonly ticheteNumar: number;
  readonly ticheteValoare: number;
  readonly oreSuplimentare: number;
}

export interface StatisticiOrganizatie {
  readonly an: number;
  readonly perAngajat: readonly StatisticaAngajat[];
  readonly totalZileConcediuOdihna: number;
  readonly totalZileConcediuMedical: number;
  readonly totalVenitBrutAnual: number;
  readonly totalVenitNetAnual: number;
  readonly totalTicheteNumar: number;
  readonly totalTicheteValoare: number;
  readonly totalOreSuplimentare: number;
}

interface RandIntrare {
  readonly employee_id: string;
  readonly zile_concediu_odihna: number;
  readonly zile_concediu_medical: number;
  readonly brut: number;
  readonly net_de_plata: number;
  readonly nr_tichete: number;
  readonly valoare_tichete: number;
  readonly ore_suplimentare: number;
}

export async function statisticiAnuale(
  organizationId: string,
  an: number,
): Promise<StatisticiOrganizatie> {
  const db = await createServerSupabase();

  const { data: perioade, error: eroarePerioade } = await db
    .from("payroll_periods")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("an", an)
    .is("deleted_at", null)
    .returns<{ id: string }[]>();
  if (eroarePerioade !== null) throw eroarePerioade;

  const idPerioade = (perioade ?? []).map((p) => p.id);
  if (idPerioade.length === 0) {
    return {
      an,
      perAngajat: [],
      totalZileConcediuOdihna: 0,
      totalZileConcediuMedical: 0,
      totalVenitBrutAnual: 0,
      totalVenitNetAnual: 0,
      totalTicheteNumar: 0,
      totalTicheteValoare: 0,
      totalOreSuplimentare: 0,
    };
  }

  const [{ data: intrari, error: eroareIntrari }, { data: angajati, error: eroareAngajati }] =
    await Promise.all([
      db
        .from("payroll_entries")
        .select(
          "employee_id, zile_concediu_odihna, zile_concediu_medical, brut, net_de_plata, nr_tichete, valoare_tichete, ore_suplimentare",
        )
        .eq("organization_id", organizationId)
        .eq("status", "calculat")
        .in("period_id", idPerioade)
        .is("deleted_at", null)
        .returns<RandIntrare[]>(),
      db
        .from("employees")
        .select("id, full_name, marca")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .returns<{ id: string; full_name: string | null; marca: string }[]>(),
    ]);
  if (eroareIntrari !== null) throw eroareIntrari;
  if (eroareAngajati !== null) throw eroareAngajati;

  const numeDupaId = new Map((angajati ?? []).map((a) => [a.id, { full_name: a.full_name, marca: a.marca }]));

  const perAngajatMap = new Map<string, StatisticaAngajat>();
  for (const rand of intrari ?? []) {
    const existent = perAngajatMap.get(rand.employee_id);
    const nume = numeDupaId.get(rand.employee_id);
    const baza: StatisticaAngajat =
      existent ??
      {
        employeeId: rand.employee_id,
        fullName: nume?.full_name ?? "Angajat șters",
        marca: nume?.marca ?? "—",
        zileConcediuOdihna: 0,
        zileConcediuMedical: 0,
        venitBrutAnual: 0,
        venitNetAnual: 0,
        ticheteNumar: 0,
        ticheteValoare: 0,
        oreSuplimentare: 0,
      };
    perAngajatMap.set(rand.employee_id, {
      ...baza,
      zileConcediuOdihna: baza.zileConcediuOdihna + rand.zile_concediu_odihna,
      zileConcediuMedical: baza.zileConcediuMedical + rand.zile_concediu_medical,
      venitBrutAnual: baza.venitBrutAnual + rand.brut,
      venitNetAnual: baza.venitNetAnual + rand.net_de_plata,
      ticheteNumar: baza.ticheteNumar + rand.nr_tichete,
      ticheteValoare: baza.ticheteValoare + rand.valoare_tichete,
      oreSuplimentare: baza.oreSuplimentare + rand.ore_suplimentare,
    });
  }

  const perAngajat = [...perAngajatMap.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));

  const totaluri = perAngajat.reduce(
    (acc, a) => ({
      totalZileConcediuOdihna: acc.totalZileConcediuOdihna + a.zileConcediuOdihna,
      totalZileConcediuMedical: acc.totalZileConcediuMedical + a.zileConcediuMedical,
      totalVenitBrutAnual: acc.totalVenitBrutAnual + a.venitBrutAnual,
      totalVenitNetAnual: acc.totalVenitNetAnual + a.venitNetAnual,
      totalTicheteNumar: acc.totalTicheteNumar + a.ticheteNumar,
      totalTicheteValoare: acc.totalTicheteValoare + a.ticheteValoare,
      totalOreSuplimentare: acc.totalOreSuplimentare + a.oreSuplimentare,
    }),
    {
      totalZileConcediuOdihna: 0,
      totalZileConcediuMedical: 0,
      totalVenitBrutAnual: 0,
      totalVenitNetAnual: 0,
      totalTicheteNumar: 0,
      totalTicheteValoare: 0,
      totalOreSuplimentare: 0,
    },
  );

  return { an, perAngajat, ...totaluri };
}
