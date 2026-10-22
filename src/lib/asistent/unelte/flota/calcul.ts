// src/lib/asistent/unelte/flota/calcul.ts
/**
 * Deciziile pure ale uneltelor de flotă (F12e): cine are mașina, norma de
 * rezervă a consumului, clasificarea vehiculelor fără foi și ordinea scadențelor.
 *
 * Fără I/O, fără ceas, fără `server-only`: apelantul aduce rândurile deja citite
 * sub RLS-ul celui care întreabă și ziua de la București (`context.aziISO`).
 */
import { adaugaZileIso } from "@/domain/calendar/grila-lunara";
import { perioadaLa } from "@/domain/fleet/fiscal";
import type { FoaieRaport } from "@/domain/fleet/rapoarte";
import { momentDinOraRomaniei } from "@/lib/format/date";
import type { StatusFoaie } from "@/schemas/fleet";

// ── Ziua, în ora României ───────────────────────────────────────────────────

/**
 * Limitele unei zile românești `[00:00, 24:00)`, ca momente ISO în UTC.
 *
 * `timestamptz` e în UTC, iar ziua românească are 23 sau 25 de ore în nopțile
 * schimbării orei (ultima duminică din martie și din octombrie): `T00:00:00Z`
 * ar tăia ziua cu două-trei ore greșit. Aceeași funcție ca `dataOraRomania` din
 * `src/schemas/comun.ts`.
 */
export function limiteleZilei(zi: string): Readonly<{ inceput: string; sfarsit: string }> {
  const inceput = momentDinOraRomaniei(`${zi}T00:00`);
  const sfarsit = momentDinOraRomaniei(`${adaugaZileIso(zi, 1)}T00:00`);
  if (inceput === null || sfarsit === null) {
    throw new TypeError(`Zi calendaristică invalidă: ${JSON.stringify(zi)}`);
  }
  return { inceput, sfarsit };
}

const ms = (iso: string): number => Date.parse(iso);

// ── Cine are mașina (D3) ────────────────────────────────────────────────────

export interface FoaieZi {
  readonly id: string;
  readonly employee_id: string;
  readonly numar: string | null;
  readonly data: string;
  readonly status: StatusFoaie;
}

export interface CursaZi {
  readonly trip_sheet_id: string;
  readonly plecare_la: string;
  readonly sosire_la: string | null;
}

export interface AlocareZi {
  readonly employee_id: string;
  readonly de_la: string;
  readonly pana_la: string | null;
}

export type IntrareSofer = Readonly<{
  /** Ziua întrebată, `AAAA-LL-ZZ`. */
  ziua: string;
  /**
   * Momentul întrebat (ISO). Azi e „acum”; pentru o zi trecută există doar dacă
   * omul a dat ora. `null` = toată ziua: atunci se enumeră, nu se alege.
   */
  moment: string | null;
  foi: readonly FoaieZi[];
  curse: readonly CursaZi[];
  alocari: readonly AlocareZi[];
  pool: boolean;
}>;

export type SoferAles =
  | Readonly<{ fel: "cursa"; foaie: FoaieZi; cursa: CursaZi }>
  | Readonly<{ fel: "alocare"; alocare: AlocareZi }>
  | Readonly<{ fel: "foaie"; foaie: FoaieZi }>
  | Readonly<{ fel: "zi"; foi: readonly FoaieZi[]; alocari: readonly AlocareZi[] }>
  | Readonly<{ fel: "pool" }>
  | Readonly<{ fel: "nimic" }>;

/**
 * Cine are vehiculul, în precedența lui `app.sofer_la` (0206), reprodusă aici
 * fiindcă `.rpc()` nu ajunge la schema `app`, iar învelișul `public.sofer_sugerat`
 * e SECURITY DEFINER și răspunde doar celui care administrează amenzile.
 *
 * La un MOMENT dat, în ordinea bazei:
 *  1. cursa nerespinsă care îl acoperă: `plecare_la ≤ moment ≤ sosire_la`, iar o
 *     cursă fără sosire ține până la sfârșitul zilei foii; la egalitate, cea care
 *     a plecat ultima. Șoferul e al foii;
 *  2. alocarea care îl acoperă: `de_la ≤ moment < pana_la` (deschisă = fără capăt);
 *  3. extensia F12e, după bază ca să n-o contrazică: foaia zilei fără o cursă
 *     care să acopere momentul;
 *  4. mașină de pool; 5. nimic.
 *
 * Pentru TOATĂ ziua (zi trecută, fără oră) nu există un moment de comparat: o
 * predare la prânz înseamnă două nume, deci se enumeră foile zilei și alocările
 * care se suprapun cu ea, în loc să se aleagă una. La o divergență față de
 * `app.sofer_la`, câștigă baza și se corectează funcția asta.
 */
export function alegeSoferul(intrare: IntrareSofer): SoferAles {
  // Cursele se caută pe TOATE foile nerespinse primite, nu doar pe ale zilei: o
  // cursă de noapte de pe foaia de ieri poate acoperi dimineața de azi, iar
  // `app.sofer_la` n-o leagă de ziua foii. Foaia „zilei” (extensia și
  // enumerarea) e doar cea cu `data` = ziua întrebată.
  const nerespinse = intrare.foi.filter((f) => f.status !== "respins");
  const idFoi = new Map(nerespinse.map((f) => [f.id, f]));
  const foi = nerespinse.filter((f) => f.data === intrare.ziua);
  const { inceput, sfarsit } = limiteleZilei(intrare.ziua);

  if (intrare.moment !== null) {
    const m = ms(intrare.moment);
    const cursa = intrare.curse
      .filter((c) => {
        const foaie = idFoi.get(c.trip_sheet_id);
        if (foaie === undefined) return false;
        const capat = c.sosire_la ?? limiteleZilei(foaie.data).sfarsit;
        return ms(c.plecare_la) <= m && m <= ms(capat);
      })
      .sort((a, b) => ms(b.plecare_la) - ms(a.plecare_la))[0];
    const foaieCursei = cursa === undefined ? undefined : idFoi.get(cursa.trip_sheet_id);
    if (cursa !== undefined && foaieCursei !== undefined) {
      return { fel: "cursa", foaie: foaieCursei, cursa };
    }

    const alocare = intrare.alocari
      .filter((a) => ms(a.de_la) <= m && (a.pana_la === null || m < ms(a.pana_la)))
      .sort((a, b) => ms(b.de_la) - ms(a.de_la))[0];
    if (alocare !== undefined) return { fel: "alocare", alocare };

    const [foaie] = foi;
    if (foaie !== undefined) return { fel: "foaie", foaie };
  } else {
    // Suprapunerea cu ziua: începe înainte de sfârșitul ei și nu s-a încheiat
    // înainte de începutul ei.
    const alocari = intrare.alocari
      .filter(
        (a) => ms(a.de_la) < ms(sfarsit) && (a.pana_la === null || ms(a.pana_la) > ms(inceput)),
      )
      .sort((a, b) => ms(a.de_la) - ms(b.de_la));
    if (foi.length > 0 || alocari.length > 0) return { fel: "zi", foi, alocari };
  }

  return intrare.pool ? { fel: "pool" } : { fel: "nimic" };
}

/**
 * Fraza pentru „nimic” și „pool”. Sub vizibilitate parțială (`vehicles:read` sau
 * `trip_sheets:read` sub `all`), foaia unui coleg din afara echipei și alocarea
 * unui ne-subordonat sunt invizibile: „fără foaie” ar fi o afirmație falsă.
 */
export function frazaFaraSofer(fel: "pool" | "nimic", vizibilitateCompleta: boolean): string {
  if (!vizibilitateCompleta) {
    return fel === "pool"
      ? "e o mașină comună, fără nicio foaie și nicio alocare dintre cele pe care le poți vedea"
      : "n-are nicio foaie și nicio alocare dintre cele pe care le poți vedea";
  }
  return fel === "pool" ? "e o mașină comună, fără foaie în ziua aceea" : "nu e alocată nimănui";
}

// ── Consumul (D9) ───────────────────────────────────────────────────────────

/**
 * Sub atâția kilometri pe lună, câțiva litri în plus sau în minus mută cifra cu
 * zeci de procente: o alimentare plină făcută pe ultima foaie a lunii nu se
 * „consumă” până pe foaia următoare. Pragul nu e o regulă, e un avertisment.
 */
export const KM_MINIM_ORIENTATIV = 300;

export interface NormaPerioada {
  readonly valabil_de_la: string;
  readonly l_100km: number;
}

/**
 * Foile cu norma de REZERVĂ pusă acolo unde instantaneul lipsește.
 *
 * Instantaneul `norma_l_100km` se fixează la trimitere (0200, 0205) și e norma
 * documentului; nu se atinge. Doar unde lipsește (foi vechi, din backfill) se ia
 * norma valabilă în ziua foii (`vehicle_consumption_norms`, F10), apoi consumul
 * declarat al vehiculului, exact precedența cu care 0205 fixează instantaneul.
 * Formula rămâne una singură: `consumPeVehicul` din `@/domain/fleet/rapoarte`.
 */
export function cuNormaDeRezerva(
  foi: readonly FoaieRaport[],
  norme: ReadonlyMap<string, readonly NormaPerioada[]>,
  consumDeclarat: ReadonlyMap<string, number | null>,
): Readonly<{ foi: readonly FoaieRaport[]; cuRezerva: number }> {
  let cuRezerva = 0;
  const completate = foi.map((f): FoaieRaport => {
    if (f.norma_l_100km !== null) return f;
    const rezerva =
      perioadaLa(norme.get(f.vehicle_id) ?? [], f.data)?.l_100km ??
      consumDeclarat.get(f.vehicle_id) ??
      null;
    if (rezerva === null) return f;
    cuRezerva += 1;
    return { ...f, norma_l_100km: rezerva };
  });
  return { foi: completate, cuRezerva };
}

// ── Vehiculele fără foi ─────────────────────────────────────────────────────

export type ClasaFoi = "nicio_foaie" | "doar_ciorne" | "cu_foi";

export interface VehiculInParc {
  readonly id: string;
  readonly data_achizitie: string | null;
  readonly data_iesire: string | null;
}

/**
 * În parc în cel puțin o zi a intervalului: aceeași regulă ca
 * `public.flota_fiscal_luna` (0205), ca „fără foi” să nu numere alt parc decât
 * luna fiscală de pe `/flota/fiscal`.
 */
export function inParcInInterval(v: VehiculInParc, deLa: string, panaLa: string): boolean {
  return (
    (v.data_achizitie === null || v.data_achizitie <= panaLa) &&
    (v.data_iesire === null || v.data_iesire >= deLa)
  );
}

/**
 * Clasa fiecărui vehicul aflat în parc în interval:
 *  - `nicio_foaie`: nicio foaie în interval;
 *  - `doar_ciorne`: numai ciorne sau foi respinse — nimic trimis;
 *  - `cu_foi`: măcar o foaie trimisă sau aprobată (nu se raportează).
 * Vehiculele ieșite din parc înainte de interval sau intrate după el lipsesc.
 */
export function clasificaVehiculeFaraFoi<V extends VehiculInParc>(
  vehicule: readonly V[],
  foi: readonly Readonly<{ vehicle_id: string; status: StatusFoaie }>[],
  deLa: string,
  panaLa: string,
): ReadonlyMap<string, ClasaFoi> {
  const clasa = new Map<string, ClasaFoi>();
  for (const v of vehicule) {
    if (inParcInInterval(v, deLa, panaLa)) clasa.set(v.id, "nicio_foaie");
  }
  for (const f of foi) {
    const acum = clasa.get(f.vehicle_id);
    if (acum === undefined) continue;
    if (f.status === "trimis" || f.status === "aprobat") clasa.set(f.vehicle_id, "cu_foi");
    else if (acum === "nicio_foaie") clasa.set(f.vehicle_id, "doar_ciorne");
  }
  return clasa;
}

// ── Scadențele ──────────────────────────────────────────────────────────────

export interface Scadenta {
  readonly vehicleId: string;
  /** Ce scade: „RCA”, „Revizie (km)”, „Răspuns la PV 123”. */
  readonly ce: string;
  /** Ziua scadenței; `null` = lipsește cu totul (documentul obligatoriu neînregistrat). */
  readonly data: string | null;
  /** O scadență pe kilometri nu are zi; `kmRamasi` negativ = depășită. */
  readonly kmRamasi?: number | null;
}

function rang(s: Scadenta, azi: string): number {
  if (s.data !== null && s.data < azi) return 0;
  if (s.kmRamasi !== undefined && s.kmRamasi !== null && s.kmRamasi <= 0) return 0;
  if (s.data === null && (s.kmRamasi === undefined || s.kmRamasi === null)) return 1;
  return 2;
}

/**
 * Întâi ce e deja trecut (expirat, depășit), apoi ce lipsește, apoi ce urmează,
 * fiecare grup după dată. Între două egale, ordinea primită (`sort` e stabil).
 */
export function ordoneazaScadente<T extends Scadenta>(scadente: readonly T[], azi: string): T[] {
  return [...scadente].sort((a, b) => {
    const r = rang(a, azi) - rang(b, azi);
    if (r !== 0) return r;
    return (a.data ?? "9999-12-31").localeCompare(b.data ?? "9999-12-31");
  });
}

/** Zilele dintre două zile `AAAA-LL-ZZ` (negativ = în trecut). Fără fus: zile calendaristice. */
export function zileIntre(de: string, la: string): number {
  return Math.round((Date.parse(`${la}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}
