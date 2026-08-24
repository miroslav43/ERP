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

/**
 * Totalurile unei luni, agregate din ACELEAȘI rânduri din care iese și totalul
 * anual de deasupra graficului.
 *
 * Veneau de pe rândul de perioadă (`payroll_periods.total_brut` și frații lui),
 * adică din altă sursă decât cifrele mari ale ecranului. Două surse pentru
 * aceeași mărime pot să difere fără ca cineva să afle care e greșită: rândul de
 * perioadă se scrie o singură dată, la calcul (`salarizare/actions.ts`, UPDATE-ul
 * care trece perioada în `calculat`), și nu se mai rescrie dacă o intrare e
 * ștearsă logic după aceea.
 */
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
  /**
   * Seria lunară, pentru grafic. Sortată crescător.
   *
   * Conține DOAR lunile cu cel puțin o intrare calculată. O lună fără niciun
   * calcul lipsește din serie; nu apare ca zero. Un zero desenat spune „am
   * măsurat și a ieșit nimic", iar aici nu s-a măsurat — într-un raport de bani
   * diferența e între o coloană lipsă și o firmă care pare că n-a plătit pe
   * nimeni în martie.
   */
  readonly perLuna: readonly StatisticaLuna[];
  /**
   * Lunile CU cifre a căror perioadă e totuși încă `draft`: perioade calculate
   * și apoi redeschise. `payroll.period.reopen` duce `calculat` → `draft` fără
   * să atingă intrările deja scrise (0026:346-357 golește doar `calculat_la` și
   * `calculat_de`), deci cifrele rămân și INTRĂ în totalurile anuale — dar se
   * vor schimba la recalculare.
   */
  readonly luniInCiorna: readonly number[];
  /**
   * Lunile care au perioadă deschisă, dar NICIO intrare calculată.
   *
   * Nu apar nicăieri în cifre, și nu se confundă cu lunile în ciornă: acolo
   * există un rezultat care se poate schimba, aici nu există niciun rezultat.
   */
  readonly luniNecalculate: readonly number[];
  readonly totalZileConcediuOdihna: number;
  readonly totalZileConcediuMedical: number;
  readonly totalVenitBrutAnual: number;
  readonly totalVenitNetAnual: number;
  /**
   * Brutul plus contribuțiile datorate de firmă, însumat din `payroll_entries`.
   *
   * Venea de pe rândul de perioadă, adică din altă sursă decât brutul și netul.
   * Pagina scădea una din alta ca să afle „contribuțiile firmei"; dacă sursa de
   * cost rămânea în urmă, diferența ieșea NEGATIVĂ, iar inelul care o desenează
   * aruncă feliile negative din desen dar le păstrează în numitor
   * (`grafice/inel.tsx`: `total` se calculează înaintea filtrului `> 0`) —
   * procente peste 100 % și un total fals în mijloc, fără nicio eroare. Acum
   * cele trei vin din același rând, iar `payroll_entries_valori_ck` (0026:200)
   * garantează pe fiecare `cost_total_angajator >= brut`.
   */
  readonly totalCostAngajatorAnual: number;
  readonly totalTicheteNumar: number;
  readonly totalTicheteValoare: number;
  readonly totalOreSuplimentare: number;
}

interface RandPerioada {
  readonly id: string;
  readonly luna: number;
  readonly status: StatisticaLuna["status"];
}

interface RandIntrare {
  // `id` e cheia keyset a citirii complete — vezi `citesteTot`.
  readonly id: string;
  readonly period_id: string;
  readonly employee_id: string;
  readonly zile_concediu_odihna: number;
  readonly zile_concediu_medical: number;
  readonly brut: number;
  readonly net_de_plata: number;
  readonly cost_total_angajator: number;
  readonly nr_tichete: number;
  readonly valoare_tichete: number;
  readonly ore_suplimentare: number;
}

/**
 * Anii pentru care organizația chiar are perioade de salarizare.
 *
 * Selectorul de an era o listă fixă de cinci ani calculată din ceasul
 * serverului. O firmă înrolată anul acesta primea patru butoane care duceau
 * garantat la starea goală, iar o firmă cu date din 2019 nu-și putea atinge
 * arhiva din interfață deloc, deși validarea din pagină accepta `?an=2019`.
 *
 * Nu are `citesteTot`: o organizație are cel mult douăsprezece perioade pe an,
 * deci plafonul de 1000 al PostgREST s-ar atinge abia după 83 de ani de
 * activitate. Dacă vreodată se apropie, `.limit()` de mai jos face tăierea
 * vizibilă în cod, nu tăcută pe server.
 */
export async function aniCuPerioade(organizationId: string): Promise<readonly number[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_periods")
    .select("an")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("an", { ascending: false })
    .limit(600)
    .returns<{ an: number }[]>();
  if (error !== null) throw error;
  return [...new Set((data ?? []).map((r) => r.an))].sort((a, b) => b - a);
}

export async function statisticiAnuale(
  organizationId: string,
  an: number,
): Promise<StatisticiOrganizatie> {
  const db = await createServerSupabase();

  const { data: perioade, error: eroarePerioade } = await db
    .from("payroll_periods")
    .select("id, luna, status")
    .eq("organization_id", organizationId)
    .eq("an", an)
    .is("deleted_at", null)
    .order("luna", { ascending: true })
    .returns<RandPerioada[]>();
  if (eroarePerioade !== null) throw eroarePerioade;

  const randuriPerioada = perioade ?? [];
  const idPerioade = randuriPerioada.map((p) => p.id);

  if (idPerioade.length === 0) {
    return {
      an,
      perAngajat: [],
      perLuna: [],
      luniInCiorna: [],
      luniNecalculate: [],
      totalZileConcediuOdihna: 0,
      totalZileConcediuMedical: 0,
      totalVenitBrutAnual: 0,
      totalVenitNetAnual: 0,
      totalCostAngajatorAnual: 0,
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
            "id, period_id, employee_id, zile_concediu_odihna, zile_concediu_medical, brut, " +
              "net_de_plata, cost_total_angajator, nr_tichete, valoare_tichete, ore_suplimentare",
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
  // Acumulatorul lunar, pe `period_id`. O lună rămâne în afara hărții cât timp
  // n-a sosit nicio intrare calculată de-a ei — de acolo iese, mai jos,
  // distincția între „în ciornă, cu cifre" și „necalculată, fără nimic".
  const perPerioada = new Map<string, { brut: number; net: number; cost: number }>();

  for (const rand of intrari) {
    const lunar = perPerioada.get(rand.period_id) ?? { brut: 0, net: 0, cost: 0 };
    perPerioada.set(rand.period_id, {
      brut: lunar.brut + rand.brut,
      net: lunar.net + rand.net_de_plata,
      cost: lunar.cost + rand.cost_total_angajator,
    });

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

  const perLuna: readonly StatisticaLuna[] = randuriPerioada.flatMap((p) => {
    const lunar = perPerioada.get(p.id);
    if (lunar === undefined) return [];
    return [
      {
        luna: p.luna,
        status: p.status,
        totalBrut: lunar.brut,
        totalNet: lunar.net,
        totalCostAngajator: lunar.cost,
      },
    ];
  });

  const luniInCiorna = perLuna.filter((l) => l.status === "draft").map((l) => l.luna);
  const luniNecalculate = randuriPerioada.filter((p) => !perPerioada.has(p.id)).map((p) => p.luna);

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

  return {
    an,
    perAngajat,
    perLuna,
    luniInCiorna,
    luniNecalculate,
    totalCostAngajatorAnual: perLuna.reduce((s, l) => s + l.totalCostAngajator, 0),
    ...totaluri,
  };
}
