// src/lib/queries/payroll.ts
// Citirile modulului de salarizare.

import { numaraZileCerere } from "@/domain/leave/zile-cerere";
import { createServerSupabase } from "@/lib/supabase/server";
import { zileNelucratoare } from "@/lib/queries/leave";

export interface PragDeducere {
  readonly id: string;
  readonly nr_persoane_intretinere_min: number;
  readonly nr_persoane_intretinere_max: number | null;
  readonly venit_brut_max: number;
  readonly valoare: number;
}

export interface SetariSalarizare {
  readonly id: string;
  readonly valabil_de_la: string;
  readonly cota_cas: number;
  readonly cota_cass: number;
  readonly cota_impozit: number;
  readonly cota_cam_angajator: number;
  readonly norma_zilnica_ore: number;
  readonly procent_spor_noapte: number;
  readonly procent_spor_weekend: number;
  readonly procent_ore_suplimentare: number;
  readonly valoare_tichet_masa: number;
  readonly tichete_impozabile: boolean;
  readonly rotunjire_lei: boolean;
  readonly verificat_de_contabil: boolean;
  readonly verificat_la: string | null;
  readonly note: string | null;
  readonly praguri: readonly PragDeducere[];
}

async function incarcaPraguri(
  db: Awaited<ReturnType<typeof createServerSupabase>>,
  settingsId: string,
): Promise<readonly PragDeducere[]> {
  const { data, error } = await db
    .from("payroll_personal_deduction_brackets")
    .select("id, nr_persoane_intretinere_min, nr_persoane_intretinere_max, venit_brut_max, valoare")
    .eq("settings_id", settingsId)
    .is("deleted_at", null)
    .order("ordine", { ascending: true })
    .returns<PragDeducere[]>();
  if (error !== null) throw error;
  return data ?? [];
}

/** Setările exacte referite de o perioadă — reproductibil, nu „cele mai recente". */
export async function citesteSetariPeId(
  organizationId: string,
  id: string,
): Promise<SetariSalarizare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_settings")
    .select(
      "id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator, norma_zilnica_ore, procent_spor_noapte, procent_spor_weekend, procent_ore_suplimentare, valoare_tichet_masa, tichete_impozabile, rotunjire_lei, verificat_de_contabil, verificat_la, note",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Omit<SetariSalarizare, "praguri">>();
  if (error !== null) throw error;
  if (data === null) return null;
  return { ...data, praguri: await incarcaPraguri(db, data.id) };
}

/** Setările valabile pentru o dată — cea mai recentă `valabil_de_la <= data`. */
export async function citesteSetariValabile(
  organizationId: string,
  data: string,
): Promise<SetariSalarizare | null> {
  const db = await createServerSupabase();
  const { data: randuri, error } = await db
    .from("payroll_settings")
    .select(
      "id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator, norma_zilnica_ore, procent_spor_noapte, procent_spor_weekend, procent_ore_suplimentare, valoare_tichet_masa, tichete_impozabile, rotunjire_lei, verificat_de_contabil, verificat_la, note",
    )
    .eq("organization_id", organizationId)
    .lte("valabil_de_la", data)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .returns<Omit<SetariSalarizare, "praguri">[]>();
  if (error !== null) throw error;
  const setari = randuri?.[0];
  if (setari === undefined) return null;

  return { ...setari, praguri: await incarcaPraguri(db, setari.id) };
}

export interface IntrareIstoricSetari {
  readonly id: string;
  readonly valabil_de_la: string;
  readonly verificat_de_contabil: boolean;
}

export async function listeazaIstoricSetari(
  organizationId: string,
): Promise<readonly IntrareIstoricSetari[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_settings")
    .select("id, valabil_de_la, verificat_de_contabil")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("valabil_de_la", { ascending: false })
    .returns<IntrareIstoricSetari[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface RandPerioada {
  readonly id: string;
  readonly an: number;
  readonly luna: number;
  readonly status: "draft" | "calculat" | "aprobat" | "inchis";
  readonly total_brut: number;
  readonly total_net: number;
  readonly total_cost_angajator: number;
  readonly data_plata: string | null;
}

export async function listeazaPerioade(organizationId: string): Promise<readonly RandPerioada[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_periods")
    .select("id, an, luna, status, total_brut, total_net, total_cost_angajator, data_plata")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("an", { ascending: false })
    .order("luna", { ascending: false })
    .returns<RandPerioada[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface DetaliuPerioada extends RandPerioada {
  readonly attendance_period_id: string;
  readonly settings_id: string;
  readonly calculat_la: string | null;
  readonly aprobat_la: string | null;
  readonly inchis_la: string | null;
  readonly observatii: string | null;
}

export async function citestePerioada(
  organizationId: string,
  id: string,
): Promise<DetaliuPerioada | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_periods")
    .select(
      "id, an, luna, status, total_brut, total_net, total_cost_angajator, data_plata, attendance_period_id, settings_id, calculat_la, aprobat_la, inchis_la, observatii",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<DetaliuPerioada>();
  if (error !== null) throw error;
  return data;
}

export interface RandInregistrare {
  readonly id: string;
  readonly employee_id: string;
  readonly angajat: Readonly<{ full_name: string; marca: string }> | null;
  readonly brut: number;
  readonly net: number;
  readonly net_de_plata: number;
  readonly cost_total_angajator: number;
}

export async function listeazaInregistrari(
  periodId: string,
): Promise<readonly RandInregistrare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_entries")
    .select(
      "id, employee_id, brut, net, net_de_plata, cost_total_angajator, angajat:employees!employee_id(full_name, marca)",
    )
    .eq("period_id", periodId)
    .is("deleted_at", null)
    .order("employee_id", { ascending: true })
    .returns<RandInregistrare[]>();
  if (error !== null) throw error;
  return data ?? [];
}

export interface DetaliuInregistrare {
  readonly id: string;
  readonly employee_id: string;
  readonly angajat: Readonly<{ full_name: string; marca: string }> | null;
  readonly zile_lucratoare_luna: number;
  readonly zile_lucrate: number;
  readonly zile_concediu_odihna: number;
  readonly zile_concediu_medical: number;
  readonly zile_absenta_nemotivata: number;
  readonly ore_lucrate: number;
  readonly ore_suplimentare: number;
  readonly ore_noapte: number;
  readonly baza_salariu: number;
  readonly suma_ore_suplimentare: number;
  readonly spor_noapte: number;
  readonly prime_total: number;
  readonly brut: number;
  readonly nr_tichete: number;
  readonly valoare_tichete: number;
  readonly baza_cas_cass: number;
  readonly cas: number;
  readonly cass: number;
  readonly deducere_personala: number;
  readonly baza_impozit: number;
  readonly impozit: number;
  readonly cam_angajator: number;
  readonly net: number;
  readonly retineri_total: number;
  readonly net_de_plata: number;
  readonly cost_total_angajator: number;
  readonly calc_breakdown: readonly Readonly<{ pas: string; valoare: number }>[];
  readonly calc_warnings: readonly Readonly<{ cod: string; mesaj: string }>[];
  readonly calculat_la: string | null;
}

const COLOANE_INREGISTRARE =
  "id, employee_id, angajat:employees!employee_id(full_name, marca), zile_lucratoare_luna, zile_lucrate, zile_concediu_odihna, zile_concediu_medical, zile_absenta_nemotivata, ore_lucrate, ore_suplimentare, ore_noapte, baza_salariu, suma_ore_suplimentare, spor_noapte, prime_total, brut, nr_tichete, valoare_tichete, baza_cas_cass, cas, cass, deducere_personala, baza_impozit, impozit, cam_angajator, net, retineri_total, net_de_plata, cost_total_angajator, calc_breakdown, calc_warnings, calculat_la";

export async function citesteInregistrare(
  organizationId: string,
  id: string,
): Promise<DetaliuInregistrare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_entries")
    .select(COLOANE_INREGISTRARE)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<DetaliuInregistrare>();
  if (error !== null) throw error;
  return data;
}

/** Fluturașul propriu — cel mai recent, dintr-o perioadă aprobată sau închisă. */
export async function citesteFluturasulPropriu(
  organizationId: string,
  employeeId: string,
): Promise<DetaliuInregistrare | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_entries")
    .select(COLOANE_INREGISTRARE)
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("calculat_la", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<DetaliuInregistrare>();
  if (error !== null) throw error;
  // Niciun filtru pe starea perioadei aici, deliberat: `payroll_entries_select`
  // (0027) o impune deja la nivel de RLS pentru scope „own” — un angajat obișnuit
  // nu poate primi rândul decât dacă perioada e „aprobat”/„inchis”. Un filtru
  // JS duplicat ar cere embed pe `payroll_periods`, care are propriul RLS
  // („all”) — exact bug-ul reprodus și închis în 0027.
  return data;
}

// ── Zile lucrătoare, pentru numărătoarea din calcul ─────────────────────────

/**
 * Zilele lucrătoare ale unei luni calendaristice, cu aceeași logică — inclusiv
 * `zi_recuperare` — ca `app.este_zi_lucratoare` din bază. NU folosește
 * `calculeazaZileLucratoare` direct pe sărbători: acela nu cunoaște zilele de
 * recuperare. Vezi avertismentul din `domain/leave/zile-cerere.ts`.
 */
export async function zileLucratoareLuna(
  organizationId: string,
  an: number,
  luna: number,
): Promise<number> {
  const { nationale, organizatie } = await zileNelucratoare(organizationId, an, an);
  const liberSuplimentar = organizatie.filter((z) => z.tip === "liber_suplimentar").map((z) => z.data);
  const zileRecuperare = organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data);
  const sarbatoriRo = nationale.map((z) => z.data);

  const prima = `${String(an)}-${String(luna).padStart(2, "0")}-01`;
  const ultimaZi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  const finala = `${String(an)}-${String(luna).padStart(2, "0")}-${String(ultimaZi).padStart(2, "0")}`;

  const rezultat = numaraZileCerere(
    prima,
    finala,
    "zi_intreaga",
    "zi_intreaga",
    sarbatoriRo,
    liberSuplimentar,
    zileRecuperare,
  );
  return rezultat.zileLucratoare;
}

// ── Angajați activi și pontajul lor agregat pentru o perioadă ──────────────

export interface AngajatDeCalculat {
  readonly employee_id: string;
  readonly contract_id: string;
  readonly salariu_baza: number;
  readonly nr_persoane_intretinere: number;
}

export async function angajatiActiviCuContract(
  organizationId: string,
): Promise<readonly AngajatDeCalculat[]> {
  const db = await createServerSupabase();
  interface Bruta {
    readonly id: string;
    readonly nr_persoane_intretinere: number;
    readonly contracts: readonly Readonly<{
      id: string;
      salariu_baza: number;
      status: string;
      este_act_aditional: boolean;
    }>[];
  }
  const { data, error } = await db
    .from("employees")
    .select(
      "id, nr_persoane_intretinere, contracts:employment_contracts!employee_id(id, salariu_baza, status, este_act_aditional)",
    )
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .is("deleted_at", null)
    .returns<Bruta[]>();
  if (error !== null) throw error;

  const rezultat: AngajatDeCalculat[] = [];
  for (const angajat of data ?? []) {
    const contract = angajat.contracts.find((c) => c.status === "activ" && !c.este_act_aditional);
    if (contract === undefined) continue;
    rezultat.push({
      employee_id: angajat.id,
      contract_id: contract.id,
      salariu_baza: contract.salariu_baza,
      nr_persoane_intretinere: angajat.nr_persoane_intretinere,
    });
  }
  return rezultat;
}

export interface PontajAgregat {
  readonly zile_lucrate: number;
  readonly ore_lucrate: number;
  readonly ore_suplimentare: number;
  readonly ore_noapte: number;
  readonly zile_concediu_odihna: number;
  readonly zile_concediu_medical: number;
  readonly zile_absenta_nemotivata: number;
}

const PONTAJ_GOL: PontajAgregat = {
  zile_lucrate: 0,
  ore_lucrate: 0,
  ore_suplimentare: 0,
  ore_noapte: 0,
  zile_concediu_odihna: 0,
  zile_concediu_medical: 0,
  zile_absenta_nemotivata: 0,
};

/** Pontajul agregat, pe angajat, pentru toată perioada de pontaj legată. */
export async function pontajAgregatPerioada(
  organizationId: string,
  attendancePeriodId: string,
): Promise<ReadonlyMap<string, PontajAgregat>> {
  const db = await createServerSupabase();
  interface RandBrut {
    readonly employee_id: string;
    readonly tip_zi: string;
    readonly ore_lucrate: number;
    readonly ore_suplimentare: number;
    readonly ore_noapte: number;
  }
  const { data, error } = await db
    .from("attendance_entries")
    .select("employee_id, tip_zi, ore_lucrate, ore_suplimentare, ore_noapte")
    .eq("organization_id", organizationId)
    .eq("period_id", attendancePeriodId)
    .is("deleted_at", null)
    .returns<RandBrut[]>();
  if (error !== null) throw error;

  const rezultat = new Map<string, PontajAgregat>();
  for (const rand of data ?? []) {
    const curent = rezultat.get(rand.employee_id) ?? { ...PONTAJ_GOL };
    const urmatorul: { -readonly [K in keyof PontajAgregat]: PontajAgregat[K] } = { ...curent };
    if (rand.tip_zi === "lucratoare" || rand.tip_zi === "delegatie") {
      urmatorul.zile_lucrate += 1;
      urmatorul.ore_lucrate += rand.ore_lucrate;
      urmatorul.ore_suplimentare += rand.ore_suplimentare;
      urmatorul.ore_noapte += rand.ore_noapte;
    } else if (rand.tip_zi === "concediu") {
      urmatorul.zile_concediu_odihna += 1;
    } else if (rand.tip_zi === "medical") {
      urmatorul.zile_concediu_medical += 1;
    } else if (rand.tip_zi === "absenta_nemotivata") {
      urmatorul.zile_absenta_nemotivata += 1;
    }
    rezultat.set(rand.employee_id, urmatorul);
  }
  return rezultat;
}
