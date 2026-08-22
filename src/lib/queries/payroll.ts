// src/lib/queries/payroll.ts
// Citirile modulului de salarizare.

import { numaraZileCerere } from "@/domain/leave/zile-cerere";
import type { TaxExemptionSnapshot } from "@/domain/payroll/calc";
import { contractEfectiv } from "@/domain/payroll/contract";
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
  readonly tichete_supuse_cass: boolean;
  readonly rotunjire_lei: boolean;
  readonly salariu_minim_brut: number;
  readonly aplica_minim_contributii: boolean;
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
      "id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator, norma_zilnica_ore, procent_spor_noapte, procent_spor_weekend, procent_ore_suplimentare, valoare_tichet_masa, tichete_impozabile, tichete_supuse_cass, rotunjire_lei, salariu_minim_brut, aplica_minim_contributii, verificat_de_contabil, verificat_la, note",
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
      "id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator, norma_zilnica_ore, procent_spor_noapte, procent_spor_weekend, procent_ore_suplimentare, valoare_tichet_masa, tichete_impozabile, tichete_supuse_cass, rotunjire_lei, salariu_minim_brut, aplica_minim_contributii, verificat_de_contabil, verificat_la, note",
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

export async function listeazaInregistrari(periodId: string): Promise<readonly RandInregistrare[]> {
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
  readonly period_id: string;
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
  readonly scutire_fiscala: number;
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
  "id, period_id, employee_id, angajat:employees!employee_id(full_name, marca), zile_lucratoare_luna, zile_lucrate, zile_concediu_odihna, zile_concediu_medical, zile_absenta_nemotivata, ore_lucrate, ore_suplimentare, ore_noapte, baza_salariu, suma_ore_suplimentare, spor_noapte, prime_total, brut, nr_tichete, valoare_tichete, baza_cas_cass, cas, cass, deducere_personala, scutire_fiscala, baza_impozit, impozit, cam_angajator, net, retineri_total, net_de_plata, cost_total_angajator, calc_breakdown, calc_warnings, calculat_la";

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
  const liberSuplimentar = organizatie
    .filter((z) => z.tip === "liber_suplimentar")
    .map((z) => z.data);
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

/** Marginile lunii ca șiruri 'AAAA-LL-ZZ' — fără a construi vreun `Date` local. */
export function marginileLunii(an: number, luna: number): { prima: string; ultima: string } {
  const ll = String(luna).padStart(2, "0");
  const zz = String(new Date(Date.UTC(an, luna, 0)).getUTCDate()).padStart(2, "0");
  return { prima: `${String(an)}-${ll}-01`, ultima: `${String(an)}-${ll}-${zz}` };
}

export interface AngajatDeCalculat {
  readonly employee_id: string;
  /** Rândul care dă termenii — actul adițional aplicabil, dacă există. */
  readonly contract_id: string;
  /** Contractul de bază al lanțului, cel raportat în REVISAL. */
  readonly contract_de_baza_id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly salariu_baza: number;
  readonly norma_ore_zi: number;
  readonly norma_ore_saptamana: number;
  readonly nr_persoane_intretinere: number;
  readonly contract_schimbat_in_luna: boolean;
}

export interface AngajatFaraContract {
  readonly employee_id: string;
  readonly full_name: string;
  readonly marca: string;
}

export interface RezultatAngajatiDeCalculat {
  readonly angajati: readonly AngajatDeCalculat[];
  /**
   * Angajați activi pentru care nu s-a găsit niciun contract aplicabil lunii.
   * Se întorc SEPARAT, nu se sar tăcut: varianta veche îi elimina cu `continue`,
   * iar oamenii aceștia pur și simplu nu apăreau pe statul de plată.
   */
  readonly faraContract: readonly AngajatFaraContract[];
  /** Citirea a atins plafonul de siguranță — cifrele NU sunt complete. */
  readonly trunchiat: boolean;
}

const PAGINA_ANGAJATI = 500;
/** ~50.000 de angajați. Peste atât, ceva e în neregulă, nu e o firmă mare. */
const MAXIM_PAGINI = 100;

/**
 * Angajații activi și contractul lor EFECTIV în luna dată.
 *
 * Două defecte reparate față de varianta anterioară:
 *
 * 1. Se citeau doar contractele cu `este_act_aditional = false`, deci o mărire
 *    de salariu (care se face exact printr-un act adițional) nu ajungea
 *    niciodată în calcul. Acum se citește tot lanțul, iar alegerea o face
 *    `contractEfectiv()` — funcție pură, testată separat.
 * 2. Citirea nu era paginată. PostgREST taie tăcut la 1000 de rânduri
 *    (`max_rows`, supabase/config.toml), deci de la al 1001-lea angajat lista
 *    se scurta fără nicio eroare. Acum se parcurge în pagini după `id`.
 */
export async function angajatiActiviCuContract(
  organizationId: string,
  an: number,
  luna: number,
): Promise<RezultatAngajatiDeCalculat> {
  const db = await createServerSupabase();
  const { prima, ultima } = marginileLunii(an, luna);

  interface ContractBrut {
    readonly id: string;
    readonly este_act_aditional: boolean;
    readonly parent_contract_id: string | null;
    readonly status: string;
    readonly valabil_de_la: string;
    readonly valabil_pana: string | null;
    readonly data_contract: string;
    readonly salariu_baza: number;
    readonly norma_ore_zi: number;
    readonly norma_ore_saptamana: number;
  }
  interface Bruta {
    readonly id: string;
    readonly full_name: string;
    readonly marca: string;
    readonly nr_persoane_intretinere: number;
    readonly contracts: readonly ContractBrut[];
  }

  const angajati: AngajatDeCalculat[] = [];
  const faraContract: AngajatFaraContract[] = [];
  let dupaId: string | null = null;
  let trunchiat = true;

  for (let pagina = 0; pagina < MAXIM_PAGINI; pagina += 1) {
    let interogare = db
      .from("employees")
      .select(
        "id, full_name, marca, nr_persoane_intretinere, contracts:employment_contracts!employee_id(id, este_act_aditional, parent_contract_id, status, valabil_de_la, valabil_pana, data_contract, salariu_baza, norma_ore_zi, norma_ore_saptamana)",
      )
      .eq("organization_id", organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .limit(PAGINA_ANGAJATI);
    if (dupaId !== null) interogare = interogare.gt("id", dupaId);

    const { data, error } = await interogare.returns<Bruta[]>();
    if (error !== null) throw error;
    const lot = data ?? [];

    for (const angajat of lot) {
      const efectiv = contractEfectiv(
        angajat.contracts.map((c) => ({
          id: c.id,
          esteActAditional: c.este_act_aditional,
          parentContractId: c.parent_contract_id,
          status: c.status,
          valabilDeLa: c.valabil_de_la,
          valabilPana: c.valabil_pana,
          dataContract: c.data_contract,
          salariuBaza: c.salariu_baza,
          normaOreZi: c.norma_ore_zi,
          normaOreSaptamana: c.norma_ore_saptamana,
        })),
        prima,
        ultima,
      );
      if (efectiv === null) {
        faraContract.push({
          employee_id: angajat.id,
          full_name: angajat.full_name,
          marca: angajat.marca,
        });
        continue;
      }
      angajati.push({
        employee_id: angajat.id,
        contract_id: efectiv.contractId,
        contract_de_baza_id: efectiv.contractDeBazaId,
        full_name: angajat.full_name,
        marca: angajat.marca,
        salariu_baza: efectiv.salariuBaza,
        norma_ore_zi: efectiv.normaOreZi,
        norma_ore_saptamana: efectiv.normaOreSaptamana,
        nr_persoane_intretinere: angajat.nr_persoane_intretinere,
        contract_schimbat_in_luna: efectiv.schimbatInLuna,
      });
    }

    if (lot.length < PAGINA_ANGAJATI) {
      trunchiat = false;
      break;
    }
    dupaId = lot[lot.length - 1]?.id ?? null;
    if (dupaId === null) {
      trunchiat = false;
      break;
    }
  }

  return { angajati, faraContract, trunchiat };
}

/**
 * Scutirile fiscale active în luna calculată — `employee_tax_exemptions`,
 * populat azi doar din formularul de pe fișa angajatului (§ AGENTS.md/CAEN).
 * `procent_scutire` e stocat ca procent 0-100 în bază; motorul de calcul
 * lucrează cu fracții 0-1, deci se împarte aici, o singură dată.
 */
export async function scutiriActivePerioada(
  organizationId: string,
  an: number,
  luna: number,
): Promise<ReadonlyMap<string, readonly TaxExemptionSnapshot[]>> {
  const db = await createServerSupabase();
  const primaZi = `${String(an)}-${String(luna).padStart(2, "0")}-01`;
  const ultimaZi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  const finalaZi = `${String(an)}-${String(luna).padStart(2, "0")}-${String(ultimaZi).padStart(2, "0")}`;

  const { data, error } = await db
    .from("employee_tax_exemptions")
    .select("employee_id, procent_scutire, plafon_lunar")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .lte("valabil_de_la", finalaZi)
    .or(`valabil_pana.is.null,valabil_pana.gte.${primaZi}`)
    .returns<
      { employee_id: string; procent_scutire: number | null; plafon_lunar: number | null }[]
    >();
  if (error !== null) throw error;

  const harta = new Map<string, TaxExemptionSnapshot[]>();
  for (const rand of data ?? []) {
    const listaAnterioara = harta.get(rand.employee_id) ?? [];
    harta.set(rand.employee_id, [
      ...listaAnterioara,
      {
        procentScutire: rand.procent_scutire === null ? null : rand.procent_scutire / 100,
        plafonLunar: rand.plafon_lunar,
      },
    ]);
  }
  return harta;
}

export interface ComponentaSalarialaActiva {
  readonly kind: string;
  readonly procent: number | null;
  readonly suma: number | null;
  readonly impozabil: boolean;
  /**
   * Păstrat pentru apelanții care nu disting cele două baze: adevărat dacă
   * componenta intră în ORICARE dintre ele.
   */
  readonly supusContributii: boolean;
  /**
   * Steagurile fidele din `salary_component_types`. Până la 0054 motorul avea
   * o singură bază și le colapsa aici într-un `sau` — o componentă supusă doar
   * CASS ajungea, deci, și în baza de pensie. Acum se transmit ca atare.
   */
  readonly intraInBazaCas: boolean;
  readonly intraInBazaCass: boolean;
}

/**
 * Sporurile/primele reutilizabile (`salary_components`, asociate de pe fișa
 * angajatului) active în luna calculată — se transformă în `bonuses` pentru
 * `calculatePayrollEntry`, ca angajatorul să nu le re-introducă manual în
 * fiecare perioadă.
 */
export async function componenteSalarialeActivePerioada(
  organizationId: string,
  an: number,
  luna: number,
): Promise<ReadonlyMap<string, readonly ComponentaSalarialaActiva[]>> {
  const db = await createServerSupabase();
  const primaZi = `${String(an)}-${String(luna).padStart(2, "0")}-01`;
  const ultimaZi = new Date(Date.UTC(an, luna, 0)).getUTCDate();
  const finalaZi = `${String(an)}-${String(luna).padStart(2, "0")}-${String(ultimaZi).padStart(2, "0")}`;

  const { data, error } = await db
    .from("salary_components")
    .select(
      "employee_id, kind, procent, suma, component_type:salary_component_types!component_type_id(impozabil, intra_in_baza_cas, intra_in_baza_cass)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .lte("valabil_de_la", finalaZi)
    .or(`valabil_pana.is.null,valabil_pana.gte.${primaZi}`)
    .returns<
      {
        employee_id: string;
        kind: string;
        procent: number | null;
        suma: number | null;
        component_type: {
          impozabil: boolean;
          intra_in_baza_cas: boolean;
          intra_in_baza_cass: boolean;
        } | null;
      }[]
    >();
  if (error !== null) throw error;

  const harta = new Map<string, ComponentaSalarialaActiva[]>();
  for (const rand of data ?? []) {
    const listaAnterioara = harta.get(rand.employee_id) ?? [];
    harta.set(rand.employee_id, [
      ...listaAnterioara,
      {
        kind: rand.kind,
        procent: rand.procent,
        suma: rand.suma,
        impozabil: rand.component_type?.impozabil ?? true,
        intraInBazaCas: rand.component_type?.intra_in_baza_cas ?? true,
        intraInBazaCass: rand.component_type?.intra_in_baza_cass ?? true,
        supusContributii:
          (rand.component_type?.intra_in_baza_cas ?? true) ||
          (rand.component_type?.intra_in_baza_cass ?? true),
      },
    ]);
  }
  return harta;
}

// ── Prime și rețineri, dinaintea calculului ─────────────────────────────────

export interface RandPrimaPerioada {
  readonly id: string;
  readonly employee_id: string;
  readonly tip: string;
  readonly suma: number;
  readonly motiv: string;
  readonly impozabil: boolean;
  readonly supus_contributii: boolean;
}

export interface RandRetinerePerioada {
  readonly id: string;
  readonly employee_id: string;
  readonly tip: string;
  readonly suma: number;
  readonly motiv: string;
  readonly procent_maxim_din_net: number | null;
}

export async function primeSiRetineriPerioada(
  organizationId: string,
  periodId: string,
): Promise<
  Readonly<{ prime: readonly RandPrimaPerioada[]; retineri: readonly RandRetinerePerioada[] }>
> {
  const db = await createServerSupabase();
  const [{ data: prime, error: eroarePrime }, { data: retineri, error: eroareRetineri }] =
    await Promise.all([
      db
        .from("payroll_bonuses")
        .select("id, employee_id, tip, suma, motiv, impozabil, supus_contributii")
        .eq("organization_id", organizationId)
        .eq("period_id", periodId)
        .is("deleted_at", null)
        .returns<RandPrimaPerioada[]>(),
      db
        .from("payroll_deductions")
        .select("id, employee_id, tip, suma, motiv, procent_maxim_din_net")
        .eq("organization_id", organizationId)
        .eq("period_id", periodId)
        .is("deleted_at", null)
        .returns<RandRetinerePerioada[]>(),
    ]);
  if (eroarePrime !== null) throw eroarePrime;
  if (eroareRetineri !== null) throw eroareRetineri;
  return { prime: prime ?? [], retineri: retineri ?? [] };
}

/** Prime și rețineri ale unui singur angajat pe o perioadă — pentru fluturașul individual. */
export async function listeazaBonusuriSiRetineri(
  organizationId: string,
  periodId: string,
  employeeId: string,
): Promise<
  Readonly<{ bonusuri: readonly RandPrimaPerioada[]; retineri: readonly RandRetinerePerioada[] }>
> {
  const db = await createServerSupabase();
  const [{ data: bonusuri, error: eroareBonusuri }, { data: retineri, error: eroareRetineri }] =
    await Promise.all([
      db
        .from("payroll_bonuses")
        .select("id, employee_id, tip, suma, motiv, impozabil, supus_contributii")
        .eq("organization_id", organizationId)
        .eq("period_id", periodId)
        .eq("employee_id", employeeId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .returns<RandPrimaPerioada[]>(),
      db
        .from("payroll_deductions")
        .select("id, employee_id, tip, suma, motiv, procent_maxim_din_net")
        .eq("organization_id", organizationId)
        .eq("period_id", periodId)
        .eq("employee_id", employeeId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .returns<RandRetinerePerioada[]>(),
    ]);
  if (eroareBonusuri !== null) throw eroareBonusuri;
  if (eroareRetineri !== null) throw eroareRetineri;
  return { bonusuri: bonusuri ?? [], retineri: retineri ?? [] };
}

export interface PontajAgregat {
  readonly zile_lucrate: number;
  readonly zile_concediu_odihna: number;
  readonly zile_concediu_medical: number;
  readonly zile_absenta_nemotivata: number;
  readonly zile_repaus_lucrate: number;
  readonly zile_sarbatoare_lucrate: number;
  readonly ore_lucrate: number;
  readonly ore_normale_zi: number;
  readonly ore_suplimentare_zi: number;
  readonly ore_normale_repaus: number;
  readonly ore_suplimentare_repaus: number;
  readonly ore_normale_sarbatoare: number;
  readonly ore_suplimentare_sarbatoare: number;
  readonly ore_noapte: number;
}

export const PONTAJ_GOL: PontajAgregat = {
  zile_lucrate: 0,
  zile_concediu_odihna: 0,
  zile_concediu_medical: 0,
  zile_absenta_nemotivata: 0,
  zile_repaus_lucrate: 0,
  zile_sarbatoare_lucrate: 0,
  ore_lucrate: 0,
  ore_normale_zi: 0,
  ore_suplimentare_zi: 0,
  ore_normale_repaus: 0,
  ore_suplimentare_repaus: 0,
  ore_normale_sarbatoare: 0,
  ore_suplimentare_sarbatoare: 0,
  ore_noapte: 0,
};

export interface RezultatPontajAgregat {
  readonly pePersoana: ReadonlyMap<string, PontajAgregat>;
  /** Citirea a atins plafonul de siguranță — pontajul NU e complet. */
  readonly trunchiat: boolean;
}

const PAGINA_PONTAJ = 500;
const MAXIM_PAGINI_PONTAJ = 100;

/**
 * Pontajul lunii, agregat pe angajat, prin `public.pontaj_agregat_salarizare`
 * (migrarea 0049).
 *
 * Varianta anterioară citea `attendance_entries` rând-cu-zi și avea DOUĂ
 * defecte tăcute, ambele reparate de funcția SQL:
 *
 *   - rândurile cu `tip_zi` 'weekend' sau 'sarbatoare' cădeau prin toate
 *     ramurile de clasificare: cine muncea sâmbăta nu era plătit deloc;
 *   - la 33 de angajați x 31 de zile se depășeau cele 1000 de rânduri pe care
 *     PostgREST le întoarce, iar restul se tăiau fără nicio eroare.
 *
 * Agregarea în SQL întoarce un rând per angajat, deci pragul de 1000 se atinge
 * abia la 1000 de angajați — și chiar și atunci, paginarea de mai jos îl
 * traversează, cu santinelă dacă s-ar depăși plafonul de siguranță.
 *
 * Izolarea rămâne la RLS: funcția e `SECURITY INVOKER`, deci `attendance_entries`
 * își aplică politicile pentru apelantul curent.
 */
export async function pontajAgregatPerioada(
  attendancePeriodId: string,
): Promise<RezultatPontajAgregat> {
  const db = await createServerSupabase();
  const pePersoana = new Map<string, PontajAgregat>();

  for (let pagina = 0; pagina < MAXIM_PAGINI_PONTAJ; pagina += 1) {
    const de = pagina * PAGINA_PONTAJ;
    const { data, error } = await db
      .rpc("pontaj_agregat_salarizare", { p_period_id: attendancePeriodId })
      .select("*")
      .range(de, de + PAGINA_PONTAJ - 1);
    if (error !== null) throw error;

    const lot = data ?? [];
    for (const rand of lot) {
      const { employee_id, ...restul } = rand;
      pePersoana.set(employee_id, restul);
    }
    if (lot.length < PAGINA_PONTAJ) return { pePersoana, trunchiat: false };
  }
  return { pePersoana, trunchiat: true };
}
