import { cuDe } from "@/content/legal/zile-libere";
import { ziIso } from "@/domain/calendar/grila-lunara";
import { parseOre } from "@/lib/format/ore";
import { antetFirmaDinParametri, type AntetFirma } from "@/lib/unelte/antet-firma";
import { COD_REPAUS, COD_SARBATOARE } from "@/lib/unelte/coduri-pontaj";

import {
  citesteAngajati,
  construiesteFoaie,
  LUNI,
  MAX_ANGAJATI,
  normalizeazaAn,
  normalizeazaLuna,
  normalizeazaOre,
  notaOmisi,
  oreFoaie,
  type ListaAngajati,
} from "./foaie";

/**
 * Pontajul lunar ales în formular: luna, programul, varianta, antetul și
 * oamenii, fiecare cu norma lui.
 *
 * ── DE CE UN FIȘIER NOU, NU `foaie.ts` ────────────────────────────────────
 * `construiesteFoaie` o mai folosesc foaia de parcurs, cererea de concediu și
 * condica, cu semnătura de azi. Ce e nou după auditul din 8 oct 2026 —
 * programul pe ture, norma pe angajat, fișa individuală — stă aici, fără să
 * mute nimic sub picioarele celorlalte unelte.
 *
 * ── NORMA ─────────────────────────────────────────────────────────────────
 * Zilele lucrătoare de luni până vineri, fără sărbători, × orele pe zi — ORICARE
 * ar fi programul. Așa o socotește salarizarea: cine lucrează în ture are
 * aceeași normă lunară, doar repartizată altfel.
 */

export type Program = "lv" | "ls" | "ture";
export type Varianta = "colectiva" | "individuala";

export const PROGRAME: readonly Readonly<{ valoare: Program; eticheta: string }>[] = [
  { valoare: "lv", eticheta: "Luni–vineri" },
  { valoare: "ls", eticheta: "Luni–sâmbătă" },
  { valoare: "ture", eticheta: "Toate zilele (ture)" },
];

export const VARIANTE: readonly Readonly<{ valoare: Varianta; eticheta: string }>[] = [
  { valoare: "colectiva", eticheta: "Colectivă — un rând pe angajat, orele pe zi" },
  {
    valoare: "individuala",
    eticheta: "Individuală — o fișă pe angajat, cu ora de început și de sfârșit",
  },
];

/** Parametrii din adresă pe care îi citește unealta. Pagina îi copiază din `searchParams`. */
export const CHEI_PONTAJ = [
  "an",
  "luna",
  "ore",
  "program",
  "varianta",
  "firma",
  "cui",
  "compartiment",
  "angajati",
] as const;

export function normalizeazaProgram(brut: string | null): Program {
  return brut === "ls" || brut === "ture" ? brut : "lv";
}

export function normalizeazaVarianta(brut: string | null): Varianta {
  return brut === "individuala" ? "individuala" : "colectiva";
}

/** „luni–vineri”, „luni–sâmbătă”, „toate zilele (ture)” — pentru mijlocul unei fraze. */
export function etichetaProgram(program: Program): string {
  return (PROGRAME.find((p) => p.valoare === program)?.eticheta ?? "Luni–vineri").toLowerCase();
}

/** Indexate după `getUTCDay()`: duminica e prima. */
const NUME_ZI = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"] as const;
const ZI_SCURTA = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"] as const;

export type ZiPontaj = Readonly<{
  zi: number;
  /** „2026-12-01” */
  iso: string;
  /** „01.12.2026” */
  data: string;
  /** „01.12” */
  dataScurta: string;
  /** 0 = duminică … 6 = sâmbătă */
  dow: number;
  numeZi: string;
  ziScurta: string;
  /** Inițiala din capul foii colective, aceeași ca până acum. */
  litera: string;
  sarbatoare: string | null;
  inProgram: boolean;
  /** Ce se scrie dinainte în celula zilei: "" în program, altfel L sau SL. */
  codImplicit: string;
}>;

export function ziInProgram(dow: number, sarbatoare: string | null, program: Program): boolean {
  if (program === "ture") return true;
  if (sarbatoare !== null || dow === 0) return false;
  return dow !== 6 || program === "ls";
}

export function zileDinLuna(an: number, luna: number, program: Program): readonly ZiPontaj[] {
  const ll = String(luna).padStart(2, "0");
  return construiesteFoaie(an, luna, [], 8).zile.map((z) => {
    const dow = new Date(Date.UTC(an, luna - 1, z.zi)).getUTCDay();
    const inProgram = ziInProgram(dow, z.sarbatoare, program);
    const dd = String(z.zi).padStart(2, "0");
    return {
      zi: z.zi,
      iso: ziIso(an, luna, z.zi),
      data: `${dd}.${ll}.${String(an)}`,
      dataScurta: `${dd}.${ll}`,
      dow,
      numeZi: NUME_ZI[dow] ?? "",
      ziScurta: ZI_SCURTA[dow] ?? "",
      litera: z.litera,
      sarbatoare: z.sarbatoare,
      inProgram,
      codImplicit: inProgram ? "" : z.sarbatoare !== null ? COD_SARBATOARE : COD_REPAUS,
    };
  });
}

/**
 * Orele pe zi scrise de om după nume: „4”, „4h”, „7,5”, „7.25”, „6:30”.
 * `null` pentru orice altceva sau în afara intervalului (0, 24].
 */
export function oreDinText(brut: string): number | null {
  const t = brut.trim().toLowerCase();
  let ore: number | null = null;
  if (/^\d{1,2}:\d{2}$/u.test(t)) ore = parseOre(t);
  else if (/^\d{1,2}(?:[.,]\d{1,2})?\s*h?$/u.test(t)) {
    ore = Number(t.replace(/\s*h$/u, "").replace(",", "."));
  }
  if (ore === null || !Number.isFinite(ore) || ore <= 0 || ore > 24) return null;
  return Math.round(ore * 100) / 100;
}

/**
 * „8”, „7:30”, „10:30”: `oreFoaie` (secțiunea B, regula ceasului) fără unitate,
 * pentru celulele înguste („h/zi”), unde „ h” nu încape.
 */
export function oreScurt(ore: number): string {
  return oreFoaie(ore).replace(/ h$/u, "");
}

export type AngajatPontaj = Readonly<{ nume: string; oreZi: number }>;

export type LiniiAngajati = Readonly<{
  angajati: readonly AngajatPontaj[];
  /**
   * Lista în forma lui B (`ListaAngajati`): numele, câte au venit, câte au rămas
   * pe dinafară, câte s-au scurtat. Din ea ies avizul de pe pagină
   * (`avizAngajati`) și nota din fișier (`notaOmisi`) — nu se scriu a doua oară.
   */
  lista: ListaAngajati;
  avertismente: readonly string[];
}>;

/** Rândul nou „tare”. Celelalte despărțitoare (U+000B, NEL, U+2028…) le tratează `citesteAngajati`. */
const RAND_NOU = /\r\n|[\n\r]/u;

/**
 * Norma de pe un rând: după ultima bară verticală, oricare ar fi; după ultimul
 * TAB, doar dacă ce urmează e un număr de ore. Altfel TAB-ul rămâne al numelui,
 * iar `citesteAngajati` îl face spațiu: „Popa⇥Ion” e un singur om (regula lui B),
 * „Popa Ion⇥4” e un om cu 4 h pe zi (două coloane lipite din Excel).
 */
function desparteNorma(linie: string): Readonly<{ text: string; norma: string | null }> {
  const bara = linie.lastIndexOf("|");
  if (bara >= 0) {
    return { text: linie.slice(0, bara).replace(/\|/gu, " "), norma: linie.slice(bara + 1).trim() };
  }
  const tab = linie.lastIndexOf("\t");
  if (tab >= 0 && oreDinText(linie.slice(tab + 1)) !== null) {
    return { text: linie.slice(0, tab), norma: linie.slice(tab + 1).trim() };
  }
  return { text: linie, norma: null };
}

/**
 * Câte un om pe rând, opțional cu norma lui: „Ilie Maria | 4”.
 *
 * Norma se scoate ÎNAINTE, apoi restul rândului trece prin `citesteAngajati`:
 * aceleași reguli de nume ca în toată secțiunea B (curățare, doar rândul nou
 * desparte, plafonul de 60 de oameni și de 80 de caractere). O normă care nu se
 * citește NU oprește foaia: omul primește norma comună, iar pagina spune de ce.
 */
export function liniiAngajati(brut: string | undefined, oreImplicite: number): LiniiAngajati {
  const angajati: AngajatPontaj[] = [];
  const avertismente: string[] = [];
  let total = 0;
  let scurtate = 0;
  for (const linie of (brut ?? "").split(RAND_NOU)) {
    const { text, norma } = desparteNorma(linie);
    const citite = citesteAngajati(text);
    if (citite.total === 0) continue;
    total += citite.total;
    const loc = MAX_ANGAJATI - angajati.length;
    if (loc <= 0) continue;
    scurtate += citite.scurtate;
    const oreLinie = norma === null || norma === "" ? null : oreDinText(norma);
    for (const nume of citite.nume.slice(0, loc)) {
      if (norma !== null && norma !== "" && oreLinie === null) {
        avertismente.push(
          `„${norma.slice(0, 12)}” de lângă ${nume} nu e un număr de ore între 0 și 24; am pus norma comună, ${oreFoaie(oreImplicite)}.`,
        );
      }
      angajati.push({ nume, oreZi: oreLinie ?? oreImplicite });
    }
  }
  const lista: ListaAngajati = {
    // Foaia are rost și necompletată: se tipărește și se scrie cu pixul.
    nume: angajati.length > 0 ? angajati.map((x) => x.nume) : Array.from({ length: 10 }, () => ""),
    total,
    omisi: total - angajati.length,
    scurtate,
  };
  return {
    angajati:
      angajati.length > 0
        ? angajati
        : Array.from({ length: 10 }, () => ({ nume: "", oreZi: oreImplicite })),
    lista,
    avertismente,
  };
}

export type ParametriPontaj = Readonly<{
  an: number;
  luna: number;
  oreZi: number;
  program: Program;
  varianta: Varianta;
  antet: AntetFirma;
  linii: LiniiAngajati;
}>;

export function parametriPontaj(q: URLSearchParams, acum: Date = new Date()): ParametriPontaj {
  const oreZi = normalizeazaOre(q.get("ore") ?? undefined);
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    oreZi,
    program: normalizeazaProgram(q.get("program")),
    varianta: normalizeazaVarianta(q.get("varianta")),
    antet: antetFirmaDinParametri(q),
    linii: liniiAngajati(q.get("angajati") ?? undefined, oreZi),
  };
}

export type Pontaj = Readonly<{
  an: number;
  luna: number;
  /** „decembrie 2026” */
  eticheta: string;
  oreZi: number;
  program: Program;
  varianta: Varianta;
  antet: AntetFirma;
  zile: readonly ZiPontaj[];
  /** Luni–vineri, fără sărbători — baza normei, oricare ar fi programul. */
  zileLucratoare: number;
  angajati: readonly AngajatPontaj[];
  /** Nota lui B pentru fișier când lista a trecut de 60 de nume; `null` altfel. */
  notaAngajati: string | null;
}>;

export function construiestePontaj(p: ParametriPontaj): Pontaj {
  const zile = zileDinLuna(p.an, p.luna, p.program);
  return {
    an: p.an,
    luna: p.luna,
    eticheta: `${LUNI[p.luna - 1] ?? ""} ${String(p.an)}`,
    oreZi: p.oreZi,
    program: p.program,
    varianta: p.varianta,
    antet: p.antet,
    zile,
    zileLucratoare: zile.filter((z) => z.dow !== 0 && z.dow !== 6 && z.sarbatoare === null).length,
    angajati: p.linii.angajati,
    notaAngajati: notaOmisi(p.linii.lista),
  };
}

/**
 * În minute întregi, apoi înapoi în ore: 21 × 7,3 dădea 153,29999999999998
 * (auditul din 8 oct 2026). Ziua se rotunjește la minut ÎNAINTE de înmulțire,
 * ca în `construiesteFoaie` (secțiunea B): textul afișează ziua rotunjită, iar
 * „× 7:20 h” trebuie să dea 154:00, nu 153:56.
 */
export function normaLunara(zileLucratoare: number, oreZi: number): number {
  return (zileLucratoare * Math.round(oreZi * 60)) / 60;
}

/**
 * „21 de zile lucrătoare × 8 h = 168 h normă · program luni–vineri”: textul
 * normei din secțiunea B (`textNorma`: aceleași `oreFoaie` și `cuDe`), plus
 * programul ales.
 */
export function rezumatNorma(p: Pontaj): string {
  const norma = oreFoaie(normaLunara(p.zileLucratoare, p.oreZi));
  return `${cuDe(p.zileLucratoare, "zile lucrătoare")} × ${oreFoaie(p.oreZi)} = ${norma} normă · program ${etichetaProgram(p.program)}`;
}

/** Angajații cu nume. Fără niciunul, o singură fișă necompletată — nu zece. */
export function angajatiPentruFise(p: Pontaj): readonly [AngajatPontaj, ...AngajatPontaj[]] {
  const [primul, ...restul] = p.angajati.filter((a) => a.nume !== "");
  return primul === undefined ? [{ nume: "", oreZi: p.oreZi }] : [primul, ...restul];
}

export function numeFisierPontaj(p: Pontaj): string {
  const prefix = p.varianta === "individuala" ? "fise-pontaj" : "pontaj";
  return `${prefix}-${String(p.an)}-${String(p.luna).padStart(2, "0")}`;
}
