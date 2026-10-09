// src/content/landing/seo-unelte.ts
import { anulProgramarii } from "@/domain/calendar/interval-lucrator";
import { todayInBucharest } from "@/lib/format/date";

/**
 * Titlul și descrierea fiecărei unelte gratuite, într-un singur loc.
 *
 * ── DE CE AICI, NU ÎN `page.tsx` ──────────────────────────────────────────
 * Până la 8 oct 2026 fiecare pagină își scria singură titlul, iar planurile
 * paralele (pontaj, cerere, calculator) le rescriau pe rând. Foaia de pontaj
 * era cât pe ce să-și piardă „lunar” din titlu — singurul termen pentru care
 * Google o afișa (poziția 28, 7 afișări în 90 de zile). Aici fiecare unealtă
 * își declară și TERMENUL PRINCIPAL, iar testul cere ca titlul să-l conțină și
 * ca termenul să fie urmărit în `docs/comercial/cuvinte-tinta.tsv`.
 *
 * ── DESCRIEREA ────────────────────────────────────────────────────────────
 * Ce primește omul, în ordinea în care decide: documentul, ce face singur,
 * formatul, „fără cont”. Între 70 și 160 de caractere: Google taie pe la 155.
 *
 * ── `{an}` ────────────────────────────────────────────────────────────────
 * Anul calendaristic al zilei cererii, în România. Paginile care îl folosesc
 * își declară metadatele cu `generateMetadata`, nu cu o constantă: o constantă
 * se evaluează la build și ar fi ținut „2026” în titlu și în ianuarie 2027.
 * `{an-programare}` e anul programării concediilor: din octombrie, anul următor.
 */

export type MetaUnealta = Readonly<{
  /** Fără marcă — o adaugă șablonul din layout. Cel mult 48 de caractere după înlocuiri. */
  titlu: string;
  descriere: string;
  /** Forma căutată, fără diacritice, ca în `docs/comercial/cuvinte-tinta.tsv`. */
  termen: string;
}>;

export const META_UNELTE: Readonly<Record<string, MetaUnealta>> = {
  "/unelte/foaie-de-pontaj": {
    titlu: "Foaie de pontaj lunar: model PDF, Word, Excel",
    descriere:
      "Foaie de pontaj lunar pentru orice lună, cu weekendurile și sărbătorile legale marcate singure. Descarci în PDF, Word sau Excel cu totaluri, fără cont.",
    termen: "foaie de pontaj lunar",
  },
  "/unelte/condica-de-prezenta": {
    // Titlul și descrierea scrise la E14 (sâmbete și ture, pauza, orele calculate).
    titlu: "Condica de prezență: model Word, PDF și Excel",
    descriere:
      "Condica de prezență pentru orice lună, cu sâmbete și ture, ora sosirii și a plecării, pauza și orele calculate în Excel. Word, PDF sau Excel, gratuit.",
    termen: "condica de prezenta model",
  },
  "/unelte/cerere-concediu-de-odihna": {
    // Titlul e al lui F14 („Word/PDF gratuit”, 48 de caractere cu anul pe 4 cifre).
    titlu: "Cerere concediu de odihnă {an}, Word/PDF gratuit",
    descriere:
      "Cerere de concediu de odihnă completată online: scrii numele și perioada, iar zilele lucrătoare se numără singure, fără sărbători. Word sau PDF, fără cont.",
    termen: "cerere concediu de odihna",
  },
  "/unelte/calculator-zile-concediu": {
    titlu: "Calculator zile de concediu de odihnă {an}",
    descriere:
      "Câte zile de concediu de odihnă ți se cuvin în anul angajării sau al plecării: minimul legal, zilele suplimentare și calculul proporțional. Gratuit, fără cont.",
    termen: "calculator zile concediu de odihna",
  },
  "/unelte/programare-concedii": {
    titlu: "Programare concedii de odihnă {an-programare}: Excel",
    descriere:
      "Programarea anuală a concediilor de odihnă în Excel, Word sau PDF, cu zilele lucrătoare ale fiecărei luni și sărbătorile anului. Ce cere Codul muncii.",
    termen: "programare concedii de odihna",
  },
  "/unelte/calculator-zile-lucratoare": {
    titlu: "Calculator zile lucrătoare între două date",
    descriere:
      "Câte zile lucrătoare sunt între două date, fără weekend și sărbători legale, sau ce dată e peste N zile lucrătoare. Pentru termene, preaviz și concedii.",
    termen: "calculator zile lucratoare",
  },
  "/unelte/cerere-demisie": {
    titlu: "Cerere de demisie: model Word, preaviz calculat",
    descriere:
      "Model de cerere de demisie cu preaviz calculat: ultima zi de lucru, fără weekend și sărbători. Și fără preaviz, în perioada de probă sau cu acordul părților.",
    termen: "cerere demisie",
  },
  "/unelte/adeverinta-salariat": {
    titlu: "Adeverință de salariat: model Word și PDF",
    descriere:
      "Adeverință de salariat completată online: funcția, data angajării, norma și, la nevoie, salariul. Model gratuit Word sau PDF, după art. 34 Codul muncii.",
    termen: "adeverinta de salariat model",
  },
  "/unelte/foaie-de-parcurs": {
    // Titlul și descrierea scrise la G8 (cele patru elemente din normele fiscale).
    titlu: "Foaie de parcurs: model Word, PDF și Excel",
    descriere:
      "Foaie de parcurs cu cele 4 elemente cerute de normele Codului fiscal: mai multe curse pe zi, alimentări, Excel cu formule. Gratuită, în Word și PDF, fără cont.",
    termen: "foaie de parcurs model",
  },
  "/unelte/fisa-instruire-ssm": {
    // Titlul și descrierea scrise la H7 (anexa 11 completă).
    titlu: "Fișa individuală de instruire SSM: model gratuit",
    descriere:
      "Fișa individuală de instruire SSM completă, după anexa 11 la HG 1425/2006: la angajare, periodică, suplimentară, testări, control medical. Word sau PDF.",
    termen: "fisa instruire ssm model",
  },
  "/unelte/fisa-evaluare": {
    // Descrierea scrisă la I9. Titlul de la I9 („Fișă de
    // evaluare angajați, cu nota calculată”) pierdea „model” din termenul urmărit
    // în `cuvinte-tinta.tsv`; același principiu ca „lunar” la pontaj. 48 de caractere.
    titlu: "Fișă de evaluare angajați: model, nota calculată",
    descriere:
      "Fișa de evaluare a angajaților: criterii pe tipuri de post, pondere, notă 1–5, nota finală și calificativul calculate. Excel cu formule, Word sau PDF.",
    termen: "fisa evaluare angajati model",
  },
  "/unelte/calculator-salariu": {
    // Descrierea scrisă la C11, 154 de caractere.
    titlu: "Calcul salariu net și brut 2026: calculator",
    descriere:
      "Calcul salariu net din brut și brut din net, 2026: CAS, CASS, impozit, deducerea pentru copii și sub 26 de ani, tichete de masă, timp parțial, cost firmă.",
    termen: "calcul salariu net",
  },
};

/**
 * Datele pentru `metadatePagina`. `azi` e ziua cererii (`YYYY-MM-DD`, ora
 * României); parametrul există pentru teste.
 *
 * `Object.hasOwn`, ca în `registru.ts`: indexarea directă ar întoarce
 * `Object.prototype.constructor` pentru „constructor”.
 */
export function metaUnealta(
  cale: string,
  azi: string = todayInBucharest(),
): Readonly<{ titlu: string; descriere: string; cale: string }> {
  const meta = Object.hasOwn(META_UNELTE, cale) ? META_UNELTE[cale] : undefined;
  if (meta === undefined) throw new Error(`Unealta ${cale} n-are metadate în seo-unelte.ts.`);
  return {
    // `{an-programare}`: anul care se programează — din octombrie, cel următor
    // (art. 148 alin. (1), `anulProgramarii`).
    titlu: meta.titlu
      .replaceAll("{an-programare}", String(anulProgramarii(azi)))
      .replaceAll("{an}", azi.slice(0, 4)),
    descriere: meta.descriere,
    cale,
  };
}
