// src/domain/maintenance/proiectie.ts
/**
 * Proiecția scadenței pe CONTOR în timp calendaristic și grila planurilor cu
 * mod de calcul „fix”. Funcții pure, fără I/O; apelantul aduce citirile.
 *
 * Un plan „la 500 de ore” nu spune singur CÂND vine; ritmul de lucru al
 * utilajului o spune. Din ultimele citiri se estimează ritmul (unități pe zi) și
 * ziua în care contorul ar atinge ținta. Estimarea e marcată ca atare și lipsește
 * când datele nu o susțin — mai bine „—” decât o dată inventată.
 */

export interface CitirePentruProiectie {
  /** Ziua citirii, ISO (`2026-10-07`). */
  readonly data: string;
  readonly citire: number;
}

/** Fereastra din care se estimează ritmul. */
export const FEREASTRA_PROIECTIE_ZILE = 90;
/** Sub atâtea citiri în fereastră nu se estimează nimic. */
export const MINIM_CITIRI_PROIECTIE = 3;
/** Sub atâtea zile între prima și ultima citire din fereastră nu se estimează nimic. */
export const MINIM_ZILE_PROIECTIE = 7;

const ZI_MS = 86_400_000;

function ziUtc(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

function plusZile(iso: string, zile: number): string {
  return new Date(ziUtc(iso) + zile * ZI_MS).toISOString().slice(0, 10);
}

export interface Proiectie {
  /** Unități de contor pe zi, din fereastră. */
  readonly ritmPeZi: number;
  /** Ziua estimată la care contorul atinge ținta; `null` dacă e deja atinsă. */
  readonly dataEstimata: string | null;
  /** Câte zile mai sunt până la țintă (negativ = depășită). */
  readonly zileRamase: number;
}

/**
 * Ritmul și ziua estimată a scadenței pe contor.
 *
 * Întoarce `null` când: ținta lipsește, nu există cel puțin 3 citiri în ultimele
 * 90 de zile, citirile acoperă mai puțin de 7 zile, sau contorul nu a avansat
 * (ritm zero — utilaj oprit; nu se poate spune când va ajunge).
 */
export function proiectieScadentaContor(
  citiri: readonly CitirePentruProiectie[],
  tinta: number | null,
  azi: string,
): Proiectie | null {
  if (tinta === null) return null;
  const limita = plusZile(azi, -FEREASTRA_PROIECTIE_ZILE);
  const inFereastra = [...citiri]
    .filter((c) => c.data >= limita && c.data <= azi)
    .sort((a, b) => a.data.localeCompare(b.data));
  if (inFereastra.length < MINIM_CITIRI_PROIECTIE) return null;
  const prima = inFereastra[0];
  const ultima = inFereastra[inFereastra.length - 1];
  if (prima === undefined || ultima === undefined) return null;
  const zile = (ziUtc(ultima.data) - ziUtc(prima.data)) / ZI_MS;
  if (zile < MINIM_ZILE_PROIECTIE) return null;
  const avans = ultima.citire - prima.citire;
  if (avans <= 0) return null;
  const ritm = avans / zile;
  const ramas = tinta - ultima.citire;
  const zileRamase =
    Math.round(ramas / ritm) - Math.round((ziUtc(azi) - ziUtc(ultima.data)) / ZI_MS);
  return {
    ritmPeZi: ritm,
    dataEstimata: ramas <= 0 ? null : plusZile(azi, Math.max(0, zileRamase)),
    zileRamase,
  };
}

/** Contorul e „învechit” când ultima citire e mai veche decât pragul din setări. */
export function contorInvechit(ultimaData: string | null, azi: string, pragZile: number): boolean {
  if (ultimaData === null) return true;
  return (ziUtc(azi) - ziUtc(ultimaData)) / ZI_MS > pragZile;
}

/**
 * Grila planurilor „fixe”: prima dată de pe grila pornită din `ancora`, cu pasul
 * `intervalZile`, care e ≥ `azi` și STRICT după `ultimaExecutie` (dacă există).
 * Oglinda lui `internal.ssm_plan_calc` din 0183 — același rezultat, ca ecranul
 * să poată explica scadența fără să o recalculeze din bază.
 */
export function urmatoareaPeGrila(
  ancora: string,
  intervalZile: number,
  azi: string,
  ultimaExecutie: string | null = null,
): string {
  if (intervalZile <= 0) return ancora;
  const tinta = Math.max(
    ziUtc(azi),
    ultimaExecutie === null ? ziUtc(azi) : ziUtc(ultimaExecutie) + ZI_MS,
  );
  const baza = ziUtc(ancora);
  const n = Math.max(0, Math.ceil((tinta - baza) / (intervalZile * ZI_MS)));
  return new Date(baza + n * intervalZile * ZI_MS).toISOString().slice(0, 10);
}
