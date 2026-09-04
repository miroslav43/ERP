// src/lib/reges/compune.ts
import "server-only";

/**
 * Construiește payload-ul unui mesaj REGES din starea curentă a bazei.
 *
 * DE CE ÎN CLIPA TRIMITERII, ȘI NU LA PUNEREA ÎN COADĂ
 * Fiindcă payload-ul unui mesaj `Salariat` conține CNP-ul în clar. Persistat în
 * `reges_mesaje`, ar fi o a doua copie necriptată a datelor sensibile, în afara
 * `employee_sensitive_data` și a auditului ei. Coada ține doar CE trebuie
 * transmis și PE CINE; CUM arată mesajul se recalculează la fiecare încercare.
 *
 * Efectul lateral e corect: dacă operatorul repară o adresă lipsă între
 * punerea în coadă și apăsarea butonului, pleacă adresa reparată.
 *
 * ÎMPĂRȚIREA PE DOUĂ FUNCȚII NU E ESTETICĂ
 * `compuneSalariat` cere CNP-ul ca argument și nu-l citește singură. Așa,
 * decriptarea rămâne în Server Action, sub permisiunile utilizatorului real,
 * unde `hr_read_sensitive` scrie rândul de audit. Ciclul de reconciliere, care
 * rulează cu `service_role`, poate compune contracte și acțiuni — niciunul nu
 * conține date personale — dar nu poate compune un salariat, fiindcă n-are de
 * unde lua CNP-ul fără să ocolească auditul.
 */

import {
  mapeazaContract,
  mapeazaIncetare,
  mapeazaSalariat,
  mapeazaSuspendare,
  mapeazaReactivare,
  compuneAdresa,
  type ContractIntern,
  type SalariatIntern,
} from "@/domain/reges/mapare";
import type {
  ContextAntet,
  MesajContract,
  MesajSalariat,
  SporSalarial,
} from "@/domain/reges/mesaj";
import {
  propuneNormaTimpMunca,
  propuneTipContract,
  propuneTipNorma,
  type NormaTimpMunca,
  type Repartizare,
  type TipActIdentitate,
  type TipContract,
  type TipNorma,
} from "@/domain/reges/operatii";
import { verificaContract, verificaSalariat, type Problema } from "@/domain/reges/validare";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { createServerSupabase } from "@/lib/supabase/server";

type OriceSupabase = AdminSupabase | Awaited<ReturnType<typeof createServerSupabase>>;

export type RezultatCompunere<T> =
  Readonly<{ ok: true; mesaj: T }> | Readonly<{ ok: false; probleme: readonly Problema[] }>;

/** Codul ISO2 al țării → numele cerut de nomenclatorul REGES. */
const TARI: Readonly<Record<string, string>> = {
  RO: "România",
  MD: "Republica Moldova",
  BG: "Bulgaria",
  HU: "Ungaria",
  UA: "Ucraina",
  IT: "Italia",
  ES: "Spania",
  DE: "Germania",
  FR: "Franța",
  GB: "Regatul Unit",
};

/**
 * Numele țării pentru un cod ISO2.
 *
 * ⚠ Tabela de mai sus e o SCURTĂTURĂ pentru cazurile frecvente. Numele oficial
 * vine din nomenclatorul `Cetatenie`/`Nationalitate` sincronizat în
 * `reges_nomenclatoare`; funcția asta îl caută acolo întâi și cade pe tabelă
 * doar dacă sincronizarea n-a rulat încă. Un cod necunoscut se întoarce ca atare
 * și e respins de validare — mai bine decât să inventăm un nume.
 */
export async function numeTara(db: OriceSupabase, codIso2: string | null): Promise<string> {
  const cod = (codIso2 ?? "RO").trim().toUpperCase();
  const { data } = await db
    .from("reges_nomenclatoare")
    .select("nume")
    .eq("tip", "Cetatenie")
    .eq("cod", cod)
    .eq("activ", true)
    .limit(1)
    .maybeSingle();
  return data?.nume ?? TARI[cod] ?? cod;
}

/**
 * Identificatorul poziției COR în nomenclatorul REGES, pentru un cod de șase cifre.
 *
 * REGES-Online referențiază funcția prin UUID-ul din nomenclator, nu prin
 * perechea `{ cod, versiune }` din fișierele Revisal vechi. Căutarea se face în
 * oglinda locală (`reges_nomenclatoare`, sincronizată din `/api/Nomenclator`),
 * nu live: nomenclatorul COR are mii de poziții, iar un contract n-are de ce să
 * depindă de disponibilitatea ITM ca să poată fi compus.
 *
 * `null` când codul lipsește din oglindă — caz în care `verificaContract` oprește
 * mesajul cu un mesaj care spune ce trebuie făcut. Mai bine decât o referință
 * inventată, care trece de schemă și e refuzată asincron.
 */
export async function idCor(db: OriceSupabase, codCor: string | null): Promise<string | null> {
  const cod = (codCor ?? "").trim();
  if (cod === "") return null;
  const { data } = await db
    .from("reges_nomenclatoare")
    .select("reges_id")
    .eq("tip", "Cor")
    .eq("cod", cod)
    .eq("activ", true)
    .limit(1)
    .maybeSingle();
  return data?.reges_id ?? null;
}

/**
 * Sporurile active ale unui contract, gata de pus în mesaj.
 *
 * ACTIVE LA O DATĂ, nu „toate cele scrise vreodată": `salary_components` are
 * `valabil_de_la`/`valabil_pana`, iar un spor expirat rămâne în tabelă ca
 * istoric de salarizare. Trimis la ITM, ar declara un pachet salarial pe care
 * omul nu-l mai are.
 *
 * Doar felurile `spor_procent` și `spor_suma`. `indemnizatie`,
 * `prima_recurenta` și `beneficiu_natura` sunt componente de salarizare
 * INTERNĂ — schema REGES nu le cunoaște, iar trimise ca sporuri ar umfla
 * pachetul declarat.
 *
 * Un tip fără `reges_tip_spor_id` iese cu referință goală, NU se sare peste el:
 * `verificaContract` oprește atunci mesajul și spune ce lipsește. Sărirea tăcută
 * ar declara un salariu mai mic decât cel real, fără ca nimeni să afle.
 */
export async function sporurileContractului(
  db: OriceSupabase,
  organizationId: string,
  contractId: string,
  laData: string,
): Promise<readonly SporSalarial[]> {
  const { data, error } = await db
    .from("salary_components")
    .select("kind, procent, suma, tip:salary_component_types!component_type_id(reges_tip_spor_id)")
    .eq("organization_id", organizationId)
    .eq("contract_id", contractId)
    .in("kind", ["spor_procent", "spor_suma"])
    .lte("valabil_de_la", laData)
    .is("deleted_at", null)
    .returns<
      {
        readonly kind: "spor_procent" | "spor_suma";
        readonly procent: number | null;
        readonly suma: number | null;
        readonly tip: { readonly reges_tip_spor_id: string | null } | null;
      }[]
    >();
  if (error !== null) throw error;

  return (data ?? [])
    .map((c) => {
      const esteProcent = c.kind === "spor_procent";
      return {
        referintaTipSpor: c.tip?.reges_tip_spor_id ?? "",
        valoare: (esteProcent ? c.procent : c.suma) ?? 0,
        esteProcent,
      };
    })
    .filter((s) => s.valoare !== 0 || s.referintaTipSpor === "");
}

export type RandAngajat = Readonly<{
  first_name: string;
  last_name: string;
  adresa_strada: string | null;
  adresa_oras: string | null;
  adresa_judet: string | null;
  adresa_cod_postal: string | null;
  cetatenie: string;
  data_nasterii: string | null;
  reges_tip_act: string | null;
  reges_salariat_id: string | null;
}>;

/**
 * Mesajul `Salariat`. CNP-ul vine DIN AFARĂ, decriptat de apelant.
 */
export async function compuneSalariat(
  db: OriceSupabase,
  angajat: RandAngajat,
  cnp: string,
  ctx: Omit<ContextAntet, "operatie">,
): Promise<RezultatCompunere<MesajSalariat>> {
  const tara = await numeTara(db, angajat.cetatenie);
  const salariat: SalariatIntern = {
    cnp,
    nume: angajat.last_name,
    prenume: angajat.first_name,
    adresa: compuneAdresa({
      strada: angajat.adresa_strada,
      oras: angajat.adresa_oras,
      judet: angajat.adresa_judet,
      codPostal: angajat.adresa_cod_postal,
    }),
    taraDomiciliu: tara,
    // Fără o valoare aleasă explicit, `CarteIdentitate` e presupunerea corectă
    // pentru un cetățean român — dar validarea o cere oricum din listă, iar
    // coloana e nullable exact ca să nu ghicim pentru străini.
    tipActIdentitate: (angajat.reges_tip_act ?? "CarteIdentitate") as TipActIdentitate,
    nationalitate: tara,
    dataNasterii: angajat.data_nasterii,
    localitate: angajat.adresa_oras,
    regesSalariatId: angajat.reges_salariat_id,
  };

  const probleme = verificaSalariat(salariat);
  if (probleme.length > 0) return { ok: false, probleme };
  return { ok: true, mesaj: mapeazaSalariat(salariat, ctx) };
}

export type RandContract = Readonly<{
  numar: string;
  data_contract: string;
  valabil_de_la: string;
  valabil_pana: string | null;
  contract_duration: string;
  norma_ore_saptamana: number;
  norma_ore_zi: number;
  salariu_baza: number;
  moneda: string;
  work_mode: string;
  special_regime: string | null;
  reges_contract_id: string | null;
  reges_tip_contract: string | null;
  reges_tip_norma: string | null;
  reges_norma_timp: string | null;
  reges_repartizare: string | null;
  cod_cor: string | null;
}>;

function contractIntern(
  c: RandContract,
  regesCorId: string | null,
  sporuri: readonly SporSalarial[],
): ContractIntern {
  return {
    numar: c.numar,
    dataContract: c.data_contract,
    valabilDeLa: c.valabil_de_la,
    valabilPana: c.valabil_pana,
    durataDeterminata: c.contract_duration === "determinat",
    // Coloanele `reges_*` bat deducția: sunt alegerea explicită a operatorului.
    // Deducția e doar valoarea implicită a formularului, iar `RaportDeServiciu`
    // sau `ContractDeManagement` nu se pot deduce din nimic din modelul nostru.
    tipContract: (c.reges_tip_contract ??
      propuneTipContract({
        regimSpecial: c.special_regime as "ucenicie" | "internship" | "zilier" | null,
        modLucru: c.work_mode as "sediu" | "telemunca" | "domiciliu" | "mixt",
      })) as TipContract,
    tipNorma: (c.reges_tip_norma ?? propuneTipNorma(c.norma_ore_saptamana)) as TipNorma,
    normaTimpMunca: (c.reges_norma_timp ??
      propuneNormaTimpMunca(c.norma_ore_zi, c.norma_ore_saptamana)) as NormaTimpMunca,
    repartizare: (c.reges_repartizare ?? "OreDeZi") as Repartizare,
    salariuBaza: c.salariu_baza,
    moneda: c.moneda,
    codCor: c.cod_cor ?? "",
    regesCorId,
    sporuri,
    regesContractId: c.reges_contract_id,
  };
}

export function compuneContract(
  contract: RandContract,
  regesSalariatId: string,
  /**
   * Rezolvat de apelant cu `idCor`, nu aici: funcția rămâne sincronă, la fel ca
   * `compuneIncetare` și `compuneSuspendare`, iar apelantul plătește o singură
   * citire pentru tot lotul dacă vrea.
   */
  regesCorId: string | null,
  /** Rezolvate de apelant cu `sporurileContractului`, din același motiv ca `regesCorId`. */
  sporuri: readonly SporSalarial[],
  ctx: Omit<ContextAntet, "operatie"> & {
    readonly operatie?: "AdaugareContract" | "ModificareContract";
  },
): RezultatCompunere<MesajContract> {
  const intern = contractIntern(contract, regesCorId, sporuri);
  const probleme = verificaContract(intern);
  if (probleme.length > 0) return { ok: false, probleme };
  return { ok: true, mesaj: mapeazaContract(intern, regesSalariatId, ctx) };
}

export { mapeazaIncetare as compuneIncetare };
export { mapeazaSuspendare as compuneSuspendare };
export { mapeazaReactivare as compuneReactivare };
