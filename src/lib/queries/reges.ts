// src/lib/queries/reges.ts
import { randomUUID } from "node:crypto";
import { mapPostgrestError } from "@/lib/actions/errors";
import { todayInBucharest } from "@/lib/format/date";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/tenant/types";
import {
  evalueazaTermen,
  type StareTermen,
  type StatusReges,
  type TipEvenimentReges,
  type ZiIso,
} from "@/domain/reges/evenimente";

/**
 * Singurul loc din modulele REGES care depinde de forma exactă a lui `Tenant`.
 * Dacă în Faza 1a câmpul are alt nume, se corectează aici, o dată.
 */
export function idOrganizatie(tenant: Tenant): string {
  return tenant.organizationId;
}

export type FiltruStare = "toate" | "intarziate" | "de_transmis" | "transmise";

export interface FiltreReges {
  readonly stare: FiltruStare;
  readonly tip: TipEvenimentReges | "toate";
  readonly limita: number;
}

export const FILTRE_IMPLICITE: FiltreReges = { stare: "toate", tip: "toate", limita: 100 };

export interface RandReges {
  readonly id: string;
  readonly tip: TipEvenimentReges;
  readonly dataEvenimentului: ZiIso;
  readonly termenTransmitere: ZiIso;
  readonly status: StatusReges;
  readonly stare: StareTermen;
  readonly zileRamase: number;
  readonly zileIntarziere: number;
  readonly transmisLa: string | null;
  readonly numarInregistrare: string | null;
  readonly eroare: string | null;
  readonly angajatId: string;
  readonly angajatNume: string;
  readonly angajatMarca: string;
  readonly contractNumar: string | null;
}

export interface StatisticiReges {
  readonly intarziate: number;
  readonly astazi: number;
  readonly inTermen: number;
  readonly transmise: number;
}

export interface RezultatReges {
  readonly randuri: readonly RandReges[];
  readonly statistici: StatisticiReges;
  readonly azi: ZiIso;
}

/** Statusurile care nu s-au transmis încă — aceleași pe care `evalueazaTermen` le evaluează față de termen. */
const STATUSURI_NETRANSMISE = ["de_pregatit", "pregatit", "respins"] as const;
const STATUSURI_TRANSMISE = ["transmis", "confirmat"] as const;

/**
 * Cele patru cifre din capul ecranului, numărate în bază, pe TOT registrul.
 *
 * Erau calculate cu `randuri.reduce(...)` peste setul deja filtrat și deja
 * tăiat la `filtre.limita` (100). Efectul: pe filtrul „Transmise”, fișa
 * „Întârziate” arăta 0 chiar cu evenimente întârziate în registru, iar peste
 * 100 de evenimente toate patru erau mai mici decât realitatea — fără nicio
 * eroare. Într-un registru unde netransmiterea în termen e contravenție
 * separată pentru fiecare salariat, cifra mică e mai rea decât lipsa cifrei.
 *
 * `head: true` nu aduce niciun rând, deci plafonul PostgREST de 1000 nu atinge
 * numărătoarea; `count: "exact"` e singura variantă care nu estimează.
 */
async function numaraStatistici(
  supabase: ServerSupabase,
  organizationId: string,
  azi: ZiIso,
): Promise<StatisticiReges> {
  const baza = () =>
    supabase
      .from("reges_evenimente")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

  const [intarziate, astazi, inTermen, transmise] = await Promise.all([
    baza().in("status", STATUSURI_NETRANSMISE).lt("termen_transmitere", azi),
    baza().in("status", STATUSURI_NETRANSMISE).eq("termen_transmitere", azi),
    baza().in("status", STATUSURI_NETRANSMISE).gt("termen_transmitere", azi),
    baza().in("status", STATUSURI_TRANSMISE),
  ]);

  for (const rezultat of [intarziate, astazi, inTermen, transmise]) {
    if (rezultat.error) throw mapPostgrestError(rezultat.error, randomUUID());
  }

  return {
    intarziate: intarziate.count ?? 0,
    astazi: astazi.count ?? 0,
    inTermen: inTermen.count ?? 0,
    transmise: transmise.count ?? 0,
  };
}

const SELECT_EVENIMENTE =
  "id, event_type, data_evenimentului, termen_transmitere, status, transmis_la, numar_inregistrare, eroare, employee_id, contract_id";

export async function interogheazaEvenimenteReges(
  supabase: ServerSupabase,
  organizationId: string,
  filtre: FiltreReges,
): Promise<RezultatReges> {
  const azi: ZiIso = todayInBucharest();

  let cerere = supabase
    .from("reges_evenimente")
    .select(SELECT_EVENIMENTE)
    .eq("organization_id", organizationId) // apărare în adâncime; RLS filtrează oricum
    .is("deleted_at", null)
    .order("termen_transmitere", { ascending: true })
    .limit(filtre.limita);

  if (filtre.tip !== "toate") cerere = cerere.eq("event_type", filtre.tip);
  if (filtre.stare === "transmise") {
    cerere = cerere.in("status", STATUSURI_TRANSMISE);
  } else if (filtre.stare === "de_transmis" || filtre.stare === "intarziate") {
    cerere = cerere.in("status", STATUSURI_NETRANSMISE);
    if (filtre.stare === "intarziate") cerere = cerere.lt("termen_transmitere", azi);
  }

  // Sinteza pleacă în paralel cu lista: nu depinde de filtru, deci nu are de ce
  // să aștepte răspunsul lui.
  const [{ data, error }, statistici] = await Promise.all([
    cerere,
    numaraStatistici(supabase, organizationId, azi),
  ]);
  if (error) throw mapPostgrestError(error, randomUUID());
  const evenimente = data ?? [];

  const idAngajati = [...new Set(evenimente.map((e) => e.employee_id))];
  const idContracte = [
    ...new Set(evenimente.map((e) => e.contract_id).filter((id): id is string => id !== null)),
  ];

  const [angajati, contracte] = await Promise.all([
    idAngajati.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("employees").select("id, full_name, marca").in("id", idAngajati),
    idContracte.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("employment_contracts").select("id, numar").in("id", idContracte),
  ]);

  if (angajati.error) throw mapPostgrestError(angajati.error, randomUUID());
  if (contracte.error) throw mapPostgrestError(contracte.error, randomUUID());

  const numeAngajat = new Map((angajati.data ?? []).map((a) => [a.id, a]));
  const numarContract = new Map((contracte.data ?? []).map((c) => [c.id, c.numar]));

  const randuri: RandReges[] = evenimente.map((eveniment) => {
    const status = eveniment.status as StatusReges;
    const evaluare = evalueazaTermen(eveniment.termen_transmitere, azi, status);
    const angajat = numeAngajat.get(eveniment.employee_id);
    return {
      id: eveniment.id,
      tip: eveniment.event_type as TipEvenimentReges,
      dataEvenimentului: eveniment.data_evenimentului,
      termenTransmitere: eveniment.termen_transmitere,
      status,
      stare: evaluare.stare,
      zileRamase: evaluare.zileRamase,
      zileIntarziere: evaluare.zileIntarziere,
      transmisLa: eveniment.transmis_la,
      numarInregistrare: eveniment.numar_inregistrare,
      eroare: eveniment.eroare,
      angajatId: eveniment.employee_id,
      angajatNume: angajat?.full_name ?? "Angajat șters",
      angajatMarca: angajat?.marca ?? "—",
      contractNumar:
        eveniment.contract_id === null ? null : (numarContract.get(eveniment.contract_id) ?? null),
    };
  });

  return { randuri, statistici, azi };
}

// ── Coada de mesaje către API ───────────────────────────────────────────────

export interface RandMesaj {
  readonly id: string;
  readonly tip: string;
  readonly operatie: string;
  readonly stare: string;
  readonly ordine: number;
  readonly depindeDe: string | null;
  readonly messageId: string;
  readonly responseId: string | null;
  readonly referintaId: string | null;
  readonly rezultatCod: string | null;
  readonly rezultatMesaj: string | null;
  readonly eroare: string | null;
  readonly incercari: number;
  readonly trimisLa: string | null;
  readonly raspunsLa: string | null;
  readonly creatLa: string;
  readonly angajatId: string | null;
  readonly angajatNume: string | null;
  readonly contractNumar: string | null;
  /** Mesajul poate pleca: n-are dependență, sau dependența a primit referință. */
  readonly transmisibil: boolean;
}

export interface StatisticiMesaje {
  readonly deTransmis: number;
  readonly asteapta: number;
  readonly esuate: number;
  readonly reusite: number;
}

/**
 * Coada de mesaje a firmei, cu numele oamenilor rezolvate.
 *
 * Join manual, ca peste tot în modul: PostgREST nu poate face `select` imbricat
 * peste o cheie străină COMPUSĂ `(employee_id, organization_id)`, iar cheile
 * compuse sunt tocmai ce împiedică un mesaj al firmei A să arate spre un angajat
 * al firmei B.
 */
export async function interogheazaMesajeReges(
  supabase: ServerSupabase,
  organizationId: string,
  limita = 200,
): Promise<Readonly<{ randuri: readonly RandMesaj[]; statistici: StatisticiMesaje }>> {
  const { data, error } = await supabase
    .from("reges_mesaje")
    // prettier-ignore
    .select(
      "id, tip, operatie, stare, ordine, depinde_de, message_id, response_id, referinta_id, rezultat_cod, rezultat_mesaj, eroare, incercari, trimis_la, raspuns_la, created_at, employee_id, contract_id",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("ordine", { ascending: true })
    .limit(limita);
  if (error !== null) throw error;
  const mesaje = data ?? [];

  const idAngajati = [
    ...new Set(mesaje.map((m) => m.employee_id).filter((x): x is string => x !== null)),
  ];
  const idContracte = [
    ...new Set(mesaje.map((m) => m.contract_id).filter((x): x is string => x !== null)),
  ];

  const [angajati, contracte] = await Promise.all([
    idAngajati.length === 0
      ? Promise.resolve({ data: [] as { id: string; full_name: string | null }[] })
      : supabase.from("employees").select("id, full_name").in("id", idAngajati),
    idContracte.length === 0
      ? Promise.resolve({ data: [] as { id: string; numar: string }[] })
      : supabase.from("employment_contracts").select("id, numar").in("id", idContracte),
  ]);

  const numeDupaId = new Map((angajati.data ?? []).map((a) => [a.id, a.full_name]));
  const numarDupaId = new Map((contracte.data ?? []).map((c) => [c.id, c.numar]));
  // Referința fiecărui mesaj, ca să știm care dependențe sunt satisfăcute.
  const referintaDupaId = new Map(
    mesaje.map((m) => [m.id, { stare: m.stare, ref: m.referinta_id }]),
  );

  const randuri: RandMesaj[] = mesaje.map((m) => {
    const dep = m.depinde_de === null ? null : referintaDupaId.get(m.depinde_de);
    return {
      id: m.id,
      tip: m.tip,
      operatie: m.operatie,
      stare: m.stare,
      ordine: m.ordine,
      depindeDe: m.depinde_de,
      messageId: m.message_id,
      responseId: m.response_id,
      referintaId: m.referinta_id,
      rezultatCod: m.rezultat_cod,
      rezultatMesaj: m.rezultat_mesaj,
      eroare: m.eroare,
      incercari: m.incercari,
      trimisLa: m.trimis_la,
      raspunsLa: m.raspuns_la,
      creatLa: m.created_at,
      angajatId: m.employee_id,
      angajatNume: m.employee_id === null ? null : (numeDupaId.get(m.employee_id) ?? null),
      contractNumar: m.contract_id === null ? null : (numarDupaId.get(m.contract_id) ?? null),
      transmisibil:
        m.stare === "de_transmis" &&
        (m.depinde_de === null ||
          (dep !== undefined && dep !== null && dep.stare === "reusit" && dep.ref !== null)),
    };
  });

  return {
    randuri,
    statistici: {
      deTransmis: randuri.filter((r) => r.stare === "de_transmis").length,
      asteapta: randuri.filter((r) => r.stare === "asteapta_raspuns").length,
      esuate: randuri.filter((r) => r.stare === "esuat").length,
      reusite: randuri.filter((r) => r.stare === "reusit").length,
    },
  };
}

// ── Propuneri de detașare și mutare ─────────────────────────────────────────

export interface RandPropunere {
  readonly id: string;
  readonly directie: string;
  readonly fel: string;
  readonly stare: string;
  readonly partenerNume: string | null;
  readonly partenerCui: string | null;
  readonly salariatNume: string | null;
  readonly salariatCnpUltimele4: string | null;
  readonly dataInceput: string | null;
  readonly dataSfarsit: string | null;
  readonly temeiLegal: string | null;
  readonly primitaLa: string | null;
  readonly raspunsLa: string | null;
  readonly observatii: string | null;
}

export async function interogheazaPropuneriReges(
  supabase: ServerSupabase,
  organizationId: string,
  limita = 200,
): Promise<readonly RandPropunere[]> {
  const { data, error } = await supabase
    .from("reges_propuneri")
    // prettier-ignore
    .select(
      "id, directie, fel, stare, angajator_partener_nume, angajator_partener_cui, salariat_nume, salariat_cnp_last4, data_inceput, data_sfarsit, temei_legal, primita_la, raspuns_la, observatii",
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limita);
  if (error !== null) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    directie: p.directie,
    fel: p.fel,
    stare: p.stare,
    partenerNume: p.angajator_partener_nume,
    partenerCui: p.angajator_partener_cui,
    salariatNume: p.salariat_nume,
    salariatCnpUltimele4: p.salariat_cnp_last4,
    dataInceput: p.data_inceput,
    dataSfarsit: p.data_sfarsit,
    temeiLegal: p.temei_legal,
    primitaLa: p.primita_la,
    raspunsLa: p.raspuns_la,
    observatii: p.observatii,
  }));
}

/**
 * Câte propuneri PRIMITE mai așteaptă un răspuns — cifra de pe fila din bandă.
 *
 * Funcție pură peste rândurile deja citite, nu o interogare `count()` proprie,
 * și nu din întâmplare: pastila trebuie să poată ajunge la zero. Un contor cu
 * predicat propriu se desincronizează de listă în tăcere, iar rezultatul e o
 * insignă care spune „2 de răspuns" către un ecran unde nu mai e nimic de
 * răspuns — exact defectul pe care îl are `approval_tasks`, unde starea sarcinii
 * nu urmează starea cererii-părinte.
 *
 * Aici predicatul e scris o singură dată, iar tabelul „Primite" din
 * `/reges/propuneri` filtrează ACELEAȘI rânduri: dacă lista se golește, cifra
 * ajunge la zero prin construcție.
 */
export function propuneriDeRaspuns(propuneri: readonly RandPropunere[]): number {
  return propuneri.filter((p) => p.directie === "primita" && p.stare === "noua").length;
}

// ── Jurnalul apelurilor ─────────────────────────────────────────────────────

export interface RandApel {
  readonly id: string;
  readonly metoda: string;
  readonly cale: string;
  readonly httpStatus: number | null;
  readonly durataMs: number | null;
  readonly eroare: string | null;
  readonly creatLa: string;
}

export async function interogheazaApeluriReges(
  supabase: ServerSupabase,
  organizationId: string,
  mesajId: string | null = null,
  limita = 50,
): Promise<readonly RandApel[]> {
  let cerere = supabase
    .from("reges_apeluri")
    .select("id, metoda, cale, http_status, durata_ms, eroare, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limita);
  if (mesajId !== null) cerere = cerere.eq("mesaj_id", mesajId);

  const { data, error } = await cerere;
  if (error !== null) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    metoda: a.metoda,
    cale: a.cale,
    httpStatus: a.http_status,
    durataMs: a.durata_ms,
    eroare: a.eroare,
    creatLa: a.created_at,
  }));
}

/**
 * Contractele care POT fi propuse spre detașare sau mutare.
 *
 * Filtrul pe `reges_contract_id` nu e cosmetic: propunerea se transmite prin
 * referință la contractul înregistrat la ITM, iar unul netransmis încă ar fi
 * respins asincron cu „referință inexistentă". Mai bine lipsește din listă.
 */
export async function contracteEligibilePropunere(
  supabase: ServerSupabase,
  organizationId: string,
): Promise<readonly Readonly<{ id: string; numar: string; angajatNume: string | null }>[]> {
  const { data, error } = await supabase
    .from("employment_contracts")
    .select("id, numar, employee_id")
    .eq("organization_id", organizationId)
    .eq("status", "activ")
    .eq("este_act_aditional", false)
    .not("reges_contract_id", "is", null)
    .is("deleted_at", null)
    .order("numar", { ascending: true })
    .limit(200);
  if (error !== null) throw error;
  const contracte = data ?? [];
  if (contracte.length === 0) return [];

  const { data: angajati } = await supabase
    .from("employees")
    .select("id, full_name")
    .in("id", [...new Set(contracte.map((c) => c.employee_id))]);
  const nume = new Map((angajati ?? []).map((a) => [a.id, a.full_name]));

  return contracte.map((c) => ({
    id: c.id,
    numar: c.numar,
    angajatNume: nume.get(c.employee_id) ?? null,
  }));
}

/** Pozițiile active dintr-un nomenclator REGES, pentru listele derulante. */
export async function optiuniNomenclator(
  supabase: ServerSupabase,
  tip: string,
): Promise<readonly Readonly<{ cod: string; nume: string }>[]> {
  const { data, error } = await supabase
    .from("reges_nomenclatoare")
    .select("cod, nume")
    .eq("tip", tip)
    .eq("activ", true)
    .is("organization_id", null)
    .order("nume", { ascending: true })
    // Sub `max_rows = 1000`, care TRUNCHIAZĂ TĂCUT.
    .limit(300);
  if (error !== null) throw error;
  return (data ?? [])
    .filter((n): n is { cod: string; nume: string } => n.cod !== null)
    .map((n) => ({ cod: n.cod, nume: n.nume }));
}

// ── Detaliul unui mesaj ─────────────────────────────────────────────────────

export interface ClasificareContract {
  readonly contractId: string;
  readonly numar: string;
  readonly durataDeterminata: boolean;
  readonly normaOreSaptamana: number;
  readonly normaOreZi: number;
  readonly modLucru: string;
  readonly regimSpecial: string | null;
  readonly codCor: string | null;
  /** Alegerea explicită a operatorului. `null` = se folosește deducția. */
  readonly tipContract: string | null;
  readonly tipNorma: string | null;
  readonly normaTimp: string | null;
  readonly repartizare: string | null;
  readonly temeiIncetare: string | null;
  readonly regesContractId: string | null;
}

export interface DetaliuMesaj {
  readonly mesaj: RandMesaj;
  readonly clasificare: ClasificareContract | null;
  readonly apeluri: readonly RandApel[];
}

/**
 * Tot ce trebuie ca să înțelegi un mesaj: ce e, pe cine atinge, cum va fi
 * clasificat la ITM și ce s-a întâmplat cu el până acum.
 *
 * Clasificarea vine doar pentru mesajele de contract — un `Salariat` n-are
 * `TipContract`, iar afișarea unui formular gol acolo ar sugera că lipsește ceva.
 */
export async function citesteDetaliuMesaj(
  supabase: ServerSupabase,
  organizationId: string,
  mesajId: string,
): Promise<DetaliuMesaj | null> {
  const { data, error } = await supabase
    .from("reges_mesaje")
    // prettier-ignore
    .select(
      "id, tip, operatie, stare, ordine, depinde_de, message_id, response_id, referinta_id, rezultat_cod, rezultat_mesaj, eroare, incercari, trimis_la, raspuns_la, created_at, employee_id, contract_id",
    )
    .eq("id", mesajId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) return null;

  const [angajat, contract, apeluri, dependenta] = await Promise.all([
    data.employee_id === null
      ? Promise.resolve({ data: null })
      : supabase.from("employees").select("full_name").eq("id", data.employee_id).maybeSingle(),
    data.contract_id === null
      ? Promise.resolve({ data: null })
      : supabase
          .from("employment_contracts")
          // prettier-ignore
          .select(
            "id, numar, contract_duration, norma_ore_saptamana, norma_ore_zi, work_mode, special_regime, reges_contract_id, reges_tip_contract, reges_tip_norma, reges_norma_timp, reges_repartizare, reges_temei_incetare, functie, cod_cor",
          )
          .eq("id", data.contract_id)
          .eq("organization_id", organizationId)
          .maybeSingle(),
    interogheazaApeluriReges(supabase, organizationId, mesajId),
    data.depinde_de === null
      ? Promise.resolve({ data: null })
      : supabase
          .from("reges_mesaje")
          .select("stare, referinta_id")
          .eq("id", data.depinde_de)
          .maybeSingle(),
  ]);

  const dep = dependenta.data;
  const c = contract.data;

  return {
    mesaj: {
      id: data.id,
      tip: data.tip,
      operatie: data.operatie,
      stare: data.stare,
      ordine: data.ordine,
      depindeDe: data.depinde_de,
      messageId: data.message_id,
      responseId: data.response_id,
      referintaId: data.referinta_id,
      rezultatCod: data.rezultat_cod,
      rezultatMesaj: data.rezultat_mesaj,
      eroare: data.eroare,
      incercari: data.incercari,
      trimisLa: data.trimis_la,
      raspunsLa: data.raspuns_la,
      creatLa: data.created_at,
      angajatId: data.employee_id,
      angajatNume: angajat.data?.full_name ?? null,
      contractNumar: c?.numar ?? null,
      transmisibil:
        data.stare === "de_transmis" &&
        (data.depinde_de === null ||
          (dep !== null &&
            dep !== undefined &&
            dep.stare === "reusit" &&
            dep.referinta_id !== null)),
    },
    clasificare:
      c === null || c === undefined
        ? null
        : {
            contractId: c.id,
            numar: c.numar,
            durataDeterminata: c.contract_duration === "determinat",
            normaOreSaptamana: c.norma_ore_saptamana,
            normaOreZi: c.norma_ore_zi,
            modLucru: c.work_mode,
            regimSpecial: c.special_regime,
            codCor: c.cod_cor,
            tipContract: c.reges_tip_contract,
            tipNorma: c.reges_tip_norma,
            normaTimp: c.reges_norma_timp,
            repartizare: c.reges_repartizare,
            temeiIncetare: c.reges_temei_incetare,
            regesContractId: c.reges_contract_id,
          },
    apeluri,
  };
}
