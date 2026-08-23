// src/lib/queries/rapoarte.ts
// Statistici anuale pentru proprietar: concediu (odihnă/medical), venit
// brut/net, tichete de masă, ore suplimentare — per angajat și agregat pe
// organizație. `payroll_entries` reține deja aceste cifre pe fiecare
// perioadă calculată — nu se re-derivă din `leave_balances`/pontaj, se
// citesc direct de acolo (reutilizare, nu un nou drum de calcul).
import { createServerSupabase } from "@/lib/supabase/server";

import { citesteTot } from "./citeste-tot";

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

/** Totalurile unei luni, citite de pe rândul de perioadă — nu re-agregate. */
export interface StatisticaLuna {
  readonly luna: number;
  readonly status: "draft" | "calculat" | "aprobat" | "inchis";
  readonly totalBrut: number;
  readonly totalNet: number;
  readonly totalCostAngajator: number;
}

export interface StatisticiOrganizatie {
  readonly an: number;
  readonly perAngajat: readonly StatisticaAngajat[];
  /** Seria lunară, pentru grafic. Sortată crescător, doar lunile care există. */
  readonly perLuna: readonly StatisticaLuna[];
  /**
   * Lunile a căror perioadă e încă `draft`. Cifrele lor INTRĂ în totalurile
   * anuale — asta era deja comportamentul — dar pagina trebuie să poată spune
   * că o parte din an nu e finalizată. Un total anual prezentat ca definitiv,
   * din care trei luni sunt ciorne, e o cifră care se va schimba fără ca nimeni
   * să fi greșit.
   */
  readonly luniInCiorna: readonly number[];
  readonly totalZileConcediuOdihna: number;
  readonly totalZileConcediuMedical: number;
  readonly totalVenitBrutAnual: number;
  readonly totalVenitNetAnual: number;
  readonly totalTicheteNumar: number;
  readonly totalTicheteValoare: number;
  readonly totalOreSuplimentare: number;
}

interface RandPerioada {
  readonly id: string;
  readonly luna: number;
  readonly status: StatisticaLuna["status"];
  readonly total_brut: number;
  readonly total_net: number;
  readonly total_cost_angajator: number;
}

interface RandIntrare {
  // `id` e cheia keyset a citirii complete — vezi `citesteTot`.
  readonly id: string;
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
    .select("id, luna, status, total_brut, total_net, total_cost_angajator")
    .eq("organization_id", organizationId)
    .eq("an", an)
    .is("deleted_at", null)
    .order("luna", { ascending: true })
    .returns<RandPerioada[]>();
  if (eroarePerioade !== null) throw eroarePerioade;

  const idPerioade = (perioade ?? []).map((p) => p.id);
  const perLuna: readonly StatisticaLuna[] = (perioade ?? []).map((p) => ({
    luna: p.luna,
    status: p.status,
    totalBrut: p.total_brut,
    totalNet: p.total_net,
    totalCostAngajator: p.total_cost_angajator,
  }));
  const luniInCiorna = perLuna.filter((l) => l.status === "draft").map((l) => l.luna);

  if (idPerioade.length === 0) {
    return {
      an,
      perAngajat: [],
      perLuna: [],
      luniInCiorna: [],
      totalZileConcediuOdihna: 0,
      totalZileConcediuMedical: 0,
      totalVenitBrutAnual: 0,
      totalVenitNetAnual: 0,
      totalTicheteNumar: 0,
      totalTicheteValoare: 0,
      totalOreSuplimentare: 0,
    };
  }

  /*
   * Amândouă citirile trec prin `citesteTot`. Înainte erau două `select` simple,
   * iar PostgREST le tăia TĂCUT la 1000 de rânduri: cu douăsprezece perioade
   * într-un an, plafonul se atingea pe la 84 de angajați, iar de acolo încolo
   * „venitul brut anual al firmei" era pur și simplu mai mic. Fără eroare,
   * fără avertizare, fără nimic de observat în interfață.
   */
  const [intrari, angajati] = await Promise.all([
    citesteTot<RandIntrare>(
      (dupa, pas) => {
        const q = db
          .from("payroll_entries")
          .select(
            "id, employee_id, zile_concediu_odihna, zile_concediu_medical, brut, net_de_plata, nr_tichete, valoare_tichete, ore_suplimentare",
          )
          .eq("organization_id", organizationId)
          .eq("status", "calculat")
          .in("period_id", idPerioade)
          .is("deleted_at", null);
        return (dupa === null ? q : q.gt("id", dupa))
          .order("id", { ascending: true })
          .limit(pas)
          .returns<RandIntrare[]>();
      },
      (r) => r.id,
      { nume: "intrări de salarizare" },
    ),
    citesteTot<{ id: string; full_name: string | null; marca: string }>(
      (dupa, pas) => {
        const q = db
          .from("employees")
          .select("id, full_name, marca")
          .eq("organization_id", organizationId)
          .is("deleted_at", null);
        return (dupa === null ? q : q.gt("id", dupa))
          .order("id", { ascending: true })
          .limit(pas)
          .returns<{ id: string; full_name: string | null; marca: string }[]>();
      },
      (a) => a.id,
      { nume: "angajați" },
    ),
  ]);

  const numeDupaId = new Map(
    angajati.map((a) => [a.id, { full_name: a.full_name, marca: a.marca }]),
  );

  const perAngajatMap = new Map<string, StatisticaAngajat>();
  for (const rand of intrari) {
    const existent = perAngajatMap.get(rand.employee_id);
    const nume = numeDupaId.get(rand.employee_id);
    const baza: StatisticaAngajat = existent ?? {
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

  const perAngajat = [...perAngajatMap.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );

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

  return { an, perAngajat, perLuna, luniInCiorna, ...totaluri };
}
