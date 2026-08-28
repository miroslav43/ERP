/**
 * Formatarea duratelor și a orelor din zi — în ceas, niciodată în zecimale.
 *
 * Regula produsului: **nu există „8,5 ore”**. Există `8:30`. Și nu există
 * `5:30 PM`. Există `17:30`. Ceasul de 12 ore nu se folosește în România, iar
 * o jumătate de oră scrisă `,5` obligă cititorul să facă o înmulțire în cap
 * exact acolo unde se uită după un minut.
 *
 * ── DE CE RĂMÂNE ZECIMAL ÎN BAZĂ ──────────────────────────────────────────
 * Coloanele `ore_lucrate`, `ore_suplimentare`, `ore_noapte`, `ore_pe_zi` sunt
 * `numeric` și așa rămân: salarizarea înmulțește ore cu tariful orar, iar
 * `8:30 × 27,50 lei` nu e o operație pe care s-o poți face pe un șir. Zecimala
 * e reprezentarea de CALCUL; ceasul e reprezentarea de CITIRE. Conversia se
 * face într-un singur loc — aici.
 *
 * Funcții pure, fără I/O. Se folosesc și pe server (PDF, Excel, mesaje de
 * eroare), și în client.
 */

/** Minutele dintr-o oră. Scris o dată, ca `* 60` să nu apară nemotivat. */
const MINUTE_PE_ORA = 60;

/** Semnul minus tipografic (U+2212), nu cratima — la fel ca în `flota/etichete.ts`. */
const MINUS = "\u2212";

/** Grupează miile la românește: `1198` → `"1.198"`. Duratele mari chiar apar. */
const grupareOre = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

/** `"8"`/`"08"` → `"08"`. Minutele se scriu ÎNTOTDEAUNA cu două cifre. */
function douaCifre(valoare: number): string {
  return String(valoare).padStart(2, "0");
}

function numarFinit(valoare: number | string, context: string): number {
  const numar = typeof valoare === "string" ? Number(valoare.trim()) : valoare;
  if (typeof numar !== "number" || !Number.isFinite(numar)) {
    throw new TypeError(`${context}: ${JSON.stringify(valoare)}`);
  }
  return numar;
}

/**
 * Durată zecimală → ceas. `8.5` → `"8:30"`, `8` → `"8:00"`, `7.75` → `"7:45"`.
 *
 * Rotunjirea se face la MINUT, nu la sutime de oră: `oreleZilei` întoarce
 * `8.17` pentru 08:00–16:10 (`Math.round(x * 100) / 100`), iar `8.17 × 60` dă
 * `490,2` minute. Fără rotunjirea asta ar ieși `8:490.2`.
 *
 * Negativul păstrează semnul în FAȚA ceasului — `−1:30`, nu `-1:-30`. Apare pe
 * ecranul de setări de pontaj, unde diferența față de normă poate fi în minus.
 */
export function formatOre(
  valoare: number | string,
  optiuni: Readonly<{ grupeaza?: boolean }> = {},
): string {
  const ore = numarFinit(valoare, "Durată invalidă");
  const semn = ore < 0 ? MINUS : "";
  const minuteTotale = Math.round(Math.abs(ore) * MINUTE_PE_ORA);
  const intregi = Math.floor(minuteTotale / MINUTE_PE_ORA);
  const minute = minuteTotale % MINUTE_PE_ORA;
  // `grupeaza: false` e pentru CÂMPURILE de intrare: acolo valoarea afișată
  // trebuie să se poată tasta la loc, iar `parseOre` respinge punctul — n-are
  // cum să-l accepte la mii și să-l refuze la zecimale, în același șir.
  const scrise = optiuni.grupeaza === false ? String(intregi) : grupareOre.format(intregi);
  return `${semn}${scrise}:${douaCifre(minute)}`;
}

/**
 * Ca `formatOre`, dar cu unitatea lipită: `8.5` → `"8:30 h"`.
 *
 * Unitatea rămâne `h`, nu „ore”: după un ceas, „8:30 ore” se citește ca o
 * tautologie, iar în capul de tabel nu încape oricum.
 */
export function formatOreCuUnitate(valoare: number | string): string {
  return `${formatOre(valoare)} h`;
}

/**
 * Ora din zi, curățată de secunde și garantat pe 24 de ore.
 *
 * O coloană `time` din Postgres sosește ca `"08:30:00"`; un `timestamptz`
 * formatat de altcineva poate sosi ca `"08:30"`. Ambele ies `"08:30"`.
 * `null`/`undefined`/șir gol → `null`, ca apelantul să decidă ce afișează.
 *
 * NU trece prin `Intl.DateTimeFormat`: acolo `hour12` depinde de locale, iar
 * un `en-US` scăpat în cod ar reintroduce exact `AM`/`PM`-ul pe care ecranul
 * nu are voie să-l arate.
 */
export function formatOraZi(valoare: string | null | undefined): string | null {
  if (valoare === null || valoare === undefined) return null;
  const potrivire = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/u.exec(valoare.trim());
  if (potrivire === null) return null;
  const ore = Number(potrivire[1]);
  if (ore > 23) return null;
  return `${douaCifre(ore)}:${potrivire[2] ?? "00"}`;
}

/**
 * Ceas → durată zecimală, pentru ce se trimite mai departe către bază.
 *
 * Acceptă `"8:30"`, `"08:30"`, `"8"`, `"8h30"`, `"8 h 30"` și un `"−1:30"` cu
 * oricare dintre cele două semne minus. Întoarce `null` pentru orice altceva.
 *
 * **Zecimalele se RESPING deliberat.** `"8,5"` și `"8.5"` întorc `null`, deși
 * ar fi banal de acceptat: cât timp câmpul le înghite, oamenii continuă să le
 * tasteze, iar jumătate din ecrane rămân în cealaltă convenție. Câmpul spune
 * ce format vrea; mesajul de eroare îl repetă.
 */
export function parseOre(input: string): number | null {
  const curatat = input
    .trim()
    .replace(/\u2212/gu, "-")
    .replace(/\s+/gu, "");
  if (curatat.length === 0) return null;

  const potrivire = /^(-?)(\d{1,4})(?:[:h](\d{1,2}))?$/iu.exec(curatat);
  if (potrivire === null) return null;

  const minute = potrivire[3] === undefined ? 0 : Number(potrivire[3]);
  if (minute > 59) return null;

  const ore = Number(potrivire[2]) + minute / MINUTE_PE_ORA;
  const semnat = potrivire[1] === "-" ? -ore : ore;
  // Aceeași rotunjire ca în `domain/attendance/calcul-ore.ts`, ca valoarea
  // tastată să fie identică bit cu bit cu cea derivată din interval.
  return Math.round(semnat * 100) / 100;
}

/**
 * Ce a tastat omul într-un câmp de oră → `"HH:MM"` canonic, sau `null`.
 *
 * Ține locul lui `<input type="time">`, care nu se poate forța pe 24 de ore:
 * Chrome alege formatul după limba INTERFEȚEI browserului, nu după `lang`-ul
 * paginii, așa că pe un Chrome în engleză câmpul afișa `05:30 PM` într-o
 * aplicație scrisă integral în română. Atributul `lang="ro-RO"` era pus pe
 * câmpuri de la început și nu schimba nimic acolo.
 *
 * Acceptă felul în care oamenii chiar tastează o oră: `"8"` → `"08:00"`,
 * `"830"` → `"08:30"`, `"1730"` → `"17:30"`, `"17:5"` → `"17:05"`.
 */
export function normalizeazaOraZi(input: string): string | null {
  const brut = input.trim();
  if (brut.length === 0) return null;

  // Secundele sunt opționale fiindcă o coloană `time` din Postgres sosește
  // `"08:30:00"`, iar câmpul primește direct valoarea salvată. Nimeni nu le
  // tastează, și nu se păstrează: ora zilei se scrie cu ore și minute.
  //
  // Minutele sunt și ele opționale: masca de tastare pune două puncte imediat
  // ce ora s-a închis, deci cine scrie `8` și trece la câmpul următor lasă în
  // urmă `"08:"`. Aia e ora opt fix, nu o intrare stricată.
  const cuDouaPuncte = /^(\d{1,2}):(\d{1,2})?(?::[0-5]\d(?:\.\d+)?)?$/u.exec(brut);
  if (cuDouaPuncte !== null) {
    const minute = cuDouaPuncte[2];
    return valideazaCeas(Number(cuDouaPuncte[1]), minute === undefined ? 0 : Number(minute));
  }

  if (!/^\d{1,4}$/u.test(brut)) return null;
  if (brut.length <= 2) return valideazaCeas(Number(brut), 0);
  // `830` sunt trei cifre: prima e ora, ultimele două minutele.
  const taietura = brut.length - 2;
  return valideazaCeas(Number(brut.slice(0, taietura)), Number(brut.slice(taietura)));
}

/**
 * Masca de tastare: cifrele scrise → text cu `:` pus de câmp, nu de om.
 *
 * `"8"` → `"08:"` · `"830"` → `"08:30"` · `"1730"` → `"17:30"` · `"25"` → `"02:5"`.
 *
 * ── DE UNDE ȘTIE UNDE SE TERMINĂ ORA ──────────────────────────────────────
 * O oră de două cifre nu poate începe decât cu 0, 1 sau 2. Deci `8` închide
 * ora din prima tastă — două punctele apar imediat și urmează minutele. La
 * `1`, câmpul așteaptă a doua cifră; dacă ea duce peste 23 (`25`), prima cifră
 * era ora întreagă și a doua e deja minutul.
 *
 * Regula asta face ca ora să se scrie din exact atâtea taste câte cifre are —
 * `830`, `1730` — fără să atingă nimeni tasta de două puncte. Ce NU face:
 * nu corectează minutul. `1775` rămâne `17:75` și e marcat greșit, fiindcă un
 * câmp care rescrie tăcut ce-ai tastat e mai rău decât unul care refuză.
 */
export function mascheazaOraZi(input: string): string {
  const cifre = input.replace(/\D/gu, "").slice(0, 4);
  if (cifre.length === 0) return "";

  const oraDintrOCifra = `0${cifre[0] ?? ""}:${cifre.slice(1, 3)}`;
  if (Number(cifre[0]) > 2) return oraDintrOCifra;
  if (cifre.length === 1) return cifre;
  if (Number(cifre.slice(0, 2)) > 23) return oraDintrOCifra;
  return `${cifre.slice(0, 2)}:${cifre.slice(2, 4)}`;
}

function valideazaCeas(ore: number, minute: number): string | null {
  if (!Number.isInteger(ore) || !Number.isInteger(minute)) return null;
  if (ore > 23 || minute > 59) return null;
  return `${douaCifre(ore)}:${douaCifre(minute)}`;
}
