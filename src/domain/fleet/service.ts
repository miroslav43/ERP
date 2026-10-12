// src/domain/fleet/service.ts

import { verificaContinuitate } from "./kilometraj";
import { adaugaLuniLaZi } from "./costuri";
import { PRAG_FLOTA_AVERTIZARE_ZILE } from "./scadente";

/**
 * Planurile de service (0200): ce scadență are un plan, în ce stare e și cum se
 * judecă kilometrajul unei intervenții noi. Funcții pure, fără I/O.
 *
 * ── CE REPLICĂ ȘI DE CE ──────────────────────────────────────────────────────
 * `urmatoareaScadenta` repetă calculul triggerului `internal.vsp_inainte` (baza
 * din migrarea 0200), ca formularul să poată arăta „următoarea revizie: …”
 * înainte de salvare. Decizia finală rămâne a bazei; `service.test.ts` fixează
 * regula (inclusiv ziua 31 → ultima zi a lunii) și o ține lipită de migrare.
 */

/**
 * Limitele din CHECK-urile tabelelor (`vsp_*_ck`, `vse_*_ck`, `vex_*_ck`, 0200).
 * `service.test.ts` le lipește de migrare, ca o schimbare într-o parte să nu
 * treacă tăcut: schema Zod care le-ar depăși ar da 23514 în loc de un mesaj pe câmp.
 */
export const LIMITE_SERVICE = {
  intervalKmMin: 100,
  intervalKmMax: 1_000_000,
  intervalLuniMin: 1,
  intervalLuniMax: 240,
  kmMax: 10_000_000,
  pragAvertizareKmImplicit: 1000,
  pragAvertizareKmMax: 100_000,
  denumireMin: 2,
  denumireMax: 120,
  descriereMin: 2,
  descriereMax: 500,
  furnizorMax: 120,
  facturaMax: 60,
  documentMax: 60,
  observatiiMax: 1000,
} as const;

export type EntrareScadenta = Readonly<{
  /** Cea mai recentă dintre baza planului și intervențiile legate (derivată în bază). */
  ultimaData: string;
  ultimiiKm: number;
  intervalKm: number | null;
  intervalLuni: number | null;
}>;

export type Scadenta = Readonly<{ data: string | null; km: number | null }>;

/** Următoarea scadență: ultima dată + intervalul în luni, ultimii km + intervalul în km. */
export function urmatoareaScadenta(e: EntrareScadenta): Scadenta {
  return {
    data: e.intervalLuni === null ? null : adaugaLuniLaZi(e.ultimaData, e.intervalLuni),
    km: e.intervalKm === null ? null : e.ultimiiKm + e.intervalKm,
  };
}

export type ZiSiKm = Readonly<{ data: string; km: number }>;

/** Planul așa cum e în bază: baza introdusă de om și ultima derivată de trigger. */
export type PlanCuUltima = Readonly<{
  baza_data: string;
  baza_km: number;
  ultima_data: string;
  ultimii_km: number;
}>;

/** Perechea (dată, km) se compară întâi pe dată, apoi pe kilometri, ca în `vsp_inainte`. */
function peste(a: ZiSiKm, b: ZiSiKm): boolean {
  return a.data > b.data || (a.data === b.data && a.km > b.km);
}

/**
 * Ultima intervenție așa cum o va calcula triggerul `vsp_inainte` la salvare:
 * cea mai recentă pereche (dată, km) dintre BAZA introdusă acum și intervențiile
 * vii legate de plan.
 *
 * Caseta de corectură nu primește intervențiile, ci planul din bază. Dacă ultima
 * lui e strict peste baza lui veche, ea vine dintr-o intervenție legată și
 * rămâne în joc oricum s-ar schimba baza; altfel nicio intervenție legată nu e
 * peste bază, iar baza nouă câștigă, chiar dacă e mai veche. Fără ea, caseta ar
 * promite o scadență mai veche decât cea pe care o scrie baza.
 */
export function ultimaEfectiva(baza: ZiSiKm, plan: PlanCuUltima | null): ZiSiKm {
  if (plan === null) return baza;
  const intrareLegata: ZiSiKm = { data: plan.ultima_data, km: plan.ultimii_km };
  const bazaVeche: ZiSiKm = { data: plan.baza_data, km: plan.baza_km };
  return peste(intrareLegata, bazaVeche) && peste(intrareLegata, baza) ? intrareLegata : baza;
}

export type StarePlan = "oprit" | "fara_scadenta" | "in_regula" | "curand" | "depasit";

export type PlanPentruStare = Readonly<{
  activ: boolean;
  urmatoarea_data: string | null;
  urmatorii_km: number | null;
  prag_avertizare_km: number;
}>;

export type VerdictPlan = Readonly<{
  stare: StarePlan;
  /** Ce anume a aprins starea: scadența pe dată sau cea pe kilometri. */
  motiv: "data" | "km" | null;
  /** Zile până la scadență (negativ = întârziat); `null` fără scadență pe dată. */
  zileRamase: number | null;
  /** Km până la țintă (negativ = depășit); `null` fără țintă. */
  kmRamasi: number | null;
}>;

const RANG: Readonly<Record<StarePlan, number>> = {
  oprit: 0,
  fara_scadenta: 0,
  in_regula: 1,
  curand: 2,
  depasit: 3,
};

function zileIntre(de: string, la: string): number {
  const a = Date.parse(`${de}T00:00:00Z`);
  const b = Date.parse(`${la}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Starea unui plan: cea mai gravă dintre scadența pe dată și cea pe kilometri.
 *
 * Pe dată, aceleași praguri ca documentele (`PRAG_FLOTA_AVERTIZARE_ZILE`); o
 * scadență chiar de azi e „curând”, nu „depășit”. Pe kilometri, „depășit” de la
 * țintă, „curând” în pragul de avertizare al planului — același prag după care
 * pleacă și alerta din jobul zilnic.
 */
export function stareaPlanului(plan: PlanPentruStare, azi: string, kmCurent: number): VerdictPlan {
  if (!plan.activ) return { stare: "oprit", motiv: null, zileRamase: null, kmRamasi: null };

  const zileRamase = plan.urmatoarea_data === null ? null : zileIntre(azi, plan.urmatoarea_data);
  const kmRamasi = plan.urmatorii_km === null ? null : plan.urmatorii_km - kmCurent;

  let dupaData: StarePlan = "fara_scadenta";
  if (zileRamase !== null) {
    dupaData =
      zileRamase < 0
        ? "depasit"
        : zileRamase <= PRAG_FLOTA_AVERTIZARE_ZILE
          ? "curand"
          : "in_regula";
  }
  let dupaKm: StarePlan = "fara_scadenta";
  if (kmRamasi !== null) {
    dupaKm =
      kmRamasi <= 0 ? "depasit" : kmRamasi <= plan.prag_avertizare_km ? "curand" : "in_regula";
  }

  if (dupaData === "fara_scadenta" && dupaKm === "fara_scadenta") {
    return { stare: "fara_scadenta", motiv: null, zileRamase, kmRamasi };
  }
  // La egalitate câștigă data: e cea care se vede și în expirables.
  const dinKm = RANG[dupaKm] > RANG[dupaData];
  return {
    stare: dinKm ? dupaKm : dupaData,
    motiv: dinKm ? "km" : "data",
    zileRamase,
    kmRamasi,
  };
}

const KM = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/gu, ".");

function dataRo(iso: string): string {
  const [an = "", luna = "", zi = ""] = iso.split("-");
  return `${zi}.${luna}.${an}`;
}

/** „15.01.2027 sau 50.000 km”: ce spune coloana „Următoarea” a tabelului de planuri. */
export function scadentaPlan(
  plan: Pick<PlanPentruStare, "urmatoarea_data" | "urmatorii_km">,
): string {
  const parti: string[] = [];
  if (plan.urmatoarea_data !== null) parti.push(dataRo(plan.urmatoarea_data));
  if (plan.urmatorii_km !== null) parti.push(`${KM(plan.urmatorii_km)} km`);
  return parti.length === 0 ? "—" : parti.join(" sau ");
}

export type EvaluareKm = "ok" | "veche" | "salt";

/**
 * Kilometrajul unei intervenții față de cel al vehiculului. Refolosește
 * `verificaContinuitate` (aceeași regulă ca între foi), dar cu sensuri diferite
 * pentru un formular de service:
 *  · `veche` — sub kilometrajul curent: o intervenție introdusă târziu. Se
 *    acceptă (e istoric) și NU coboară kilometrajul vehiculului;
 *  · `salt` — peste prag: de obicei o cifră greșită, care ar urca kilometrajul
 *    vehiculului și ar strica verificarea următoarei foi. Se semnalează, nu se
 *    blochează: bordul din service e de încredere.
 */
export function evaluareKmIntrare(
  kmCurent: number,
  kmIntrare: number,
  pragSalt: number,
): EvaluareKm {
  const rezultat = verificaContinuitate(kmCurent, kmIntrare, null, pragSalt);
  if (rezultat === "regres") return "veche";
  return rezultat;
}
