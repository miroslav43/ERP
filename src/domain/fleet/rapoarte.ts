// src/domain/fleet/rapoarte.ts

import { formatMonthYear } from "@/lib/format/date";

import { abatereConsum, consumLa100Km } from "./consum";
import { costPeKm, sumaLei } from "./costuri";

/**
 * Rapoartele flotei pe o LUNĂ (F8): consumul real față de normă, kilometrii pe
 * șofer și costul pe vehicul. Funcții pure, fără I/O și fără ceas: apelantul
 * aduce rândurile deja citite pentru luna cerută.
 *
 * ── DE CE NUMAI FOI APROBATE ──────────────────────────────────────────────
 * Kilometrii, litrii și combustibilul vin DOAR de pe foile aprobate. O ciornă
 * sau o foaie trimisă dar neaprobată nu e încă document justificativ, iar
 * cifrele ei se pot schimba la retragere sau respingere. Raportul spune pe
 * ecran câte foi așteaptă (`foiInAsteptare`), ca un total mic să nu fie luat
 * drept un consum mic.
 *
 * ── DE CE „LEI PE KM” ȘI „CONSUM” LIPSESC, NU SUNT ZERO ─────────────────────
 * Fără kilometri aprobați în lună, un cost pe km ar fi o cifră inventată, iar
 * o împărțire la zero ar da `Infinity`. Regula e cea din `costuri.ts` și
 * `consum.ts`, refolosite aici: un singur calcul pentru fișa vehiculului și
 * pentru raport.
 */

// ── Luna cerută ─────────────────────────────────────────────────────────────

const AN_MIN = 2000;
const AN_MAX = 2199;
const TIPAR_LUNA = /^(\d{4})-(0[1-9]|1[0-2])$/u;

/** Luna `AAAA-LL` dintr-o adresă. Intervalul anilor e al datelor pe care le poate ține aplicația. */
export function lunaValida(luna: unknown): luna is string {
  if (typeof luna !== "string") return false;
  const potrivire = TIPAR_LUNA.exec(luna);
  if (potrivire === null) return false;
  const an = Number(potrivire[1]);
  return an >= AN_MIN && an <= AN_MAX;
}

export type IntervalLuna = Readonly<{ deLa: string; panaLa: string }>;

const doua = (n: number): string => String(n).padStart(2, "0");

/** Prima și ultima zi a lunii, ambele incluse. Luna trebuie să fie validă. */
export function intervalLuna(luna: string): IntervalLuna {
  const [an = 0, lunaNr = 1] = luna.split("-").map(Number);
  // `Date.UTC(an, lunaNr, 0)`: luna e indexată de la zero, deci `lunaNr` e deja
  // luna următoare, iar ziua 0 e ultima zi a celei cerute.
  const ultimaZi = new Date(Date.UTC(an, lunaNr, 0)).getUTCDate();
  return {
    deLa: `${String(an).padStart(4, "0")}-${doua(lunaNr)}-01`,
    panaLa: `${String(an).padStart(4, "0")}-${doua(lunaNr)}-${doua(ultimaZi)}`,
  };
}

/** `2026-09-15` → `2026-09`. */
export function lunaDinZi(zi: string): string {
  return zi.slice(0, 7);
}

/** Luna cu `delta` luni mai încolo (negativ = înapoi), peste hotarul anului. */
export function lunaMutata(luna: string, delta: number): string {
  const [an = 0, lunaNr = 1] = luna.split("-").map(Number);
  const total = an * 12 + (lunaNr - 1) + delta;
  const anNou = Math.floor(total / 12);
  const lunaNoua = (((total % 12) + 12) % 12) + 1;
  return `${String(anNou).padStart(4, "0")}-${doua(lunaNoua)}`;
}

/** `2026-09` → `septembrie 2026`. */
export function etichetaLuna(luna: string): string {
  const [an = 0, lunaNr = 1] = luna.split("-").map(Number);
  return formatMonthYear(an, lunaNr);
}

// ── Rândurile citite ────────────────────────────────────────────────────────

/** O alimentare de pe o foaie aprobată. */
export interface AlimentareRaport {
  readonly litri: number;
  readonly cost: number | null;
}

/**
 * O foaie APROBATĂ, cu ce interesează rapoartele. Vehiculul se citește din
 * instantaneul de la trimitere (`vehicul_*`, `norma_l_100km`): foaia aprobată
 * nu se schimbă retroactiv dacă mașina își schimbă norma mâine.
 */
export interface FoaieRaport {
  readonly id: string;
  readonly vehicle_id: string;
  readonly employee_id: string | null;
  readonly numar: string | null;
  /** Ziua foii, `AAAA-LL-ZZ`. */
  readonly data: string;
  readonly km_parcursi: number | null;
  readonly vehicul_nr: string | null;
  /** `electric` se măsoară în kWh, restul în litri. */
  readonly vehicul_combustibil: string | null;
  readonly norma_l_100km: number | null;
  readonly alimentari: readonly AlimentareRaport[];
  /**
   * Codurile UIT vii ale curselor foii (0217, F12f), pentru coloana „UIT” din
   * registru. Opțional: o citire care nu le aduce lasă coloana goală.
   */
  readonly uituri?: readonly Readonly<{ uit: string }>[];
}

/** Etichetele vehiculelor (numărul de înmatriculare), după id. */
export type EtichetaVehicule = ReadonlyMap<string, string>;
/** Numele șoferilor, după id-ul fișei de angajat. */
export type EtichetaSoferi = ReadonlyMap<string, string>;

export const ETICHETA_VEHICUL_STERS = "Vehicul șters";
export const ETICHETA_FARA_SOFER = "Fără șofer";
export const ETICHETA_SOFER_NECUNOSCUT = "Șofer necunoscut";

/**
 * Eticheta vehiculului: numărul de acum; dacă vehiculul nu se mai vede (șters),
 * numărul de pe prima foaie; altfel „Vehicul șters”. Un rând nu dispare din
 * raport doar fiindcă mașina a fost scoasă din parc: costurile ei au existat.
 */
function etichetaVehicul(
  id: string,
  vehicule: EtichetaVehicule,
  foi: readonly FoaieRaport[],
): string {
  const dinParc = vehicule.get(id);
  if (dinParc !== undefined) return dinParc;
  const dinFoaie = foi.find((f) => f.vehicle_id === id && f.vehicul_nr !== null)?.vehicul_nr;
  return dinFoaie ?? ETICHETA_VEHICUL_STERS;
}

function etichetaSofer(id: string | null, soferi: EtichetaSoferi): string {
  if (id === null) return ETICHETA_FARA_SOFER;
  return soferi.get(id) ?? ETICHETA_SOFER_NECUNOSCUT;
}

const km = (f: FoaieRaport): number => f.km_parcursi ?? 0;
const litriFoaie = (f: FoaieRaport): number => sumaLei(f.alimentari.map((a) => a.litri));
const costFoaie = (f: FoaieRaport): number => sumaLei(f.alimentari.map((a) => a.cost));

function dupaGrup<T>(elemente: readonly T[], cheie: (e: T) => string): Map<string, T[]> {
  const harta = new Map<string, T[]>();
  for (const e of elemente) {
    const k = cheie(e);
    const lista = harta.get(k);
    if (lista === undefined) harta.set(k, [e]);
    else lista.push(e);
  }
  return harta;
}

// ── Totaluri pe flotă ───────────────────────────────────────────────────────

export interface TotaluriLuna {
  readonly foi: number;
  readonly km: number;
  readonly litri: number;
  readonly costCombustibil: number;
}

export function totaluriLuna(foi: readonly FoaieRaport[]): TotaluriLuna {
  return {
    foi: foi.length,
    km: foi.reduce((s, f) => s + km(f), 0),
    litri: sumaLei(foi.map(litriFoaie)),
    costCombustibil: sumaLei(foi.map(costFoaie)),
  };
}

// ── Consumul pe vehicul ─────────────────────────────────────────────────────

export interface RandConsum {
  readonly vehicleId: string;
  readonly vehicul: string;
  readonly foi: number;
  readonly km: number;
  readonly litri: number;
  readonly costCombustibil: number;
  readonly unitate: "l" | "kWh";
  /** Litri la 100 km din foile lunii; `null` fără litri sau fără kilometri. */
  readonly consumReal: number | null;
  /**
   * Norma medie ponderată cu kilometrii foilor; `null` când vreo foaie n-are
   * normă (o medie pe jumătate din foi ar compara mere cu pere).
   */
  readonly normaMedie: number | null;
  /** Foile lunii fără normă proprie de consum pe instantaneu. */
  readonly foiFaraNorma: number;
  /** Procente; pozitivă = s-a consumat mai mult decât norma. */
  readonly abatere: number | null;
}

/**
 * Consumul real față de normă, un rând pe vehicul, în ordinea numărului de
 * înmatriculare. Norma e cea de pe fiecare foaie (instantaneul), nu cea de azi
 * a vehiculului: o schimbare de normă în mijlocul lunii se vede ponderat.
 */
export function consumPeVehicul(
  foi: readonly FoaieRaport[],
  vehicule: EtichetaVehicule,
): readonly RandConsum[] {
  const randuri = [...dupaGrup(foi, (f) => f.vehicle_id).entries()].map(([id, deLaVehicul]) => {
    const kmTotal = deLaVehicul.reduce((s, f) => s + km(f), 0);
    const litri = sumaLei(deLaVehicul.map(litriFoaie));
    const foiFaraNorma = deLaVehicul.filter((f) => f.norma_l_100km === null).length;
    // Σ(km × normă) / Σ km, doar când TOATE foile au normă și există kilometri.
    const normaMedie =
      foiFaraNorma === 0 && kmTotal > 0
        ? deLaVehicul.reduce((s, f) => s + km(f) * (f.norma_l_100km ?? 0), 0) / kmTotal
        : null;
    const consumReal = consumLa100Km(litri, kmTotal);
    const electric = deLaVehicul.some((f) => f.vehicul_combustibil === "electric");
    return {
      vehicleId: id,
      vehicul: etichetaVehicul(id, vehicule, deLaVehicul),
      foi: deLaVehicul.length,
      km: kmTotal,
      litri,
      costCombustibil: sumaLei(deLaVehicul.map(costFoaie)),
      unitate: electric ? ("kWh" as const) : ("l" as const),
      consumReal,
      normaMedie,
      foiFaraNorma,
      abatere: abatereConsum(consumReal, normaMedie),
    };
  });
  return randuri.sort(
    (a, b) => a.vehicul.localeCompare(b.vehicul) || (a.vehicleId < b.vehicleId ? -1 : 1),
  );
}

// ── Kilometri pe șofer ──────────────────────────────────────────────────────

export interface RandSofer {
  /** `null` = foi fără șofer pe fișă (angajat șters din alocare). */
  readonly employeeId: string | null;
  readonly sofer: string;
  readonly foi: number;
  /** Zile calendaristice distincte cu cel puțin o foaie. */
  readonly zile: number;
  /** Vehicule distincte conduse în lună. */
  readonly vehicule: number;
  readonly km: number;
}

/**
 * Kilometri pe șofer, cei mai mulți întâi. Foaia fără șofer și șoferul care nu
 * se mai vede au rânduri proprii: kilometrii lor au fost parcurși.
 */
export function kmPeSofer(
  foi: readonly FoaieRaport[],
  soferi: EtichetaSoferi,
): readonly RandSofer[] {
  const randuri = [...dupaGrup(foi, (f) => f.employee_id ?? "").entries()].map(
    ([cheie, deLaSofer]): RandSofer => {
      const employeeId = cheie === "" ? null : cheie;
      return {
        employeeId,
        sofer: etichetaSofer(employeeId, soferi),
        foi: deLaSofer.length,
        zile: new Set(deLaSofer.map((f) => f.data)).size,
        vehicule: new Set(deLaSofer.map((f) => f.vehicle_id)).size,
        km: deLaSofer.reduce((s, f) => s + km(f), 0),
      };
    },
  );
  return randuri.sort((a, b) => b.km - a.km || a.sofer.localeCompare(b.sofer));
}

// ── Costul pe vehicul ───────────────────────────────────────────────────────

export interface SurseCost {
  /** Foile aprobate ale lunii: combustibilul și kilometrii. */
  readonly foi: readonly FoaieRaport[];
  /** `vehicle_service_entries` din lună. */
  readonly servicii: readonly Readonly<{ vehicle_id: string; cost_total: number }>[];
  /** `vehicle_expenses` din lună, inclusiv „combustibil fără foaie”. */
  readonly cheltuieli: readonly Readonly<{ vehicle_id: string; suma: number }>[];
  /** Documentele a căror valabilitate începe în lună. */
  readonly documente: readonly Readonly<{ vehicle_id: string; cost: number | null }>[];
}

export interface TotalCost {
  readonly foi: number;
  readonly service: number;
  readonly cheltuieli: number;
  readonly documente: number;
  readonly combustibilFoi: number;
  readonly total: number;
  readonly km: number;
  readonly costPeKm: number | null;
}

export interface RandCost extends TotalCost {
  readonly vehicleId: string;
  readonly vehicul: string;
}

/**
 * Costul pe vehicul în lună, din aceleași patru surse ca fila Costuri a fișei
 * (`costuri.ts`): service, cheltuieli fără foaie, documente și combustibilul
 * foilor aprobate. Cele mai costisitoare vehicule întâi.
 */
export function costPeVehicul(surse: SurseCost, vehicule: EtichetaVehicule): readonly RandCost[] {
  const ids = new Set<string>([
    ...surse.foi.map((f) => f.vehicle_id),
    ...surse.servicii.map((s) => s.vehicle_id),
    ...surse.cheltuieli.map((c) => c.vehicle_id),
    ...surse.documente.map((d) => d.vehicle_id),
  ]);
  const foiPe = dupaGrup(surse.foi, (f) => f.vehicle_id);
  const serviciiPe = dupaGrup(surse.servicii, (s) => s.vehicle_id);
  const cheltuieliPe = dupaGrup(surse.cheltuieli, (c) => c.vehicle_id);
  const documentePe = dupaGrup(surse.documente, (d) => d.vehicle_id);

  const randuri = [...ids].map((id): RandCost => {
    const deLaVehicul = foiPe.get(id) ?? [];
    const service = sumaLei((serviciiPe.get(id) ?? []).map((s) => s.cost_total));
    const cheltuieli = sumaLei((cheltuieliPe.get(id) ?? []).map((c) => c.suma));
    const documente = sumaLei((documentePe.get(id) ?? []).map((d) => d.cost));
    const combustibilFoi = sumaLei(deLaVehicul.map(costFoaie));
    const total = sumaLei([service, cheltuieli, documente, combustibilFoi]);
    const kmTotal = deLaVehicul.reduce((s, f) => s + km(f), 0);
    return {
      vehicleId: id,
      vehicul: etichetaVehicul(id, vehicule, deLaVehicul),
      foi: deLaVehicul.length,
      service,
      cheltuieli,
      documente,
      combustibilFoi,
      total,
      km: kmTotal,
      costPeKm: costPeKm(total, kmTotal),
    };
  });
  return randuri.sort((a, b) => b.total - a.total || a.vehicul.localeCompare(b.vehicul));
}

export function totaluriCost(randuri: readonly TotalCost[]): TotalCost {
  const service = sumaLei(randuri.map((r) => r.service));
  const cheltuieli = sumaLei(randuri.map((r) => r.cheltuieli));
  const documente = sumaLei(randuri.map((r) => r.documente));
  const combustibilFoi = sumaLei(randuri.map((r) => r.combustibilFoi));
  const total = sumaLei([service, cheltuieli, documente, combustibilFoi]);
  const kmTotal = randuri.reduce((s, r) => s + r.km, 0);
  return {
    foi: randuri.reduce((s, r) => s + r.foi, 0),
    service,
    cheltuieli,
    documente,
    combustibilFoi,
    total,
    km: kmTotal,
    costPeKm: costPeKm(total, kmTotal),
  };
}

// ── Registrul foilor lunii ──────────────────────────────────────────────────

export interface RandRegistru {
  readonly id: string;
  readonly numar: string | null;
  readonly data: string;
  readonly vehicul: string;
  readonly sofer: string;
  readonly km: number;
  readonly litri: number;
  readonly unitate: "l" | "kWh";
  readonly costCombustibil: number;
  readonly consumReal: number | null;
  readonly norma: number | null;
  /** Codurile UIT distincte ale foii (un cod poate acoperi mai multe curse). */
  readonly uituri: readonly string[];
}

/**
 * Foile aprobate ale lunii, una pe rând, în ordinea zilei, apoi a numărului
 * (cele fără număr la coadă) și a vehiculului: lista pe care contabilul o pune
 * lângă PDF-urile din pachet.
 */
export function registruFoi(
  foi: readonly FoaieRaport[],
  vehicule: EtichetaVehicule,
  soferi: EtichetaSoferi,
): readonly RandRegistru[] {
  const randuri = foi.map((f): RandRegistru => {
    const litri = litriFoaie(f);
    return {
      id: f.id,
      numar: f.numar,
      data: f.data,
      vehicul: etichetaVehicul(f.vehicle_id, vehicule, [f]),
      sofer: etichetaSofer(f.employee_id, soferi),
      km: km(f),
      litri,
      unitate: f.vehicul_combustibil === "electric" ? ("kWh" as const) : ("l" as const),
      costCombustibil: costFoaie(f),
      consumReal: consumLa100Km(litri, km(f)),
      norma: f.norma_l_100km,
      uituri: [...new Set((f.uituri ?? []).map((u) => u.uit))].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    };
  });
  return randuri.sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    if (a.numar !== b.numar) {
      if (a.numar === null) return 1;
      if (b.numar === null) return -1;
      return a.numar < b.numar ? -1 : 1;
    }
    return a.vehicul.localeCompare(b.vehicul) || (a.id < b.id ? -1 : 1);
  });
}

// ── Raportul lunii, întreg ──────────────────────────────────────────────────

/** Foile lunii care NU intră în cifre: un total mic nu trebuie luat drept consum mic. */
export interface FoiNeaprobate {
  readonly ciorne: number;
  readonly trimise: number;
  readonly respinse: number;
}

export interface RaportLunar {
  readonly luna: string;
  readonly interval: IntervalLuna;
  /** `null` = toată flota. */
  readonly vehicul: string | null;
  readonly totaluri: TotaluriLuna;
  readonly foiNeaprobate: FoiNeaprobate;
  readonly consum: readonly RandConsum[];
  readonly soferi: readonly RandSofer[];
  readonly costuri: readonly RandCost[];
  readonly totalCost: TotalCost;
  readonly registru: readonly RandRegistru[];
}

// ── Pachetul lunar ──────────────────────────────────────────────────────────

/**
 * Câte foi poate cuprinde un pachet lunar. Fiecare foaie e un PDF generat în
 * cererea HTTP; peste plafon ruta refuză cu un mesaj, nu se întrerupe la mijloc.
 *
 * 200, nu mai mult: măsurat pe 12 oct 2026, 200 de foi cu câte cinci curse durează
 * ~38 s și ies ~4,5 MB (~190 ms pe PDF, în cea mai mare parte încorporarea
 * fonturilor). `proxy_read_timeout` pe `/api/export/` e 120 s, dar Cloudflare taie
 * la 100 s (524) — un plafon de 400 ar fi trecut de ambele pe un server încărcat.
 * Peste plafon se descarcă pe vehicul (o lună de vehicul are cel mult ~31 de foi).
 * Stă în domeniu, nu lângă citiri, fiindcă ecranul îl arată omului înainte de clic.
 */
export const PLAFON_FOI_PACHET = 200;
