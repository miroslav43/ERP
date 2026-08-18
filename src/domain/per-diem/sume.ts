// src/domain/per-diem/sume.ts
/**
 * Partea monetară a motorului de calcul, port pur al buclei din
 * `app.recalculeaza_diurna` (0015_per_diem.sql) care urmează după
 * `calculeaza_zile_diurna`.
 *
 * `per_diem_calculations` are DOAR politică de SELECT — clientul nu poate
 * scrie în ea niciodată, iar `app.recalculeaza_diurna` trăiește în schema
 * `app`, neexpusă prin PostgREST. Suma afișată se calculează aici, în
 * TypeScript, din aceleași date pe care le-ar folosi funcția din bază
 * (politica valabilă la data plecării + baremul pe țări).
 */

import type { FereastraDiurna } from "./ferestre";

export interface RandDatat {
  readonly valabilDeLa: string;
  readonly valabilPana: string | null;
}

/**
 * Portul selecției „ultimul rând valabil la o dată”, comună celor două
 * tabele cu istoric din 0015 (`per_diem_policies`, `per_diem_country_rates`):
 *
 *   valabil_de_la <= data AND (valabil_pana IS NULL OR valabil_pana >= data)
 *   ORDER BY valabil_de_la DESC LIMIT 1
 */
export function gasesteRandValabil<T extends RandDatat>(
  randuri: readonly T[],
  dataISO: string,
): T | null {
  let ales: T | null = null;
  for (const rand of randuri) {
    if (rand.valabilDeLa > dataISO) continue;
    if (rand.valabilPana !== null && rand.valabilPana < dataISO) continue;
    if (ales === null || rand.valabilDeLa > ales.valabilDeLa) ales = rand;
  }
  return ales;
}

export interface BaremTara extends RandDatat {
  readonly countryId: string;
  readonly categorie: string;
  readonly valoare: number;
  readonly moneda: string;
}

/** Portul `app.per_diem_barem`. */
export function baremLaData(
  baremuri: readonly BaremTara[],
  countryId: string,
  categorie: string,
  dataISO: string,
): BaremTara | null {
  return gasesteRandValabil(
    baremuri.filter((b) => b.countryId === countryId && b.categorie === categorie),
    dataISO,
  );
}

export interface PoliticaDiurna {
  readonly countryIdIntern: string;
  readonly monedaInterna: string;
  readonly diurnaInternaZi: number;
  readonly diurnaBazaLegalaInterna: number;
  readonly multiploPlafonNeimpozabil: number;
  readonly multiploDiurnaExterna: number;
  readonly categorieBarem: string;
}

/** Starea unei ferestre după încercarea de a-i calcula suma. */
export type StareDetaliuFereastra = "ok" | "fara_barem" | "fara_curs";

export interface DetaliuFereastra {
  readonly fereastra: FereastraDiurna;
  readonly stare: StareDetaliuFereastra;
  readonly valoareZi: number | null;
  readonly plafonZi: number | null;
  readonly moneda: string | null;
  readonly curs: number | null;
  readonly lei: number | null;
  readonly plafonLei: number | null;
}

export interface RezultatDiurna {
  readonly detalii: readonly DetaliuFereastra[];
  readonly zileTotal: number;
  /** `null` când oricare fereastră are baremul sau cursul lipsă — NU se inventează. */
  readonly valoareLei: number | null;
  readonly plafonNeimpozabilLei: number | null;
  readonly parteNeimpozabilaLei: number | null;
  readonly parteImpozabilaLei: number | null;
  /** Cel puțin o fereastră străină nu are curs valutar cunoscut. */
  readonly cursIncomplet: boolean;
  /** Cel puțin o fereastră străină nu are barem încărcat la acea dată. */
  readonly baremLipsa: boolean;
}

/** Rotunjire aritmetică la doi zecimali (evită artefactele de virgulă mobilă). */
function rotunjeste(valoare: number): number {
  return Math.round((valoare + Number.EPSILON) * 100) / 100;
}

function laZiIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Calculează suma diurnei pentru un set de ferestre deja produse de
 * `calculeazaZileDiurna`.
 *
 * `cursDiurna` = `business_trips.curs_diurna` (curs BNR la data plecării);
 * `null` înseamnă că nimeni nu l-a introdus încă. Pentru moneda internă
 * cursul e implicit 1, indiferent de ce s-a trimis.
 */
export function calculeazaSume(
  ferestre: readonly FereastraDiurna[],
  politica: PoliticaDiurna,
  baremuri: readonly BaremTara[],
  cursDiurna: number | null,
): RezultatDiurna {
  let zileTotal = 0;
  let lei = 0;
  let plafonLei = 0;
  let cursIncomplet = false;
  let baremLipsa = false;
  const detalii: DetaliuFereastra[] = [];

  for (const fereastra of ferestre) {
    zileTotal += fereastra.fractiune;
    const dataFereastra = laZiIso(fereastra.deLa);

    let valoareZi: number;
    let plafonZi: number;
    let moneda: string;

    if (fereastra.taraId === politica.countryIdIntern) {
      valoareZi = politica.diurnaInternaZi;
      plafonZi = politica.multiploPlafonNeimpozabil * politica.diurnaBazaLegalaInterna;
      moneda = politica.monedaInterna;
    } else {
      const barem = baremLaData(baremuri, fereastra.taraId, politica.categorieBarem, dataFereastra);
      if (barem === null) {
        baremLipsa = true;
        detalii.push({
          fereastra,
          stare: "fara_barem",
          valoareZi: null,
          plafonZi: null,
          moneda: null,
          curs: null,
          lei: null,
          plafonLei: null,
        });
        continue;
      }
      valoareZi = barem.valoare * politica.multiploDiurnaExterna;
      plafonZi = barem.valoare * politica.multiploPlafonNeimpozabil;
      moneda = barem.moneda;
    }

    const curs = moneda === politica.monedaInterna ? 1 : cursDiurna;
    if (curs === null) {
      cursIncomplet = true;
      detalii.push({
        fereastra,
        stare: "fara_curs",
        valoareZi,
        plafonZi,
        moneda,
        curs: null,
        lei: null,
        plafonLei: null,
      });
      continue;
    }

    const leiFereastra = rotunjeste(fereastra.fractiune * valoareZi * curs);
    const plafonLeiFereastra = rotunjeste(fereastra.fractiune * plafonZi * curs);
    lei += leiFereastra;
    plafonLei += plafonLeiFereastra;
    detalii.push({
      fereastra,
      stare: "ok",
      valoareZi,
      plafonZi,
      moneda,
      curs,
      lei: leiFereastra,
      plafonLei: plafonLeiFereastra,
    });
  }

  const incomplet = cursIncomplet || baremLipsa;

  return {
    detalii,
    zileTotal: rotunjeste(zileTotal),
    valoareLei: incomplet ? null : rotunjeste(lei),
    plafonNeimpozabilLei: incomplet ? null : rotunjeste(plafonLei),
    // PLAFONUL ÎMPARTE, NU BLOCHEAZĂ: partea neimpozabilă e minimul dintre
    // valoare și plafon, restul devine venit asimilat salariului.
    parteNeimpozabilaLei: incomplet ? null : rotunjeste(Math.min(lei, plafonLei)),
    parteImpozabilaLei: incomplet ? null : rotunjeste(Math.max(lei - plafonLei, 0)),
    cursIncomplet,
    baremLipsa,
  };
}
