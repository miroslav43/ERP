// src/domain/fleet/carduri/date.ts
//
// Data și ora tranzacțiilor din extrasele de card.
//
// Ora din extras e ora de perete a STAȚIEI; se citește ca ora României
// (`momentDinOraRomaniei`), inclusiv în noaptea schimbării orei. La o stație
// din alt fus, diferența de o oră nu schimbă ziua în cazurile uzuale — limitare
// asumată (F12b, Riscuri 5); legarea manuală o rezolvă.
//
// Formatele: `zz.ll.aaaa[ hh:mm[:ss]]`, `aaaa-ll-zz[Thh:mm[:ss]]` (și cu spațiu),
// `zz/ll/aaaa`, `ll/zz/aaaa`, anul pe 2 cifre (20xx), plus numărul serial Excel
// (20000–80000, fracția = ora, epoca 1899-12-30). Bara oblică e singura formă
// ambiguă: „03/04/2026” e 3 aprilie sau 4 martie, după emitent.

import { momentDinOraRomaniei, toBucharestDateString } from "@/lib/format/date";

export const FORMATE_DATA = [
  "auto",
  "zz.ll.aaaa",
  "aaaa-ll-zz",
  "zz/ll/aaaa",
  "ll/zz/aaaa",
] as const;
export type FormatData = (typeof FORMATE_DATA)[number];

export type MomentCitit = Readonly<{
  /** Momentul exact, ISO în UTC. */
  moment: string;
  /** Ziua din ora României, `AAAA-LL-ZZ`. */
  dataRo: string;
  /** Extrasul a dat și ora. Fără ea, potrivirea nu judecă diferența de ore. */
  areOra: boolean;
}>;

type Calendar = Readonly<{ an: number; luna: number; zi: number }>;
type Ceas = Readonly<{ ora: number; minut: number; secunda: number }>;

const ORA = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/u;
const DATA_PUNCT = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/u;
const DATA_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u;
const DATA_BARA = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/u;
const SERIAL = /^\d{5}(?:[.,]\d+)?$/u;

function an4(text: string): number {
  const n = Number(text);
  return text.length === 2 ? 2000 + n : n;
}

function citesteCeas(text: string): Ceas | null {
  const m = ORA.exec(text.trim());
  if (m === null) return null;
  const ora = Number(m[1]);
  const minut = Number(m[2]);
  const secunda = Number(m[3] ?? 0);
  if (ora > 23 || minut > 59 || secunda > 59) return null;
  return { ora, minut, secunda };
}

/** Fracția de zi a lui Excel (0,5 = 12:00), rotunjită la secundă. */
function ceasDinFractie(fractie: number): Ceas | null {
  if (!(fractie >= 0 && fractie < 1)) return null;
  const total = Math.round(fractie * 86400);
  if (total >= 86400) return { ora: 23, minut: 59, secunda: 59 };
  return {
    ora: Math.floor(total / 3600),
    minut: Math.floor((total % 3600) / 60),
    secunda: total % 60,
  };
}

/**
 * O celulă de ORĂ: „14:02”, „14:02:30”, fracția Excel („0,5844”) sau, din
 * `citesteExcelDinBuffer` cu `pastreazaOra`, „1899-12-30T14:02:00” (Excel
 * ține ora singură pe ziua lui zero).
 */
export function parseazaOra(text: string): Ceas | null {
  const t = text.trim();
  if (t.length === 0) return null;
  const directa = citesteCeas(t);
  if (directa !== null) return directa;
  const iso = /^\d{4}-\d{2}-\d{2}[T ](\d{1,2}:\d{2}(?::\d{2})?)/u.exec(t);
  if (iso?.[1] !== undefined) return citesteCeas(iso[1]);
  if (/^0?[.,]\d+$/u.test(t)) return ceasDinFractie(Number(t.replace(",", ".")));
  return null;
}

function despartePrimaData(text: string): { readonly data: string; readonly ora: string | null } {
  const t = text.trim().replace(/\s+/gu, " ");
  const iso = /^(\d{4}-\d{1,2}-\d{1,2})T(.+)$/u.exec(t);
  if (iso !== null) return { data: iso[1] ?? t, ora: iso[2] ?? null };
  const m = /^(\S+)(?: (.+))?$/u.exec(t);
  return { data: m?.[1] ?? t, ora: m?.[2] ?? null };
}

function calendarDin(text: string, format: FormatData): Calendar | null | "ambiguu" {
  let m = DATA_PUNCT.exec(text);
  if (m !== null) return { zi: Number(m[1]), luna: Number(m[2]), an: an4(m[3] ?? "") };
  m = DATA_ISO.exec(text);
  if (m !== null) return { an: Number(m[1]), luna: Number(m[2]), zi: Number(m[3]) };
  m = DATA_BARA.exec(text);
  if (m !== null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const an = an4(m[3] ?? "");
    if (format === "zz/ll/aaaa" || format === "zz.ll.aaaa") return { zi: a, luna: b, an };
    if (format === "ll/zz/aaaa") return { zi: b, luna: a, an };
    if (format === "aaaa-ll-zz") return null;
    // `auto`: se decide doar când una dintre părți nu poate fi lună.
    if (a > 12 && b <= 12) return { zi: a, luna: b, an };
    if (b > 12 && a <= 12) return { zi: b, luna: a, an };
    return a === b ? { zi: a, luna: b, an } : "ambiguu";
  }
  return null;
}

function compune(c: Calendar, ceas: Ceas | null): MomentCitit | null {
  const doi = (n: number) => String(n).padStart(2, "0");
  if (c.an < 2000 || c.an > 2100) return null;
  // Fără oră: miezul zilei, nu miezul nopții — ziua românească nu se poate
  // muta în cea vecină la conversia în UTC.
  const h = ceas ?? { ora: 12, minut: 0, secunda: 0 };
  const local = `${String(c.an)}-${doi(c.luna)}-${doi(c.zi)}T${doi(h.ora)}:${doi(h.minut)}:${doi(h.secunda)}`;
  const moment = momentDinOraRomaniei(local);
  if (moment === null) return null;
  return { moment, dataRo: toBucharestDateString(new Date(moment)), areOra: ceas !== null };
}

function dinSerial(text: string): MomentCitit | null {
  const n = Number(text.replace(",", "."));
  if (!(n >= 20000 && n <= 80000)) return null;
  const zile = Math.floor(n);
  const fractie = n - zile;
  // Epoca 1899-12-30 absoarbe deja eroarea lui Lotus (29.02.1900 inexistent).
  const zi = new Date(Date.UTC(1899, 11, 30) + zile * 86400000);
  const ceas = fractie > 0 ? ceasDinFractie(fractie) : null;
  return compune(
    { an: zi.getUTCFullYear(), luna: zi.getUTCMonth() + 1, zi: zi.getUTCDate() },
    ceas,
  );
}

/**
 * Momentul unei tranzacții din celula de dată (cu sau fără oră) și, opțional,
 * celula de oră separată. `null` pentru o dată inexistentă (31.02), ambiguă la
 * `auto`, sau în afara anilor 2000–2100.
 */
export function parseazaMoment(
  dataText: string,
  oraText: string | null,
  format: FormatData,
): MomentCitit | null {
  const brut = dataText.trim();
  if (brut.length === 0) return null;
  if (SERIAL.test(brut)) return dinSerial(brut);
  const { data, ora } = despartePrimaData(brut);
  const calendar = calendarDin(data, format);
  if (calendar === null || calendar === "ambiguu") return null;
  const ceasDinData =
    ora === null ? null : citesteCeas(ora.replace(/(?:Z|[+-]\d{2}:?\d{2})$/u, ""));
  if (ora !== null && ceasDinData === null) return null;
  const ceasSeparat = oraText === null || oraText.trim().length === 0 ? null : parseazaOra(oraText);
  if (oraText !== null && oraText.trim().length > 0 && ceasSeparat === null) return null;
  // O dată „cu oră” 00:00:00 venită dintr-o celulă Date de Excel e de fapt doar
  // data; coloana de oră separată, când există, câștigă.
  const ceas = ceasSeparat ?? ceasDinData;
  return compune(calendar, ceas);
}

/**
 * Formatul coloanei de dată. Contează doar bara oblică: dacă vreo valoare are
 * prima parte peste 12 ⇒ `zz/ll/aaaa`; a doua peste 12 ⇒ `ll/zz/aaaa`; ambele
 * semne pe aceeași coloană, sau nimic decisiv ⇒ `null` (se cere profilul).
 * Fără bare oblice, `auto` citește orice altă formă.
 */
export function detecteazaFormatData(valori: readonly string[]): FormatData | null {
  let ziPrima = false;
  let lunaPrima = false;
  let bare = 0;
  for (const valoare of valori) {
    const { data } = despartePrimaData(valoare);
    const m = DATA_BARA.exec(data);
    if (m === null) continue;
    bare += 1;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) ziPrima = true;
    if (b > 12) lunaPrima = true;
  }
  if (bare === 0) return "auto";
  if (ziPrima && lunaPrima) return null;
  if (ziPrima) return "zz/ll/aaaa";
  if (lunaPrima) return "ll/zz/aaaa";
  return null;
}
