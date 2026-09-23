// src/domain/per-diem/ferestre.ts
/**
 * Port pur al `app.calculeaza_zile_diurna` (0015_per_diem.sql).
 *
 * Motorul de calcul trăiește în schema `app`, care NU e expusă prin PostgREST
 * (supabase/config.toml: `schemas = ["public","graphql_public"]`) și nu apare
 * în `Database["public"]["Functions"]`. `.rpc('calculeaza_zile_diurna')` sau
 * `.rpc('recalculeaza_diurna')` nu compilează și nu rulează — de aceea
 * algoritmul e portat 1:1 aici, ca funcție pură, testată separat față de bază.
 *
 * VERIFICAT pe adm_p_oper (vezi docs/design/ecrane/diurna.md §4):
 *   22:00 → 06:00 (8 ore)                     ⇒ 0 ferestre
 *   10.03 08:00 → 13.03 08:00 (72 ore, exact) ⇒ 3 × fracțiune 1.0
 *   10.03 08:00 → 13.03 00:00 (64 ore)        ⇒ 1.0 + 1.0 + 0.5
 */

import { momentDinOraRomaniei, toBucharestDateString } from "@/lib/format/date";

import { orePeTara, type PunctTara } from "./ore-pe-tara";

export const REGULI_TRECERE_FRONTIERA = [
  "tara_plecare",
  "tara_sosire",
  "tara_cu_valoare_mai_mare",
  "durata_maxima",
] as const;
export type RegulaTrecereFrontiera = (typeof REGULI_TRECERE_FRONTIERA)[number];

/**
 * Cum se numără zilele de diurnă (`per_diem_policies.mod_calcul_zile`, 0156):
 * - `ferestre_24h` — câte 24 de ore de la plecare; restul final e tăiat de praguri;
 * - `zile_calendaristice` — fiecare zi din calendar (ora României) în care omul
 *   e pe drum se plătește întreagă, inclusiv ziua plecării și a întoarcerii.
 */
export const MODURI_CALCUL_ZILE = ["ferestre_24h", "zile_calendaristice"] as const;
export type ModCalculZile = (typeof MODURI_CALCUL_ZILE)[number];

export interface ParametriiFerestre {
  /** Lipsă = `ferestre_24h`, ca valoarea implicită a coloanei. */
  readonly modCalculZile?: ModCalculZile;
  readonly plecare: Date;
  readonly sosire: Date;
  readonly pragOreMinim: number;
  readonly pragOreZiIntreaga: number;
  readonly fractiuneZiPartiala: number;
  readonly acordaZiuaTrecerii: boolean;
  readonly regulaTrecere: RegulaTrecereFrontiera;
  readonly taraImplicitaId: string;
  readonly etape: readonly PunctTara[];
  /**
   * Valoarea baremului (indiferent de monedă) pentru o țară, la data
   * ferestrei (`AAAA-LL-ZZ`) — folosită STRICT la departajarea
   * `tara_cu_valoare_mai_mare`. `null` când nu există barem valabil la acea
   * dată: departajarea trece atunci pe ultimul criteriu, orele din fereastră
   * (oglinda „nulls last” din `ORDER BY ... desc nulls last`).
   */
  readonly cautaValoareBarem: (countryId: string, dataFereastra: string) => number | null;
}

export interface FereastraDiurna {
  readonly numarFereastra: number;
  readonly deLa: Date;
  readonly panaLa: Date;
  readonly taraId: string;
  readonly fractiune: number;
  readonly oreFereastra: number;
  readonly motiv: string;
}

const ORE_PE_ZI = 24;
const MS_PE_ORA = 3_600_000;
const MS_PE_ZI = ORE_PE_ZI * MS_PE_ORA;

function laZiIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Ziua din calendar a României (`AAAA-LL-ZZ`) în care cade un moment. */
function ziBucuresti(moment: Date): string {
  return toBucharestDateString(moment);
}

/**
 * Miezul nopții de la începutul zilei `zi`, ora României, ca moment absolut —
 * oglinda lui `zi::timestamp at time zone 'Europe/Bucharest'`.
 */
function miezulNoptiiBucuresti(zi: string): Date {
  const moment = momentDinOraRomaniei(`${zi}T00:00`);
  if (moment === null) throw new TypeError(`Zi invalidă: ${zi}`);
  return new Date(moment);
}

function ziuaUrmatoare(zi: string): string {
  const d = new Date(`${zi}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type TaraCuOre = ReturnType<typeof orePeTara>[number];

function primarSortValue(
  tara: TaraCuOre,
  regula: RegulaTrecereFrontiera,
  dataFereastra: string,
  cautaValoareBarem: ParametriiFerestre["cautaValoareBarem"],
): number {
  switch (regula) {
    case "tara_plecare":
      // asc: cea mai mică valoare (cel mai devreme moment) câștigă.
      return tara.primulMoment.getTime();
    case "tara_sosire":
      // desc pe ultimul_moment ⇒ negat, ca sortarea ascendentă să dea același rezultat.
      return -tara.ultimulMoment.getTime();
    case "durata_maxima":
      return -tara.ore;
    case "tara_cu_valoare_mai_mare": {
      const valoare = cautaValoareBarem(tara.countryId, dataFereastra);
      // „desc nulls last”: fără barem, țara pierde departajarea asta — trimisă
      // la coadă indiferent de restul valorilor.
      return valoare === null ? Number.POSITIVE_INFINITY : -valoare;
    }
  }
}

/** Alege O SINGURĂ țară pentru o fereastră care atinge mai multe. */
function alegeTaraFerestrei(
  tari: readonly TaraCuOre[],
  regula: RegulaTrecereFrontiera,
  dataFereastra: string,
  cautaValoareBarem: ParametriiFerestre["cautaValoareBarem"],
): string | null {
  if (tari.length === 0) return null;
  if (tari.length === 1) {
    const unica = tari[0];
    return unica === undefined ? null : unica.countryId;
  }

  const sortate = [...tari].sort((a, b) => {
    const primarA = primarSortValue(a, regula, dataFereastra, cautaValoareBarem);
    const primarB = primarSortValue(b, regula, dataFereastra, cautaValoareBarem);
    if (primarA !== primarB) return primarA - primarB;
    // Ultima coloană din ORDER BY, mereu prezentă: „o.ore desc”.
    return b.ore - a.ore;
  });
  const prima = sortate[0];
  return prima === undefined ? null : prima.countryId;
}

/**
 * Țara unei ferestre și efectul trecerii frontierei — comune ambelor moduri.
 * Ziua trecerii se plătește O SINGURĂ dată, unei singure țări.
 */
function construiesteFereastra(
  p: ParametriiFerestre,
  numarFereastra: number,
  deLa: Date,
  panaLa: Date,
  fractiuneInitiala: number,
  motivInitial: string,
): FereastraDiurna {
  let fractiune = fractiuneInitiala;
  let motiv = motivInitial;
  const tariFereastra = orePeTara(p.etape, p.plecare, p.sosire, deLa, panaLa, p.taraImplicitaId);
  const taraAleasa = alegeTaraFerestrei(
    tariFereastra,
    p.regulaTrecere,
    laZiIso(deLa),
    p.cautaValoareBarem,
  );

  if (tariFereastra.length > 1) {
    if (p.acordaZiuaTrecerii) {
      motiv = `${motiv}; trecere de frontieră — ziua atribuită unei singure țări (${p.regulaTrecere})`;
    } else {
      fractiune = 0;
      motiv = "trecere de frontieră — politica firmei nu acordă diurnă în această zi";
    }
  }

  return {
    numarFereastra,
    deLa,
    panaLa,
    taraId: taraAleasa ?? p.taraImplicitaId,
    fractiune,
    oreFereastra: (panaLa.getTime() - deLa.getTime()) / MS_PE_ORA,
    motiv,
  };
}

/**
 * Fiecare zi din calendar atinsă de deplasare e o fereastră întreagă —
 * oglinda lui `app.calculeaza_zile_diurna_calendar` (0156). Pragul minim se
 * aplică doar duratei TOTALE: o deplasare mai scurtă nu primește nimic.
 * O zi atinsă doar în clipa de miezul nopții (sosire la 00:00) nu contează.
 */
function zileCalendaristice(p: ParametriiFerestre): readonly FereastraDiurna[] {
  const ferestre: FereastraDiurna[] = [];
  const ultima = ziBucuresti(p.sosire);
  let numar = 0;
  for (let zi = ziBucuresti(p.plecare); zi <= ultima; zi = ziuaUrmatoare(zi)) {
    const inceput = miezulNoptiiBucuresti(zi);
    const sfarsit = miezulNoptiiBucuresti(ziuaUrmatoare(zi));
    const deLa = inceput.getTime() > p.plecare.getTime() ? inceput : p.plecare;
    const panaLa = sfarsit.getTime() < p.sosire.getTime() ? sfarsit : p.sosire;
    if (panaLa.getTime() <= deLa.getTime()) continue;
    numar += 1;
    ferestre.push(construiesteFereastra(p, numar, deLa, panaLa, 1, "zi din calendar pe drum"));
  }
  return ferestre;
}

/**
 * Împarte deplasarea în ferestre și atribuie fiecăreia o fracțiune de zi
 * (0 / parțială / 1) și O SINGURĂ țară. În modul implicit, `ferestre_24h`,
 * ferestrele sunt consecutive, de câte 24 de ore de la momentul plecării — NU
 * de la miezul nopții calendaristic; în `zile_calendaristice`, sunt zilele din
 * calendar.
 *
 * Toate pragurile sunt parametri veniți din `per_diem_policies` — nicio
 * constantă legală nu e scrisă în acest fișier.
 */
export function calculeazaZileDiurna(p: ParametriiFerestre): readonly FereastraDiurna[] {
  if (p.sosire.getTime() <= p.plecare.getTime()) return [];

  const durataOre = (p.sosire.getTime() - p.plecare.getTime()) / MS_PE_ORA;

  // Sub pragul minim nu se acordă nimic: 22:00 → 06:00 (8 ore) ⇒ ZERO zile.
  if (durataOre < p.pragOreMinim) return [];

  if (p.modCalculZile === "zile_calendaristice") return zileCalendaristice(p);

  const ferestreIntregi = Math.floor(durataOre / ORE_PE_ZI);
  const rest = durataOre - ferestreIntregi * ORE_PE_ZI;
  const total = ferestreIntregi + (rest > 0 ? 1 : 0);

  const ferestre: FereastraDiurna[] = [];

  for (let i = 1; i <= total; i += 1) {
    const deLa = new Date(p.plecare.getTime() + (i - 1) * MS_PE_ZI);
    const capat = new Date(p.plecare.getTime() + i * MS_PE_ZI);
    const panaLa = capat.getTime() < p.sosire.getTime() ? capat : p.sosire;

    let fractiune: number;
    let motiv: string;
    if (i <= ferestreIntregi) {
      fractiune = 1;
      motiv = "fereastră completă de 24 de ore";
    } else if (rest >= p.pragOreZiIntreaga) {
      fractiune = 1;
      motiv = "restul depășește pragul pentru zi întreagă";
    } else if (rest >= p.pragOreMinim) {
      fractiune = p.fractiuneZiPartiala;
      motiv = "restul se încadrează între pragul minim și pragul pentru zi întreagă";
    } else {
      fractiune = 0;
      motiv = "restul este sub pragul minim";
    }

    ferestre.push(construiesteFereastra(p, i, deLa, panaLa, fractiune, motiv));
  }

  return ferestre;
}
