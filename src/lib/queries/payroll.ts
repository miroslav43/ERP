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
  readonly procent_spor_sarbatoare: number;
  readonly casa_sanatate_angajator: string | null;
  readonly functie_declarant: string;
  readonly procent_ore_suplimentare: number;
  readonly valoare_tichet_masa: number;
  readonly tichete_impozabile: boolean;
  readonly tichete_supuse_cass: boolean;
  readonly rotunjire_lei: boolean;
  readonly salariu_minim_brut: number;
  readonly aplica_minim_contributii: boolean;
  readonly mod_calcul_indemnizatie_co: string;
  readonly luni_medie_indemnizatie_co: number;
  readonly zile_avertizare_termen_compensare: number;
  readonly plafon_poprire_unica: number;
  readonly plafon_popriri_concurente: number;
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
      "id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator, norma_zilnica_ore, procent_spor_noapte, procent_spor_weekend, procent_spor_sarbatoare, procent_ore_suplimentare, valoare_tichet_masa, tichete_impozabile, tichete_supuse_cass, rotunjire_lei, salariu_minim_brut, aplica_minim_contributii, mod_calcul_indemnizatie_co, luni_medie_indemnizatie_co, zile_avertizare_termen_compensare, plafon_poprire_unica, plafon_popriri_concurente, casa_sanatate_angajator, functie_declarant, verificat_de_contabil, verificat_la, note",
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
      "id, valabil_de_la, cota_cas, cota_cass, cota_impozit, cota_cam_angajator, norma_zilnica_ore, procent_spor_noapte, procent_spor_weekend, procent_spor_sarbatoare, procent_ore_suplimentare, valoare_tichet_masa, tichete_impozabile, tichete_supuse_cass, rotunjire_lei, salariu_minim_brut, aplica_minim_contributii, mod_calcul_indemnizatie_co, luni_medie_indemnizatie_co, zile_avertizare_termen_compensare, plafon_poprire_unica, plafon_popriri_concurente, casa_sanatate_angajator, functie_declarant, verificat_de_contabil, verificat_la, note",
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

export interface RezultatInregistrari {
  readonly randuri: readonly RandInregistrare[];
  /** Citirea a atins plafonul de siguranță — registrul NU e complet. */
  readonly trunchiat: boolean;
}

const PAGINA_INREGISTRARI = 500;
/** 500 × 100 = 50.000 de fluturași într-o lună. Peste atât, ceva e greșit. */
const MAXIM_PAGINI_INREGISTRARI = 100;

/**
 * Registrul de fluturași al unei perioade.
 *
 * Două defecte reparate față de varianta anterioară:
 *
 * 1. Citirea nu avea `.limit()` și nu pagina, deci de la al 1001-lea fluturaș
 *    PostgREST tăia tăcut (`max_rows = 1000`, supabase/config.toml) — iar
 *    totalurile perioadei, care se citesc din `payroll_periods`, rămâneau cele
 *    întregi. Rezultatul: un tabel a cărui sumă nu dă banda de sus, fără nicio
 *    eroare. Acum se parcurge în pagini după `id`, iar plafonul de siguranță se
 *    raportează.
 * 2. Ordonarea era `employee_id`, adică un `uuid`: coloana „Angajat" ieșea în
 *    ordine aleatoare pentru omul care caută o persoană între două sute de
 *    rânduri. PostgREST nu poate ordona rândurile părinte după o coloană a
 *    resursei încorporate, deci ordonarea pe nume se face aici, după citire.
 */
export async function listeazaInregistrari(periodId: string): Promise<RezultatInregistrari> {
  const db = await createServerSupabase();
  const randuri: RandInregistrare[] = [];
  let dupaId: string | null = null;
  let trunchiat = true;

  for (let pagina = 0; pagina < MAXIM_PAGINI_INREGISTRARI; pagina += 1) {
    let interogare = db
      .from("payroll_entries")
      .select(
        "id, employee_id, brut, net, net_de_plata, cost_total_angajator, angajat:employees!employee_id(full_name, marca)",
      )
      .eq("period_id", periodId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .limit(PAGINA_INREGISTRARI);
    if (dupaId !== null) interogare = interogare.gt("id", dupaId);

    const { data, error } = await interogare.returns<RandInregistrare[]>();
    if (error !== null) throw error;
    const lot = data ?? [];
    randuri.push(...lot);

    if (lot.length < PAGINA_INREGISTRARI) {
      trunchiat = false;
      break;
    }
    dupaId = lot[lot.length - 1]?.id ?? null;
    if (dupaId === null) {
      trunchiat = false;
      break;
    }
  }

  const numeleLui = (r: RandInregistrare): string =>
    r.angajat?.full_name || (r.angajat?.marca ?? "");
  randuri.sort((a, b) => numeleLui(a).localeCompare(numeleLui(b), "ro"));

  return { randuri, trunchiat };
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

/**
 * Luna unei perioade de salarizare — anul și luna, atât.
 *
 * ── DE CE EXISTĂ SEPARAT DE `citesteFluturasulPropriu` ──────────────────────
 * Ar fi părut mai ieftin un embed: `perioada:payroll_periods!period_id(an, luna)`
 * lipit în `COLOANE_INREGISTRARE`, un singur drum la bază. Nu se face, din două
 * motive care s-au verificat amândouă în acest repo:
 *
 *   1. `COLOANE_INREGISTRARE` e folosit și de `citesteInregistrare`, calea
 *      administrativă, care are deja luna din altă parte. Un embed acolo ar fi
 *      cost plătit degeaba pe fiecare fluturaș din stat.
 *
 *   2. Un embed refuzat de RLS întoarce `null` în loc de rând, fără eroare —
 *      exact defectul închis de 0027. O citire separată care întoarce `null` se
 *      citește la fel, dar apelantul VEDE că a întrebat.
 *
 * Angajatul obișnuit (`payroll:read = own`) ajunge aici de la 0113 încoace, și
 * numai pentru perioadele aprobate/închise în care are propriul fluturaș.
 * Înainte primea zero rânduri, iar portalul scria fluturașul fără lună.
 */
export async function perioadaInregistrarii(
  organizationId: string,
  periodId: string,
): Promise<{ readonly an: number; readonly luna: number } | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_periods")
    .select("an, luna")
    .eq("organization_id", organizationId)
    .eq("id", periodId)
    .is("deleted_at", null)
    .maybeSingle<{ an: number; luna: number }>();
  if (error !== null) throw error;
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

  const rezultat = numaraZileCerere(prima, finala, sarbatoriRo, liberSuplimentar, zileRecuperare);
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

export interface AngajatDeAles {
  readonly employee_id: string;
  readonly full_name: string;
  readonly marca: string;
  readonly status: string;
}

export interface RezultatAngajatiDeAles {
  readonly angajati: readonly AngajatDeAles[];
  /** Citirea a atins plafonul de siguranță — lista NU e completă. */
  readonly trunchiat: boolean;
}

/**
 * Toți angajații organizației, pentru alegerile care NU depind de o lună.
 *
 * `angajatiActiviCuContract` răspunde la „pe cine calculez luna asta"; ecranul
 * de istoric de venituri pune însă întrebarea inversă — venituri realizate
 * ÎNAINTE ca firma să folosească aplicația, adesea la alt angajator. Filtrate
 * prin luna curentă, tocmai persoanele care au nevoie de istoric (contract
 * început mai târziu, contract încheiat între timp) lipseau din `<select>`,
 * deci istoricul lor nu se putea introduce deloc — o fundătură tăcută, nu o
 * eroare.
 *
 * Se întorc și cei inactivi: indemnizația de concediu medical se calculează pe
 * media ultimelor șase luni, iar un angajat reangajat are nevoie de lunile de
 * dinainte.
 */
export async function totiAngajatiiDeAles(organizationId: string): Promise<RezultatAngajatiDeAles> {
  const db = await createServerSupabase();
  const angajati: AngajatDeAles[] = [];
  let dupaId: string | null = null;
  let trunchiat = true;

  for (let pagina = 0; pagina < MAXIM_PAGINI; pagina += 1) {
    let interogare = db
      .from("employees")
      .select("id, full_name, marca, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .limit(PAGINA_ANGAJATI);
    if (dupaId !== null) interogare = interogare.gt("id", dupaId);

    const { data, error } =
      await interogare.returns<
        { id: string; full_name: string; marca: string; status: string }[]
      >();
    if (error !== null) throw error;
    const lot = data ?? [];
    for (const a of lot) {
      angajati.push({
        employee_id: a.id,
        full_name: a.full_name,
        marca: a.marca,
        status: a.status,
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

  // Ordinea de citire e după `id` (uuid), fiindcă asta cere cursorul keyset;
  // ordinea de AFIȘARE trebuie să fie alfabetică, altfel lista de nume e o
  // înșiruire la întâmplare.
  angajati.sort((a, b) => (a.full_name || a.marca).localeCompare(b.full_name || b.marca, "ro"));

  return { angajati, trunchiat };
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
  /**
   * Zile de suspendare FĂRĂ acoperire medicală — concediu fără plată, creștere
   * copil, acomodare. Agregarea le numără de la 0064, dar până la 0126 numărul
   * ieșea din RPC și se pierdea: `payroll_entries` n-avea coloană, iar D112
   * declara `A_7 = 0` pentru toată lumea.
   */
  readonly zile_fara_plata: number;
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
  zile_fara_plata: 0,
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

// ── Istoricul de venit, pentru mediile de indemnizație ─────────────────────

export interface LunaIstoricVenit {
  readonly an: number;
  readonly luna: number;
  /** Venit brut realizat — baza pentru indemnizația de concediu medical. */
  readonly venitBrut: number;
  /** Salariu de bază + sporuri, fără primele ocazionale — baza pentru CO. */
  readonly drepturiSalariale: number;
  readonly zileLucrate: number;
}

/**
 * Ultimele `luniInapoi` luni de venit per angajat, cele mai recente primele.
 *
 * Două surse, în ordinea asta:
 *   1. `payroll_entries` — lunile calculate în aplicație;
 *   2. `payroll_prior_income` — lunile dinaintea punerii ei în funcțiune.
 *
 * Prima câștigă la egalitate: dacă o lună a fost și importată, și calculată,
 * cifra calculată e cea reală.
 *
 * APROXIMARE ASUMATĂ pentru `drepturiSalariale`: legea cere „salariu de bază
 * plus sporuri PERMANENTE", iar `payroll_entries` nu separă sporurile
 * permanente de cele variabile (orele suplimentare, sporul de noapte). Se
 * folosește brutul minus primele ocazionale, ceea ce include și sporuri
 * variabile — deci înclină în favoarea angajatului, nu împotriva lui. Pentru
 * lunile importate, `payroll_prior_income.drepturi_salariale` e autoritativ,
 * fiindcă acolo valoarea o scrie omul.
 */
export async function istoricVenitPerAngajat(
  organizationId: string,
  an: number,
  luna: number,
  luniInapoi: number,
): Promise<ReadonlyMap<string, readonly LunaIstoricVenit[]>> {
  const db = await createServerSupabase();

  // Fereastra: cele `luniInapoi` luni dinaintea lunii calculate.
  const luni: { an: number; luna: number }[] = [];
  for (let i = 1; i <= luniInapoi; i += 1) {
    const total = an * 12 + (luna - 1) - i;
    luni.push({ an: Math.floor(total / 12), luna: (total % 12) + 1 });
  }
  if (luni.length === 0) return new Map();
  const ceaMaiVeche = luni[luni.length - 1] as { an: number; luna: number };

  interface RandCalculat {
    readonly employee_id: string;
    readonly brut: number;
    readonly prime_total: number;
    readonly zile_lucrate: number;
    readonly perioada: { an: number; luna: number } | null;
  }
  const { data: calculate, error: eroareCalculate } = await db
    .from("payroll_entries")
    .select(
      "employee_id, brut, prime_total, zile_lucrate, perioada:payroll_periods!period_id(an, luna)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .returns<RandCalculat[]>();
  if (eroareCalculate !== null) throw eroareCalculate;

  interface RandImportat {
    readonly employee_id: string;
    readonly an: number;
    readonly luna: number;
    readonly venit_brut: number;
    readonly drepturi_salariale: number;
    readonly zile_lucrate: number;
  }
  const { data: importate, error: eroareImportate } = await db
    .from("payroll_prior_income")
    .select("employee_id, an, luna, venit_brut, drepturi_salariale, zile_lucrate")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .gte("an", ceaMaiVeche.an)
    .returns<RandImportat[]>();
  if (eroareImportate !== null) throw eroareImportate;

  const inFereastra = new Set(luni.map((l) => `${String(l.an)}-${String(l.luna)}`));
  const peAngajat = new Map<string, Map<string, LunaIstoricVenit>>();
  const pune = (employeeId: string, valoare: LunaIstoricVenit, suprascrie: boolean): void => {
    const cheie = `${String(valoare.an)}-${String(valoare.luna)}`;
    if (!inFereastra.has(cheie)) return;
    const alAngajatului = peAngajat.get(employeeId) ?? new Map<string, LunaIstoricVenit>();
    if (suprascrie || !alAngajatului.has(cheie)) alAngajatului.set(cheie, valoare);
    peAngajat.set(employeeId, alAngajatului);
  };

  for (const rand of importate ?? []) {
    pune(
      rand.employee_id,
      {
        an: rand.an,
        luna: rand.luna,
        venitBrut: rand.venit_brut,
        drepturiSalariale: rand.drepturi_salariale,
        zileLucrate: rand.zile_lucrate,
      },
      false,
    );
  }
  for (const rand of calculate ?? []) {
    if (rand.perioada === null) continue;
    pune(
      rand.employee_id,
      {
        an: rand.perioada.an,
        luna: rand.perioada.luna,
        venitBrut: rand.brut,
        drepturiSalariale: rand.brut - rand.prime_total,
        zileLucrate: rand.zile_lucrate,
      },
      true,
    );
  }

  const rezultat = new Map<string, readonly LunaIstoricVenit[]>();
  for (const [employeeId, alAngajatului] of peAngajat) {
    const lista = [...alAngajatului.values()].sort(
      (a, b) => b.an * 12 + b.luna - (a.an * 12 + a.luna),
    );
    rezultat.set(employeeId, lista);
  }
  return rezultat;
}

// ── Certificate medicale, cu detectarea episodului ─────────────────────────

export interface CertificatMedicalCitit {
  readonly serie: string;
  readonly numar: string;
  readonly dataInceput: string;
  readonly dataSfarsit: string;
  readonly zileCalendaristice: number;
  readonly zileLucratoare: number;
  readonly esteContinuare: boolean;
  readonly cod: {
    readonly cod: string;
    readonly procent: number;
    readonly zileAngajator: number;
    readonly platitor: "angajator" | "fnuass" | "mixt";
    readonly luniBazaCalcul: number;
    readonly plafonSalariiMinime: number | null;
    /** Ce se reține din indemnizația codului — v. 0127 și `indemnizatie-cm.ts`. */
    readonly retineCas: boolean;
    readonly retineImpozit: boolean;
    readonly retineCass: boolean;
  };
}

export interface CertificateAngajat {
  readonly certificate: readonly CertificatMedicalCitit[];
  /** Zile de angajator consumate în episod ÎNAINTE de luna calculată. */
  readonly zileAngajatorDejaConsumate: number;
}

/** Ziua următoare, pe componente de dată — fără să construim vreun `Date` local. */
function ziuaUrmatoare(zi: string): string {
  const an = Number(zi.slice(0, 4));
  const luna = Number(zi.slice(5, 7));
  const ziua = Number(zi.slice(8, 10));
  const urmatoare = new Date(Date.UTC(an, luna - 1, ziua + 1));
  return urmatoare.toISOString().slice(0, 10);
}

/**
 * Certificatele medicale care ating luna calculată, per angajat.
 *
 * Se citesc și lunile dinainte, fiindcă regula care contează cel mai mult nu se
 * poate afla dintr-o singură lună: primele zile calendaristice ale unui concediu
 * medical le suportă firma, iar un certificat de CONTINUARE **nu le resetează**.
 * Fără istoricul episodului, fiecare certificat ar reporni contorul și firma ar
 * plăti de mai multe ori aceleași cinci zile.
 *
 * Un episod = lanț de certificate în care fiecare începe cel târziu în ziua
 * următoare sfârșitului celui dinainte.
 */
export async function certificateMedicaleLuna(
  organizationId: string,
  an: number,
  luna: number,
): Promise<ReadonlyMap<string, CertificateAngajat>> {
  const db = await createServerSupabase();
  const { prima, ultima } = marginileLunii(an, luna);
  // Șase luni în urmă acoperă orice episod realist; un concediu medical mai
  // lung de-atât e oricum un caz care se verifică manual.
  const dinTrecut = marginileLunii(
    Math.floor((an * 12 + (luna - 1) - 6) / 12),
    ((an * 12 + (luna - 1) - 6) % 12) + 1,
  ).prima;

  interface Brut {
    readonly employee_id: string;
    readonly data_inceput: string;
    readonly data_sfarsit: string;
    readonly zile_lucratoare: number;
    readonly zile_calendaristice: number;
    readonly serie_certificat: string | null;
    readonly numar_certificat: string | null;
    readonly cod: {
      cod: string;
      procent: number;
      zile_angajator: number;
      platitor: string;
      luni_baza_calcul: number;
      plafon_salarii_minime: number | null;
      retine_cas: boolean;
      retine_impozit: boolean;
      retine_cass: boolean;
    } | null;
  }
  const { data, error } = await db
    .from("leave_requests")
    .select(
      "employee_id, data_inceput, data_sfarsit, zile_lucratoare, zile_calendaristice, serie_certificat, numar_certificat, cod:medical_leave_codes!medical_code_id(cod, procent, zile_angajator, platitor, luni_baza_calcul, plafon_salarii_minime, retine_cas, retine_impozit, retine_cass)",
    )
    .eq("organization_id", organizationId)
    .eq("status", "aprobata")
    .not("medical_code_id", "is", null)
    .is("deleted_at", null)
    .gte("data_inceput", dinTrecut)
    .lte("data_inceput", ultima)
    .order("data_inceput", { ascending: true })
    .returns<Brut[]>();
  if (error !== null) throw error;

  const peAngajat = new Map<string, Brut[]>();
  for (const rand of data ?? []) {
    if (rand.cod === null) continue;
    peAngajat.set(rand.employee_id, [...(peAngajat.get(rand.employee_id) ?? []), rand]);
  }

  const rezultat = new Map<string, CertificateAngajat>();
  for (const [employeeId, toate] of peAngajat) {
    const dinLuna: CertificatMedicalCitit[] = [];
    let consumateInainte = 0;
    let sfarsitulAnterior: string | null = null;

    for (const rand of toate) {
      const cod = rand.cod as NonNullable<Brut["cod"]>;
      const continuare =
        sfarsitulAnterior !== null && rand.data_inceput <= ziuaUrmatoare(sfarsitulAnterior);
      if (!continuare) consumateInainte = 0;

      const atingeLuna = rand.data_sfarsit >= prima && rand.data_inceput <= ultima;
      if (atingeLuna) {
        dinLuna.push({
          serie: rand.serie_certificat ?? "",
          numar: rand.numar_certificat ?? "",
          dataInceput: rand.data_inceput,
          dataSfarsit: rand.data_sfarsit,
          zileCalendaristice: rand.zile_calendaristice,
          zileLucratoare: rand.zile_lucratoare,
          esteContinuare: continuare,
          cod: {
            cod: cod.cod,
            procent: cod.procent,
            zileAngajator: cod.zile_angajator,
            platitor: cod.platitor as "angajator" | "fnuass" | "mixt",
            luniBazaCalcul: cod.luni_baza_calcul,
            plafonSalariiMinime: cod.plafon_salarii_minime,
            retineCas: cod.retine_cas,
            retineImpozit: cod.retine_impozit,
            retineCass: cod.retine_cass,
          },
        });
      } else {
        // Certificat din episod, dar dinaintea lunii: consumă din cele cinci zile.
        consumateInainte = Math.min(
          cod.zile_angajator,
          consumateInainte + rand.zile_calendaristice,
        );
      }
      sfarsitulAnterior = rand.data_sfarsit;
    }

    if (dinLuna.length > 0) {
      rezultat.set(employeeId, {
        certificate: dinLuna,
        zileAngajatorDejaConsumate: consumateInainte,
      });
    }
  }
  return rezultat;
}

// ── Compensări de ore, din tabelele populate de triggerele de pontaj ───────

export interface CompensariAngajat {
  readonly suplimentare: readonly {
    readonly ore: number;
    readonly oreFolosite: number;
    readonly oreExpirate: number;
    readonly termenFolosire: string;
  }[];
  readonly sarbatori: readonly {
    readonly dataSarbatorii: string;
    readonly oreLucrate: number;
    readonly tip: "zi_libera" | "spor";
    readonly acordata: boolean;
    readonly termenAcordare: string | null;
    readonly sporProcent: number | null;
  }[];
}

const COMPENSARI_GOALE: CompensariAngajat = { suplimentare: [], sarbatori: [] };

/**
 * Compensările care ating luna calculată.
 *
 * `overtime_compensation` și `holiday_compensation` se populează automat din
 * triggerele migrării 0013, dar până acum nimeni nu le citea: orele compensate
 * cu timp liber erau plătite A DOUA OARĂ, iar sporul de sărbătoare deja
 * calculat de bază nu ajungea nicăieri.
 */
export async function compensariLuna(
  organizationId: string,
  an: number,
  luna: number,
): Promise<ReadonlyMap<string, CompensariAngajat>> {
  const db = await createServerSupabase();
  const { prima, ultima } = marginileLunii(an, luna);

  const [supl, sarb] = await Promise.all([
    db
      .from("overtime_compensation")
      .select("employee_id, ore, ore_folosite, ore_expirate, termen_folosire")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .lte("data_generarii", ultima)
      .returns<
        {
          employee_id: string;
          ore: number;
          ore_folosite: number;
          ore_expirate: number;
          termen_folosire: string;
        }[]
      >(),
    db
      .from("holiday_compensation")
      .select(
        "employee_id, data_sarbatorii, ore_lucrate, tip, acordata, termen_acordare, spor_procent",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("data_sarbatorii", prima)
      .lte("data_sarbatorii", ultima)
      .returns<
        {
          employee_id: string;
          data_sarbatorii: string;
          ore_lucrate: number;
          tip: string;
          acordata: boolean;
          termen_acordare: string | null;
          spor_procent: number | null;
        }[]
      >(),
  ]);
  if (supl.error !== null) throw supl.error;
  if (sarb.error !== null) throw sarb.error;

  const rezultat = new Map<string, CompensariAngajat>();
  const ia = (id: string): CompensariAngajat => rezultat.get(id) ?? COMPENSARI_GOALE;

  for (const rand of supl.data ?? []) {
    const curent = ia(rand.employee_id);
    rezultat.set(rand.employee_id, {
      ...curent,
      suplimentare: [
        ...curent.suplimentare,
        {
          ore: rand.ore,
          oreFolosite: rand.ore_folosite,
          oreExpirate: rand.ore_expirate,
          termenFolosire: rand.termen_folosire,
        },
      ],
    });
  }
  for (const rand of sarb.data ?? []) {
    const curent = ia(rand.employee_id);
    rezultat.set(rand.employee_id, {
      ...curent,
      sarbatori: [
        ...curent.sarbatori,
        {
          dataSarbatorii: rand.data_sarbatorii,
          oreLucrate: rand.ore_lucrate,
          tip: rand.tip === "spor" ? "spor" : "zi_libera",
          acordata: rand.acordata,
          termenAcordare: rand.termen_acordare,
          sporProcent: rand.spor_procent,
        },
      ],
    });
  }
  return rezultat;
}

export interface RandIstoricVenit {
  readonly id: string;
  readonly employee_id: string;
  readonly nume: string;
  readonly marca: string;
  readonly an: number;
  readonly luna: number;
  readonly venit_brut: number;
  readonly drepturi_salariale: number;
  readonly zile_lucrate: number;
  readonly sursa: string | null;
}

/** Istoricul de venit introdus manual, cel mai recent primul. */
export async function listeazaIstoricVenit(
  organizationId: string,
): Promise<readonly RandIstoricVenit[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_prior_income")
    .select(
      "id, employee_id, an, luna, venit_brut, drepturi_salariale, zile_lucrate, sursa, angajat:employees!employee_id(full_name, marca)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("an", { ascending: false })
    .order("luna", { ascending: false })
    .limit(500)
    .returns<
      (Omit<RandIstoricVenit, "nume" | "marca"> & {
        angajat: { full_name: string; marca: string } | null;
      })[]
    >();
  if (error !== null) throw error;
  return (data ?? []).map(({ angajat, ...rest }) => ({
    ...rest,
    nume: angajat?.full_name ?? "",
    marca: angajat?.marca ?? "",
  }));
}

// ── Diurna lunii, din calculele deja făcute de modulul de deplasări ────────

export interface ZiDiurnaCitita {
  readonly data: string;
  readonly sumaAcordata: number;
  readonly baremLegalZi: number;
  readonly deplasareId: string;
}

export interface DiurnaAngajat {
  readonly zile: readonly ZiDiurnaCitita[];
  /** Partea neimpozabilă deja calculată de modulul de deplasări, pentru control. */
  readonly neimpozabilaCalculata: number;
  readonly impozabilaCalculata: number;
  /** Cel puțin un calcul are curs valutar incomplet — cifrele sunt provizorii. */
  readonly cursIncomplet: boolean;
}

/**
 * Diurna decontabilă a lunii, per angajat.
 *
 * Modulul de deplasări calculează DEJA plafonul și împărțirea impozabil /
 * neimpozabil (`per_diem_calculations`, migrarea 0015). Salarizarea nu
 * recalculează nimic din ce s-a decis acolo — doar aduce cifrele, ca partea
 * impozabilă să treacă prin contribuții și impozit, iar cea neimpozabilă să
 * ajungă direct în restul de plată.
 *
 * Se iau doar deplasările ÎNCHEIATE sau DECONTATE: una încă în aprobare nu e
 * un drept câștigat, iar o ciornă nici atât.
 *
 * `zile` se reconstituie ca o singură zi sintetică per deplasare, cu suma
 * totală și baremul mediu: `per_diem_calculations` reține rezultatul, nu
 * defalcarea zi cu zi. Etapa de plafonare lunară funcționează la fel, fiindcă
 * ea cumulează pe lună; plafonul ZILNIC a fost însă deja aplicat în modulul de
 * deplasări, la calculul lui.
 */
export async function diurnaLunaPerAngajat(
  organizationId: string,
  an: number,
  luna: number,
): Promise<ReadonlyMap<string, DiurnaAngajat>> {
  const db = await createServerSupabase();
  const { prima, ultima } = marginileLunii(an, luna);

  interface Brut {
    readonly business_trip_id: string;
    readonly zile_total: number;
    readonly valoare_lei: number;
    readonly plafon_neimpozabil_lei: number;
    readonly parte_neimpozabila_lei: number;
    readonly parte_impozabila_lei: number;
    readonly curs_incomplet: boolean;
    readonly deplasare: {
      employee_id: string;
      status: string;
      sosire_la: string;
    } | null;
  }
  const { data, error } = await db
    .from("per_diem_calculations")
    .select(
      "business_trip_id, zile_total, valoare_lei, plafon_neimpozabil_lei, parte_neimpozabila_lei, parte_impozabila_lei, curs_incomplet, deplasare:business_trips!business_trip_id(employee_id, status, sosire_la)",
    )
    .eq("organization_id", organizationId)
    .returns<Brut[]>();
  if (error !== null) throw error;

  const rezultat = new Map<string, DiurnaAngajat>();
  for (const rand of data ?? []) {
    const deplasare = rand.deplasare;
    if (deplasare === null) continue;
    if (deplasare.status !== "incheiata" && deplasare.status !== "decontata") continue;
    const zi = deplasare.sosire_la.slice(0, 10);
    if (zi < prima || zi > ultima) continue;

    const curent = rezultat.get(deplasare.employee_id) ?? {
      zile: [],
      neimpozabilaCalculata: 0,
      impozabilaCalculata: 0,
      cursIncomplet: false,
    };
    rezultat.set(deplasare.employee_id, {
      zile: [
        ...curent.zile,
        {
          data: zi,
          sumaAcordata: rand.valoare_lei,
          // Baremul mediu pe zi, reconstituit din plafonul deja calculat. Nu se
          // reaplică plafonul zilnic — el a fost aplicat în modulul de
          // deplasări; aici contează doar cumulul lunar.
          baremLegalZi: rand.zile_total > 0 ? rand.plafon_neimpozabil_lei / rand.zile_total : 0,
          deplasareId: rand.business_trip_id,
        },
      ],
      neimpozabilaCalculata: curent.neimpozabilaCalculata + rand.parte_neimpozabila_lei,
      impozabilaCalculata: curent.impozabilaCalculata + rand.parte_impozabila_lei,
      cursIncomplet: curent.cursIncomplet || rand.curs_incomplet,
    });
  }
  return rezultat;
}

export interface PlafoaneDiurna {
  /** Multiplul baremului legal sub care ziua rămâne neimpozabilă. */
  readonly multiplicatorPlafonZilnic: number;
  /** Fracțiunea din salariul de bază care plafonează luna. */
  readonly fractiePlafonLunar: number;
}

/**
 * Plafoanele de diurnă în vigoare în luna dată.
 *
 * Vin din `per_diem_policies`, nu din setările de salarizare: acolo le
 * administrează cine configurează deplasările, iar o a doua copie ar însemna
 * două adevăruri care se pot despărți. `null` înseamnă că organizația n-are
 * politică de diurnă — caz în care salarizarea nu are ce plafona.
 */
export async function plafoaneDiurnaLuna(
  organizationId: string,
  an: number,
  luna: number,
): Promise<PlafoaneDiurna | null> {
  const db = await createServerSupabase();
  const { ultima } = marginileLunii(an, luna);
  const { data, error } = await db
    .from("per_diem_policies")
    .select("multiplu_plafon_neimpozabil, plafon_salarii_baza_luna")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .lte("valabil_de_la", ultima)
    .order("valabil_de_la", { ascending: false })
    .limit(1)
    .maybeSingle<{ multiplu_plafon_neimpozabil: number; plafon_salarii_baza_luna: number }>();
  if (error !== null) throw error;
  if (data === null) return null;
  return {
    multiplicatorPlafonZilnic: data.multiplu_plafon_neimpozabil,
    fractiePlafonLunar: data.plafon_salarii_baza_luna,
  };
}

// ── Popriri active ────────────────────────────────────────────────────────

export interface PoprireActiva {
  readonly id: string;
  readonly sumaLunara: number;
  readonly soldRamas: number;
  readonly esteIntretinere: boolean;
  readonly prioritate: number;
  readonly dosar: string;
}

/**
 * Popririle active ale lunii, per angajat.
 *
 * `sold_ramas` e o coloană GENERATĂ (suma totală minus cea recuperată), tocmai
 * ca reținerea să se poată opri singură când datoria se stinge. Se citesc și
 * dosarele cu sold zero: etapa de calcul are nevoie de ele ca să raporteze
 * `SAL_POPRIRE_STINSA` — altfel stingerea ar fi tăcută, iar nimeni n-ar ști de
 * ce a crescut brusc netul.
 */
export async function popririActive(
  organizationId: string,
  an: number,
  luna: number,
): Promise<ReadonlyMap<string, readonly PoprireActiva[]>> {
  const db = await createServerSupabase();
  const { prima, ultima } = marginileLunii(an, luna);
  const { data, error } = await db
    .from("payroll_garnishments")
    .select("id, employee_id, suma_lunara, sold_ramas, tip_creanta, prioritate, dosar")
    .eq("organization_id", organizationId)
    .eq("activa", true)
    .is("deleted_at", null)
    .lte("data_inceput", ultima)
    .or(`data_sfarsit.is.null,data_sfarsit.gte.${prima}`)
    .order("prioritate", { ascending: true })
    .returns<
      {
        id: string;
        employee_id: string;
        suma_lunara: number;
        sold_ramas: number | null;
        tip_creanta: string;
        prioritate: number;
        dosar: string;
      }[]
    >();
  if (error !== null) throw error;

  const rezultat = new Map<string, PoprireActiva[]>();
  for (const rand of data ?? []) {
    rezultat.set(rand.employee_id, [
      ...(rezultat.get(rand.employee_id) ?? []),
      {
        id: rand.id,
        sumaLunara: rand.suma_lunara,
        soldRamas: rand.sold_ramas ?? 0,
        esteIntretinere: rand.tip_creanta === "intretinere",
        prioritate: rand.prioritate,
        dosar: rand.dosar,
      },
    ]);
  }
  return rezultat;
}

// ── Dosare de poprire, pentru ecranul de administrare ─────────────────────────

export interface RandDosarPoprire {
  readonly id: string;
  readonly employee_id: string;
  readonly dosar: string;
  readonly creditor: string;
  readonly executor: string | null;
  readonly tip_creanta: "intretinere" | "alta";
  readonly suma_totala: number;
  readonly suma_recuperata: number;
  readonly suma_lunara: number;
  readonly sold_ramas: number | null;
  readonly prioritate: number;
  readonly data_inceput: string;
  readonly data_sfarsit: string | null;
  readonly activa: boolean;
  readonly observatii: string | null;
  readonly angajat: Readonly<{ full_name: string | null; marca: string }> | null;
}

/**
 * Toate dosarele de poprire ale organizației, active și stinse.
 *
 * Spre deosebire de `popririActive` — care servește motorul de calcul și
 * filtrează pe lună și pe `activa` — asta e vederea de administrare: arată și
 * dosarele stinse, ca omul să vadă ce s-a recuperat și când s-a închis.
 *
 * `sold_ramas` e coloană GENERATĂ din `suma_totala - suma_recuperata` (0059:59),
 * iar `suma_recuperata` e recalculată de trigger din reținerile efectiv operate
 * (0065). Niciuna nu se scrie din aplicație.
 */
export async function dosarePopriri(organizationId: string): Promise<readonly RandDosarPoprire[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("payroll_garnishments")
    .select(
      "id, employee_id, dosar, creditor, executor, tip_creanta, suma_totala, suma_recuperata, suma_lunara, sold_ramas, prioritate, data_inceput, data_sfarsit, activa, observatii, angajat:employees!payroll_garnishments_employee_id_fkey(full_name, marca)",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("activa", { ascending: false })
    .order("prioritate", { ascending: true })
    .order("dosar", { ascending: true })
    .returns<RandDosarPoprire[]>();
  if (error !== null) throw error;
  return data ?? [];
}
