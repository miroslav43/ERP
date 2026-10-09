import { cuDe } from "@/content/legal/zile-libere";
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { curataText } from "@/lib/unelte/document-tabelar";

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
export const MAX_LUNGIME_NUME = 80;

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

export type ListaAngajati = Readonly<{
  /** Numele de pe foaie: cel mult `MAX_ANGAJATI`, fiecare cel mult `MAX_LUNGIME_NUME`. Gol ⇒ 10 rânduri goale. */
  nume: readonly string[];
  /** Câte nume nevide avea câmpul, înainte de plafon. */
  total: number;
  /** Câte nume au rămas pe dinafară din cauza plafonului de `MAX_ANGAJATI`. */
  omisi: number;
  /** Câte dintre numele păstrate au fost scurtate la `MAX_LUNGIME_NUME`. */
  scurtate: number;
}>;

/**
 * Despărțitorul dintre angajați: DOAR rândul nou.
 *
 * Până pe 8 oct 2026 despărțeau și virgula, și punctul și virgula. Pagina spune
 * „câte un nume pe rând”, dar „Popescu, Ion” ieșea ca doi angajați, iar „&amp;”
 * se rupea la „;” (auditul din 8 oct 2026). O coloană copiată din Excel vine
 * deja cu un nume pe rând. O listă scrisă cu virgule se rescrie o dată, pe când
 * un nume rupt în doi nu se vede până la semnătură. Tabul vertical (U+000B,
 * rândul manual din Word), NEL și separatorii Unicode sunt tot rând nou.
 */
const RAND_NOU_INTRE_NUME = /\r\n|[\n\r\v\f\u{85}\u{2028}\u{2029}]/u;

/**
 * Numele din câmpul de text, câte unul pe rând, plus ce s-a pierdut pe drum.
 *
 * Când lista e goală se întorc rânduri goale numerotate: foaia are rost și
 * necompletată — se tipărește și se scrie de mână, ceea ce e chiar felul în care
 * o va folosi jumătate dintre cei care o descarcă.
 */
export function citesteAngajati(brut: string | undefined): ListaAngajati {
  const toate = (brut ?? "")
    .split(RAND_NOU_INTRE_NUME)
    // `curataText` scoate spațiile de lățime zero (un rând care le conține doar
    // pe ele nu mai trece drept nume) și face din tab un spațiu: „Popa⇥Ion”,
    // două coloane din Excel, devine „Popa Ion”.
    .map((linie) => curataText(linie).replace(/\s+/gu, " ").trim())
    .filter((linie) => linie.length > 0);
  // Plafon și pe lungimea unui nume, nu doar pe numărul lor: un „nume” de mii de
  // caractere costa secunde de CPU la PDF.
  const pastrate = toate.slice(0, MAX_ANGAJATI);
  const nume = pastrate.map((linie) => linie.slice(0, MAX_LUNGIME_NUME));
  return {
    nume: nume.length > 0 ? nume : Array.from({ length: 10 }, () => ""),
    total: toate.length,
    omisi: toate.length - pastrate.length,
    scurtate: pastrate.filter((linie) => linie.length > MAX_LUNGIME_NUME).length,
  };
}

/** Doar numele de pe foaie; vezi `citesteAngajati`. */
export function normalizeazaAngajati(brut: string | undefined): readonly string[] {
  return citesteAngajati(brut).nume;
}

/**
 * Ce s-a pierdut din listă, spus pe pagină. Plafonul de 60 rămâne (o adresă
 * mai lungă de ~8 KB cade la Cloudflare, iar 60 de nume înseamnă deja trei
 * pagini A4 culcate), dar nu mai e tăcut: cu 70 de nume, foaia avea 60 de
 * rânduri și nimic nu spunea asta (auditul din 8 oct 2026).
 */
export function avizAngajati(lista: ListaAngajati): readonly string[] {
  const avize: string[] = [];
  if (lista.omisi > 0) {
    // Cu 61 de nume rămâne unul singur: „ceilalți 1” nu e românește.
    const restul =
      lista.omisi === 1
        ? "Pentru ultimul, generează încă o foaie doar cu numele lui."
        : `Pentru ceilalți ${String(lista.omisi)}, generează încă o foaie doar cu numele lor.`;
    avize.push(
      `Am păstrat primii ${String(MAX_ANGAJATI)} din ${cuDe(lista.total, "angajați")}. ${restul}`,
    );
  }
  if (lista.scurtate === 1) {
    avize.push(`Un nume avea peste ${cuDe(MAX_LUNGIME_NUME, "caractere")} și l-am scurtat.`);
  } else if (lista.scurtate > 1) {
    avize.push(
      `${cuDe(lista.scurtate, "nume")} aveau peste ${cuDe(MAX_LUNGIME_NUME, "caractere")} și le-am scurtat.`,
    );
  }
  return avize;
}

/** Nota din fișierul descărcat: fișierul circulă fără pagină, deci spune singur că lista e incompletă. */
export function notaOmisi(lista: ListaAngajati): string | null {
  if (lista.omisi === 0) return null;
  const restul =
    lista.omisi === 1 ? "ultimul nu apare aici" : `ceilalți ${String(lista.omisi)} nu apar aici`;
  return `Documentul cuprinde primii ${String(MAX_ANGAJATI)} din ${cuDe(lista.total, "angajați")} trimiși; ${restul}.`;
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
