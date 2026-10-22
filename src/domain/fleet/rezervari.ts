// src/domain/fleet/rezervari.ts
//
// Rezervările mașinilor de pool (0216, F12d): stările, aritmetica zilelor și
// grila de ocupare. Pur, fără I/O.
//
// ── ZILE ÎNTREGI ─────────────────────────────────────────────────────────────
// Rezervarea ține `de_la` și `pana_la` ca zile calendaristice ale României,
// AMBELE incluse (decizia I-d1): foaia de parcurs e „o foaie pe vehicul și zi”
// (0200), deci o rezervare pe ore n-ar avea cu ce se potrivi. Toate funcțiile
// lucrează pe șiruri `YYYY-MM-DD`, comparate lexical, niciodată pe `Date` locale.
//
// ── „ÎNCHEIATĂ” NU E O STARE ÎN BAZĂ ─────────────────────────────────────────
// Baza are patru statusuri; ce vede omul se DERIVĂ din status și din ziua de
// azi (`stareAfisata`). Altfel ar trebui un job care să scrie „încheiată”.
//
// Constantele de mai jos sunt oglinda migrării; `rezervari.test.ts` citește
// `0216_flota_rezervari.sql` și le compară.

import { adaugaZile } from "@/domain/attendance/saptamana";

export const STATUS_REZERVARE = ["ceruta", "confirmata", "respinsa", "anulata"] as const;
export type StatusRezervare = (typeof STATUS_REZERVARE)[number];

/** Implicitul coloanei `fleet_settings.rezervari_max_zile` (decizia I-d5). */
export const REZERVARI_MAX_ZILE_IMPLICIT = 14;
/** Intervalul CHECK-ului `fs_rezervari_max_zile_ck`. */
export const REZERVARI_MAX_ZILE = { min: 1, max: 92 } as const;
/** Fereastra maximă a lui `public.ocuparea_vehiculelor_pool` (altfel 22023). */
export const FEREASTRA_OCUPARE_MAX_ZILE = 63;
/** Câte zile arată grila de ocupare, de la azi. */
export const ZILE_GRILA = 14;

export const STARI_AFISATE = [
  "in_asteptare",
  "expirata_nedecisa",
  "viitoare",
  "in_curs",
  "incheiata",
  "respinsa",
  "anulata",
] as const;
export type StareAfisata = (typeof STARI_AFISATE)[number];

export const ETICHETE_STARE_AFISATA: Readonly<Record<StareAfisata, string>> = {
  in_asteptare: "În așteptare",
  expirata_nedecisa: "Expirată nedecisă",
  viitoare: "Confirmată",
  in_curs: "În curs",
  incheiata: "Încheiată",
  respinsa: "Respinsă",
  anulata: "Anulată",
};

export interface IntervalZile {
  readonly de_la: string;
  readonly pana_la: string;
}

export interface RezervareDeStare extends IntervalZile {
  readonly status: StatusRezervare;
}

const ZI_MS = 86_400_000;

/** Zilele rezervării, cu ambele capete: o rezervare de o zi are 1. */
export function zileRezervare(deLa: string, panaLa: string): number {
  const a = Date.parse(`${deLa}T00:00:00Z`);
  const b = Date.parse(`${panaLa}T00:00:00Z`);
  return Math.round((b - a) / ZI_MS) + 1;
}

/** Intervale ÎNCHISE de zile: luni–luni și marți–marți nu se suprapun. */
export function seSuprapun(a: IntervalZile, b: IntervalZile): boolean {
  return a.de_la <= b.pana_la && b.de_la <= a.pana_la;
}

/** Ce vede omul. `azi` e ziua României (`todayInBucharest()`). */
export function stareAfisata(rez: RezervareDeStare, azi: string): StareAfisata {
  switch (rez.status) {
    case "ceruta":
      return rez.pana_la < azi ? "expirata_nedecisa" : "in_asteptare";
    case "confirmata":
      if (rez.de_la > azi) return "viitoare";
      return rez.pana_la < azi ? "incheiata" : "in_curs";
    case "respinsa":
      return "respinsa";
    case "anulata":
      return "anulata";
  }
}

/** Ziua minimă la care se poate scurta: `max(de_la, azi)`, ca triggerul. */
export function pragScurtare(rez: IntervalZile, azi: string): string {
  return rez.de_la > azi ? rez.de_la : azi;
}

/** Ultima zi permisă de durata maximă a firmei, pornind de la `deLa`. */
export function panaLaMaxim(deLa: string, maxZile: number): string {
  return adaugaZile(deLa, Math.max(1, maxZile) - 1);
}

const ACTIVE: ReadonlySet<StatusRezervare> = new Set(["ceruta", "confirmata"]);

/** Decizia: doar o cerere care n-a trecut (după ultima zi, baza o refuză). */
export function poateDecide(rez: RezervareDeStare, azi: string): boolean {
  return rez.status === "ceruta" && rez.pana_la >= azi;
}

/** Anularea: cererea oricând; confirmata până în ultima ei zi. */
export function poateAnula(rez: RezervareDeStare, azi: string): boolean {
  if (rez.status === "ceruta") return true;
  return rez.status === "confirmata" && rez.pana_la >= azi;
}

/** Scurtarea cere loc: o zi mai devreme decât `pana_la`, dar nu înaintea pragului. */
export function poateScurta(rez: RezervareDeStare, azi: string): boolean {
  return ACTIVE.has(rez.status) && rez.pana_la >= azi && pragScurtare(rez, azi) < rez.pana_la;
}

// ── Grila de ocupare ───────────────────────────────────────────────────────

export const SURSE_OCUPARE = ["rezervare", "foaie", "alocare"] as const;
export type SursaOcupare = (typeof SURSE_OCUPARE)[number];

/** Un rând din `public.ocuparea_vehiculelor_pool`. Fără identitatea colegilor. */
export interface Ocupare {
  readonly vehicle_id: string;
  readonly de_la: string;
  readonly pana_la: string;
  readonly sursa: SursaOcupare;
  /** Statusul rezervării sau al foii; NULL pe alocări. */
  readonly status: string | null;
  readonly a_mea: boolean;
  /** Doar pe rezervările apelantului. */
  readonly rezervare_id: string | null;
}

export type StareCelula = "liber" | "al_meu" | "ocupat" | "in_asteptare";

export interface CelulaOcupare {
  readonly zi: string;
  readonly stare: StareCelula;
  readonly sursa: SursaOcupare | null;
  readonly rezervareId: string | null;
}

export interface VehiculGrila {
  readonly id: string;
  readonly nr_inmatriculare: string;
}

export interface GrilaOcupare<V extends VehiculGrila> {
  readonly zile: readonly string[];
  readonly randuri: readonly Readonly<{ vehicul: V; celule: readonly CelulaOcupare[] }>[];
}

/** Ordinea de prioritate pe aceeași celulă: al meu > ocupat > în așteptare > liber. */
const PRIORITATE: Readonly<Record<StareCelula, number>> = {
  liber: 0,
  in_asteptare: 1,
  ocupat: 2,
  al_meu: 3,
};

function stareaOcuparii(o: Ocupare): StareCelula {
  if (o.a_mea) return "al_meu";
  if (o.sursa === "rezervare" && o.status === "ceruta") return "in_asteptare";
  return "ocupat";
}

/** Matricea zi × vehicul, pentru grila din `/flota/rezervari` și din portal. */
export function grilaOcupare<V extends VehiculGrila>(
  ocupari: readonly Ocupare[],
  vehicule: readonly V[],
  deLa: string,
  zile: number,
): GrilaOcupare<V> {
  const listaZile = Array.from({ length: Math.max(0, zile) }, (_, i) => adaugaZile(deLa, i));
  const randuri = vehicule.map((vehicul) => {
    const aleLui = ocupari.filter((o) => o.vehicle_id === vehicul.id);
    const celule = listaZile.map((zi): CelulaOcupare => {
      let celula: CelulaOcupare = { zi, stare: "liber", sursa: null, rezervareId: null };
      for (const o of aleLui) {
        if (zi < o.de_la || zi > o.pana_la) continue;
        const stare = stareaOcuparii(o);
        if (PRIORITATE[stare] > PRIORITATE[celula.stare]) {
          celula = { zi, stare, sursa: o.sursa, rezervareId: o.rezervare_id };
        }
      }
      return celula;
    });
    return { vehicul, celule };
  });
  return { zile: listaZile, randuri };
}
