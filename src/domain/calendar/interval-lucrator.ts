// src/domain/calendar/interval-lucrator.ts
import { sarbatoriDupaZi } from "./sarbatori";

/**
 * Intervale de zile lucrătoare, pentru uneltele publice: câte zile lucrătoare
 * are un interval și care e a N-a zi lucrătoare după o dată.
 *
 * Funcții PURE, pe zile calendaristice ISO (`2026-11-05`). `Date` apare doar
 * în UTC, ca pas de calcul: comparațiile se fac pe șiruri, deci fusul orar al
 * mașinii nu poate muta o zi. Sărbătorile vin din `sarbatoriDupaZi`, același
 * calendar ca foaia de pontaj și cererea de concediu.
 *
 * ── CE NU SCADE ───────────────────────────────────────────────────────────
 * Zilele libere din contractul colectiv sau din regulamentul intern: sunt ale
 * fiecărei firme. Paginile care folosesc modulul o spun.
 *
 * ── A N-A ZI „DUPĂ” ───────────────────────────────────────────────────────
 * Ziua de pornire nu se numără. E regula pe care ÎCCJ a stabilit-o pentru
 * preavizul la concediere (RIL nr. 8/2024, MO nr. 573 din 19.06.2024, citat
 * în Codul muncii consolidat la 27.04.2026, sub art. 75): termenul curge din
 * ziua următoare comunicării și se împlinește în ultima zi a lui.
 */

export type ZiIso = string;

/** Anii pentru care uneltele răspund. Calendarul e corect din 2017 (B1); oferim 2024–2035. */
export const AN_MIN_INTERVAL = 2024;
export const AN_MAX_INTERVAL = 2035;
/** Cel mai lung preaviz legal e de 45 de zile lucrătoare; 400 acoperă orice termen rezonabil. */
export const MAX_ZILE_DE_ADAUGAT = 400;

export type SarbatoareInInterval = Readonly<{ data: ZiIso; denumire: string }>;

export type IntervalLucrator = Readonly<{
  deLa: ZiIso;
  panaLa: ZiIso;
  zileCalendaristice: number;
  zileLucratoare: number;
  zileWeekend: number;
  /** Sărbătorile căzute luni–vineri, adică cele care chiar au scăzut o zi. */
  sarbatoriScazute: readonly SarbatoareInInterval[];
}>;

const ZI_MS = 86_400_000;
const FORMA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/u;

const LUNI = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

/** Duminica e prima, ca la `getUTCDay()`. */
const ZILE = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"] as const;

function dinIso(valoare: string): Date | null {
  const potrivire = FORMA_ISO.exec(valoare);
  if (potrivire === null) return null;
  const [, a, l, z] = potrivire;
  const an = Number(a);
  const luna = Number(l);
  const zi = Number(z);
  const data = new Date(Date.UTC(an, luna - 1, zi));
  // `Date.UTC` mută tăcut „30 februarie” pe 2 martie; o zi inexistentă e refuzată.
  if (data.getUTCFullYear() !== an || data.getUTCMonth() !== luna - 1 || data.getUTCDate() !== zi) {
    return null;
  }
  return data;
}

function laIso(data: Date): ZiIso {
  return `${String(data.getUTCFullYear()).padStart(4, "0")}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

function inWeekend(data: Date): boolean {
  const zi = data.getUTCDay();
  return zi === 0 || zi === 6;
}

/** Harta sărbătorilor, construită o dată pe an. */
const sarbatoriPeAn = new Map<number, ReadonlyMap<string, string>>();
function sarbatoarea(zi: ZiIso): string | undefined {
  const an = Number(zi.slice(0, 4));
  let harta = sarbatoriPeAn.get(an);
  if (harta === undefined) {
    harta = sarbatoriDupaZi(an);
    sarbatoriPeAn.set(an, harta);
  }
  return harta.get(zi);
}

/** Ziua reală dintr-un an acoperit, ca ISO, sau `null`. */
export function ziValida(valoare: string): ZiIso | null {
  const data = dinIso(valoare.trim());
  if (data === null) return null;
  const an = data.getUTCFullYear();
  return an >= AN_MIN_INTERVAL && an <= AN_MAX_INTERVAL ? laIso(data) : null;
}

function cereZi(valoare: string): Date {
  const valida = ziValida(valoare);
  const data = valida === null ? null : dinIso(valida);
  if (data === null) {
    throw new RangeError(
      `„${valoare.slice(0, 20)}” nu e o zi reală între ${String(AN_MIN_INTERVAL)} și ${String(AN_MAX_INTERVAL)}.`,
    );
  }
  return data;
}

export function ziuaUrmatoare(zi: ZiIso): ZiIso {
  const data = dinIso(zi);
  if (data === null) throw new RangeError(`„${zi.slice(0, 20)}” nu e o zi calendaristică.`);
  return laIso(new Date(data.getTime() + ZI_MS));
}

export function esteZiLucratoare(zi: ZiIso): boolean {
  const data = cereZi(zi);
  return !inWeekend(data) && sarbatoarea(laIso(data)) === undefined;
}

export function numaraInterval(deLa: ZiIso, panaLa: ZiIso): IntervalLucrator {
  const inceput = cereZi(deLa);
  const sfarsit = cereZi(panaLa);
  if (sfarsit.getTime() < inceput.getTime()) {
    throw new RangeError("Data de sfârșit e înaintea celei de început.");
  }
  let zileLucratoare = 0;
  let zileWeekend = 0;
  const sarbatoriScazute: SarbatoareInInterval[] = [];
  for (let t = inceput.getTime(); t <= sfarsit.getTime(); t += ZI_MS) {
    const data = new Date(t);
    if (inWeekend(data)) {
      zileWeekend += 1;
      continue;
    }
    const zi = laIso(data);
    const denumire = sarbatoarea(zi);
    if (denumire !== undefined) {
      sarbatoriScazute.push({ data: zi, denumire });
      continue;
    }
    zileLucratoare += 1;
  }
  return {
    deLa: laIso(inceput),
    panaLa: laIso(sfarsit),
    zileCalendaristice: Math.round((sfarsit.getTime() - inceput.getTime()) / ZI_MS) + 1,
    zileLucratoare,
    zileWeekend,
    sarbatoriScazute,
  };
}

export function aNaZiLucratoareDupa(dupa: ZiIso, numar: number): ZiIso {
  const pornire = cereZi(dupa);
  if (!Number.isInteger(numar) || numar < 0 || numar > MAX_ZILE_DE_ADAUGAT) {
    throw new RangeError(
      `Numărul de zile lucrătoare trebuie să fie întreg, între 0 și ${String(MAX_ZILE_DE_ADAUGAT)}.`,
    );
  }
  let ramase = numar;
  let t = pornire.getTime();
  while (ramase > 0) {
    t += ZI_MS;
    const data = new Date(t);
    if (data.getUTCFullYear() > AN_MAX_INTERVAL) {
      throw new RangeError(
        `Termenul trece de ${String(AN_MAX_INTERVAL)}, ultimul an pentru care avem calendarul.`,
      );
    }
    if (!inWeekend(data) && sarbatoarea(laIso(data)) === undefined) ramase -= 1;
  }
  return laIso(new Date(t));
}

/** Sărbătorile de luni–vineri dintre `dupa` (exclusiv) și `pana` (inclusiv). */
export function sarbatoriSarite(dupa: ZiIso, pana: ZiIso): readonly SarbatoareInInterval[] {
  if (pana <= dupa) return [];
  return numaraInterval(ziuaUrmatoare(dupa), pana).sarbatoriScazute;
}

/** „joi, 5 noiembrie 2026”. */
export function dataLunga(zi: ZiIso): string {
  const data = dinIso(zi);
  if (data === null) return zi;
  return `${ZILE[data.getUTCDay()] ?? ""}, ${String(data.getUTCDate())} ${LUNI[data.getUTCMonth()] ?? ""} ${String(data.getUTCFullYear())}`;
}

/**
 * Anul pentru care are sens programarea concediilor. Art. 148 alin. (1) din
 * Codul muncii: „Programarea se face până la sfârșitul anului calendaristic
 * pentru anul următor” (consolidat la 27.04.2026). Din octombrie, ce caută
 * firma e anul următor.
 */
export function anulProgramarii(azi: ZiIso): number {
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  return luna >= 10 ? an + 1 : an;
}
