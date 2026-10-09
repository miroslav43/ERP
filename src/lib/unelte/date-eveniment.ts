// src/lib/unelte/date-eveniment.ts
import { TIPURI_CERERE } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/variante";
import { TIPURI_DEMISIE } from "@/app/(marketing)/unelte/cerere-demisie/model";
import { citesteSuma } from "@/app/(marketing)/unelte/adeverinta-salariat/model";
import { SETURI } from "@/app/(marketing)/unelte/fisa-evaluare/seturi";
import { ANI_ACOPERITI, PERIODICITATI } from "@/app/(marketing)/unelte/fisa-instruire-ssm/model";
import {
  CATEGORII,
  COMBUSTIBILI,
  MAX_CURSE_PE_ZI,
  UTILIZARI,
} from "@/app/(marketing)/unelte/foaie-de-parcurs/model";
import { citesteAngajati, MAX_ANGAJATI } from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie";
import { PROGRAME, VARIANTE } from "@/app/(marketing)/unelte/foaie-de-pontaj/pontaj";
import { ZILE_MAXIME, ZILE_MINIME } from "@/app/(marketing)/unelte/programare-concedii/model";
import { estePerioada } from "@/content/legal/salarizare-publica";

/**
 * Câmpurile care însoțesc un eveniment de server: ce fel de document s-a cerut,
 * niciodată pentru cine.
 *
 * ── REGULA ────────────────────────────────────────────────────────────────
 * Utilizatorul a cerut pe 9 oct 2026 să vadă și „datele” descărcărilor, nu doar
 * numărul lor, cu o condiție: nimic care să identifice pe cineva. De aici
 * forma: o LISTĂ ALBĂ pe unealtă, iar fiecare câmp trece printr-un cititor care
 * întoarce doar
 *   - o valoare dintr-o mulțime închisă, luată din modelul uneltei (programul,
 *     varianta, tipul cererii, categoria vehiculului…);
 *   - un întreg mărginit (anul, luna, numărul de curse, zilele cuvenite);
 *   - un NUMĂR derivat din text (câți angajați are lista — nu numele lor);
 *   - o treaptă largă pentru bani (sub 5.000 / 5.000–10.000 / peste 10.000).
 * Niciun cititor nu copiază textul primit. Nume, firmă, CUI, număr de mașină,
 * traseu, funcție, scop, observații și sume exacte nu au cititor, deci nu pleacă.
 * `date-eveniment.test.ts` umple TOATE câmpurile tuturor uneltelor cu un text-
 * santinelă și cade dacă îl regăsește în vreun eveniment.
 *
 * ── DE CE MULȚIMILE VIN DIN MODELE ────────────────────────────────────────
 * O valoare nouă într-un model (un program, un tip de cerere) e numărată fără
 * altă listă; una scoasă nu mai poate trece. Nimic de ținut în pas de mână.
 */

export type DateEveniment = Readonly<Record<string, string | number>>;

type Cititor = (q: URLSearchParams) => string | number | null;

/** Pragurile treptelor de brut, în lei: destul de largi ca să nu spună salariul. */
export const PRAG_BRUT_JOS = 5000;
export const PRAG_BRUT_SUS = 10_000;
export const TREPTE_BRUT = ["sub-5000", "5000-10000", "peste-10000"] as const;
export type TreaptaBrut = (typeof TREPTE_BRUT)[number];

export function treaptaBrut(suma: number): TreaptaBrut {
  if (suma < PRAG_BRUT_JOS) return "sub-5000";
  return suma <= PRAG_BRUT_SUS ? "5000-10000" : "peste-10000";
}

function brut(q: URLSearchParams, cheie: string): string | null {
  const v = q.get(cheie);
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function intreg(cheie: string, min: number, max: number): Cititor {
  return (q) => {
    const t = brut(q, cheie);
    if (t === null || !/^\d{1,4}$/u.test(t)) return null;
    const n = Number(t);
    return n >= min && n <= max ? n : null;
  };
}

function alegere(cheie: string, valori: readonly (string | number)[]): Cititor {
  return (q) => {
    const t = brut(q, cheie);
    if (t === null) return null;
    // Valoarea întoarsă e cea din model, nu cea primită: nici măcar
    // majusculele sau spațiile vizitatorului nu trec.
    return valori.find((v) => String(v) === t) ?? null;
  };
}

/** Câte rânduri are lista de angajați, plafonată ca în unealtă. Numele rămân pe loc. */
function numarAngajati(cheie: string): Cititor {
  return (q) => {
    const v = q.get(cheie);
    if (v === null) return null;
    return Math.min(citesteAngajati(v).total, MAX_ANGAJATI);
  };
}

/** Anul sau luna dintr-o dată `AAAA-LL-ZZ`; ziua nu pleacă. */
function dinData(cheie: string, parte: "an" | "luna"): Cititor {
  return (q) => {
    const m = /^(\d{4})-(\d{2})-\d{2}$/u.exec(brut(q, cheie) ?? "");
    if (m === null) return null;
    const n = Number(parte === "an" ? m[1] : m[2]);
    if (parte === "luna") return n >= 1 && n <= 12 ? n : null;
    return n >= 2000 && n <= 2100 ? n : null;
  };
}

function treaptaDinSuma(cheie: string): Cititor {
  return (q) => {
    const t = brut(q, cheie);
    if (t === null) return null;
    const suma = citesteSuma(t);
    return suma === null ? null : treaptaBrut(suma);
  };
}

const AN = intreg("an", 2000, 2100);
const LUNA = intreg("luna", 1, 12);
const ANGAJATI = numarAngajati("angajati");
const PROGRAM = alegere(
  "program",
  PROGRAME.map((p) => p.valoare),
);

/**
 * Lista albă, pe unealtă (slug-ul paginii). O unealtă care lipsește de aici
 * pleacă doar cu numele evenimentului — tot fără date, niciodată cu ele.
 */
export const CAMPURI_EVENIMENT: Readonly<Record<string, Readonly<Record<string, Cititor>>>> = {
  "foaie-de-pontaj": {
    an: AN,
    luna: LUNA,
    angajati: ANGAJATI,
    program: PROGRAM,
    varianta: alegere(
      "varianta",
      VARIANTE.map((v) => v.valoare),
    ),
  },
  "condica-de-prezenta": { an: AN, luna: LUNA, angajati: ANGAJATI, program: PROGRAM },
  "foaie-de-parcurs": {
    an: AN,
    luna: LUNA,
    categorie: alegere("categorie", CATEGORII),
    combustibil: alegere("combustibil", COMBUSTIBILI),
    utilizare: alegere("utilizare", UTILIZARI),
    curse: intreg("curse", 1, MAX_CURSE_PE_ZI),
  },
  "cerere-concediu-de-odihna": {
    tip: alegere("tip", TIPURI_CERERE),
    cult: alegere("cult", ["ortodox", "gregorian"]),
    an: dinData("de_la", "an"),
    luna: dinData("de_la", "luna"),
  },
  "fisa-instruire-ssm": {
    periodicitate: alegere("periodicitate", Object.keys(PERIODICITATI)),
    ani: alegere("ani", ANI_ACOPERITI),
  },
  "fisa-evaluare": {
    set: alegere(
      "set",
      SETURI.map((s) => s.cheie),
    ),
  },
  "cerere-demisie": {
    tip: alegere(
      "tip",
      TIPURI_DEMISIE.map((t) => t.cheie),
    ),
    categorie: alegere("categorie", ["executie", "conducere"]),
  },
  "programare-concedii": {
    an: AN,
    angajati: ANGAJATI,
    zile: intreg("zile", ZILE_MINIME, ZILE_MAXIME),
  },
  "adeverinta-salariat": {
    durata: alegere("durata", ["nedeterminata", "determinata"]),
    ore: intreg("ore", 1, 8),
    brut: treaptaDinSuma("salariu"),
  },
};

/** Câmpurile unei descărcări; obiect gol dacă unealta n-are listă sau nimic nu s-a citit. */
export function dateDescarcare(unealta: string, q: URLSearchParams): DateEveniment {
  const campuri = Object.hasOwn(CAMPURI_EVENIMENT, unealta)
    ? CAMPURI_EVENIMENT[unealta]
    : undefined;
  if (campuri === undefined) return {};
  const date: Record<string, string | number> = {};
  for (const [cheie, citeste] of Object.entries(campuri)) {
    const valoare = citeste(q);
    if (valoare !== null) date[cheie] = valoare;
  }
  return date;
}

/**
 * Câmpurile unui calcul de salariu: perioada legală, sensul (din brut sau din
 * net) și treapta brutului REZULTAT — niciodată suma scrisă.
 */
export function dateCalcul(q: URLSearchParams, brutRezultat: number | null): DateEveniment {
  const date: Record<string, string | number> = {
    din: q.get("din") === "net" ? "net" : "brut",
  };
  const perioada = q.get("perioada");
  if (estePerioada(perioada)) date["perioada"] = perioada;
  if (brutRezultat !== null && Number.isFinite(brutRezultat)) {
    date["brut"] = treaptaBrut(brutRezultat);
  }
  return date;
}
