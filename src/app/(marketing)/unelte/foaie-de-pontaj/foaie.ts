import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";

/**
 * Construcția unei foi de pontaj goale, pentru o lună anume.
 *
 * ── DE CE E LOGICĂ SEPARATĂ, NU CALCUL ÎN PAGINĂ ──────────────────────────
 * O folosesc două locuri: pagina care afișează foaia și ruta care o exportă în
 * format de calcul. Calculată de două ori, ar fi două foi care se despart la
 * prima corectură — iar aici „se despart" înseamnă un fișier descărcat care nu
 * seamănă cu ce a văzut omul pe ecran.
 *
 * ── CE FACE DIFERIT FAȚĂ DE UN ȘABLON DESCĂRCAT ───────────────────────────
 * Sărbătorile legale vin din `sarbatoriDupaZi`, adică din calcul, inclusiv
 * Paștele ortodox și zilele care depind de el. Un șablon de foaie de calcul
 * descărcat de pe internet are sărbătorile scrise de mână pentru anul în care a
 * fost făcut, iar anul următor arată la fel de convingător și e greșit.
 */

export const LUNI = [
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

/** Inițiala zilei, în română. Duminica e prima, ca la `Date.getDay()`. */
const INITIALA_ZI = ["D", "L", "M", "M", "J", "V", "S"] as const;

export type ZiFoaie = Readonly<{
  zi: number;
  /** Inițiala zilei săptămânii, pentru capul de tabel. */
  litera: string;
  weekend: boolean;
  /** Denumirea sărbătorii legale, dacă ziua e una. */
  sarbatoare: string | null;
}>;

export type Foaie = Readonly<{
  an: number;
  luna: number;
  eticheta: string;
  zile: readonly ZiFoaie[];
  angajati: readonly string[];
  oreZi: number;
  zileLucratoare: number;
  normaLunara: number;
}>;

/** Limite de bun-simț, ca o adresă construită de mână să nu ceară un an 9999. */
export const AN_MIN = 2020;
export const AN_MAX = 2035;
export const MAX_ANGAJATI = 60;

export function normalizeazaAn(brut: string | undefined, implicit: number): number {
  const n = Number.parseInt(brut ?? "", 10);
  return Number.isFinite(n) && n >= AN_MIN && n <= AN_MAX ? n : implicit;
}

export function normalizeazaLuna(brut: string | undefined, implicit: number): number {
  const n = Number.parseInt(brut ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : implicit;
}

export function normalizeazaOre(brut: string | undefined): number {
  const n = Number.parseFloat((brut ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : 8;
}

/**
 * Numele din câmpul de text, câte unul pe rând.
 *
 * Când lista e goală se întorc rânduri goale numerotate: foaia are rost și
 * necompletată — se tipărește și se scrie de mână, ceea ce e chiar felul în care
 * o va folosi jumătate dintre cei care o descarcă.
 */
export function normalizeazaAngajati(brut: string | undefined): readonly string[] {
  const linii = (brut ?? "")
    .split(/[\n,;]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .slice(0, MAX_ANGAJATI);
  if (linii.length > 0) return linii;
  return Array.from({ length: 10 }, () => "");
}

export function construiesteFoaie(
  an: number,
  luna: number,
  angajati: readonly string[],
  oreZi: number,
): Foaie {
  const sarbatori = sarbatoriDupaZi(an);
  const nrZile = new Date(Date.UTC(an, luna, 0)).getUTCDate();

  const zile: ZiFoaie[] = [];
  let zileLucratoare = 0;

  for (let zi = 1; zi <= nrZile; zi += 1) {
    const data = new Date(Date.UTC(an, luna - 1, zi));
    const dow = data.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const iso = `${an}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
    const sarbatoare = sarbatori.get(iso) ?? null;
    if (!weekend && sarbatoare === null) zileLucratoare += 1;
    zile.push({ zi, litera: INITIALA_ZI[dow] ?? "", weekend, sarbatoare });
  }

  return {
    an,
    luna,
    eticheta: `${LUNI[luna - 1] ?? ""} ${an}`,
    zile,
    angajati,
    oreZi,
    zileLucratoare,
    normaLunara: zileLucratoare * oreZi,
  };
}
