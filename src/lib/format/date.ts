/**
 * Formatarea datelor în convenția românească, cu fusul `Europe/Bucharest`.
 *
 * Distincția centrală, sursa clasică de bug-uri într-un ERP de HR:
 *
 * - O **zi calendaristică** (ziua unui pontaj, o zi de concediu, o sărbătoare
 *   legală) este `date` în Postgres și `"2026-03-09"` în TypeScript. Nu are oră
 *   și nu are fus. Nu se transformă niciodată într-un `Date`, pentru că
 *   `new Date("2026-03-09")` o interpretează ca miezul nopții UTC, iar afișarea
 *   ulterioară o poate da înapoi cu o zi.
 * - Un **moment în timp** (când a fost aprobată o cerere) este `timestamptz` în
 *   Postgres și `Date` în TypeScript. Acela se afișează convertit în ora
 *   României.
 *
 * Funcții pure, fără I/O — cu excepția `todayInBucharest`, care citește ceasul.
 */

export const TIMEZONE = "Europe/Bucharest";
export const LOCALE = "ro-RO";

/** Zi calendaristică ISO, `"2026-03-09"`. Corespunde unei coloane `date`. */
export type DateString = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RO_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

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

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const bucharestPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Verifică faptul că ziua chiar există în calendar (respinge 31.02, 29.02 nebisect). */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function parseIsoDate(value: DateString): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(value);
  if (!match) throw new TypeError(`Zi calendaristică invalidă: ${JSON.stringify(value)}`);
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!isRealDate(year, month, day)) {
    throw new TypeError(`Zi calendaristică inexistentă: ${value}`);
  }
  return { year, month, day };
}

/**
 * `"2026-03-09"` → `"09.03.2026"`.
 *
 * Lucrează pe șiruri, deliberat: nu construiește niciun `Date`, deci nu are
 * cum să deplaseze ziua cu un fus.
 */
export function formatDate(value: DateString): string {
  const { year, month, day } = parseIsoDate(value);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/** Un moment în timp → `"15.07.2026, 12:30"`, în ora României. */
export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Moment invalid: ${JSON.stringify(value)}`);
  }
  return dateTimeFormatter.format(date);
}

/**
 * Ziua calendaristică **românească** a unui moment în timp.
 *
 * Decide în ce zi de pontaj și în ce lună de salarizare cade o înregistrare.
 * O tură care se încheie la 01:30 ora României aparține zilei locale, nu celei
 * UTC — de aceea conversia nu se poate face cu `toISOString()`.
 */
export function toBucharestDateString(moment: Date): DateString {
  if (Number.isNaN(moment.getTime())) {
    throw new TypeError("Moment invalid");
  }
  // `en-CA` produce direct `YYYY-MM-DD`.
  return bucharestPartsFormatter.format(moment);
}

/** Ziua curentă în România. Singura funcție din modul care citește ceasul. */
export function todayInBucharest(): DateString {
  return toBucharestDateString(new Date());
}

/**
 * Formele scurte, pentru axele graficelor și antetele înguste de tabel.
 *
 * `mai` NU are punct: nu e o prescurtare, e cuvântul întreg. Punctul de
 * prescurtare pus acolo unde nu s-a tăiat nimic e o greșeală de ortografie, nu
 * o inconsecvență de stil.
 */
const LUNI_SCURT = [
  "ian.",
  "feb.",
  "mar.",
  "apr.",
  "mai",
  "iun.",
  "iul.",
  "aug.",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
] as const;

/** `3` → `"mar."`. Pentru axa unui grafic, unde „martie" n-ar încăpea. */
export function formatMonthShort(month: number): string {
  const name = LUNI_SCURT[month - 1];
  if (name === undefined) throw new RangeError(`Lună invalidă: ${month}`);
  return name;
}

/** `(2026, 3)` → `"martie 2026"`. Pentru antetul perioadelor de pontaj și salarizare. */
export function formatMonthYear(year: number, month: number): string {
  const name = LUNI[month - 1];
  if (name === undefined) throw new RangeError(`Lună invalidă: ${month}`);
  return `${name} ${year}`;
}

/**
 * Citește o dată introdusă de utilizator în format românesc și o întoarce ca zi
 * calendaristică ISO, gata de scris într-o coloană `date`.
 *
 * Întoarce `null` pentru intrări invalide sau inexistente în calendar
 * (31.02.2026, 29.02.2027) — validarea propriu-zisă rămâne la Zod, care decide
 * mesajul afișat.
 */
export function parseDateRo(input: string): DateString | null {
  const match = RO_DATE.exec(input.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!isRealDate(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
