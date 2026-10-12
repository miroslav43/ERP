// src/content/landing/exemple-unelte.ts
/**
 * Exemplele „model completat” ale uneltelor.
 *
 * ── DE CE ─────────────────────────────────────────────────────────────────
 * „foaie de parcurs model completat”, „fisa ssm completata”: omul vrea să vadă
 * documentul plin înainte să-l completeze pe al lui. Exemplul e un link spre
 * unealta însăși, cu parametri fictivi, plus o captură a previzualizării —
 * deci arată exact ce descarcă, nu o ilustrație.
 *
 * ── DATELE ────────────────────────────────────────────────────────────────
 * Firma e „Administrativo Demo SRL”, aceeași firmă cu date inventate ca în
 * `scripts/capturi/capturi.mjs`. Fără CUI: un număr inventat poate fi al unei
 * firme reale. Numele de oameni sunt comune și fictive.
 *
 * ── POARTA ────────────────────────────────────────────────────────────────
 * `exemple-unelte.test.ts` construiește fiecare exemplu prin registrul
 * uneltelor și caută în document fiecare valoare din `verificate`: un parametru
 * redenumit într-o unealtă pică aici, nu în fața omului. Capturile se refac cu
 * `node scripts/capturi/capturi-unelte.mjs`, cu `pnpm dev` pornit.
 */

export const LATURA_CAPTURA = 1200;

export type ExempluUnealta = Readonly<{
  /** Calea paginii uneltei. */
  pagina: string;
  /**
   * Segmentul rutei de descărcare (`/api/unelte/<api>`): cheia din `UNELTE` sau
   * o rută statică proprie (fișa de evaluare, după I7).
   */
  api: string;
  parametri: Readonly<Record<string, string>>;
  /** Valori care TREBUIE să apară în documentul construit. */
  verificate: readonly string[];
  alt: string;
  /** Baza numelui de fișier din `public/capturi/unelte/`. */
  captura: string;
}>;

const FIRMA = "Administrativo Demo SRL";

export const EXEMPLE_UNELTE: readonly ExempluUnealta[] = [
  {
    pagina: "/unelte/cerere-demisie",
    api: "cerere-demisie",
    parametri: {
      tip: "preaviz",
      categorie: "executie",
      nume: "Popescu Ana",
      functie: "contabil",
      angajator: FIRMA,
      contract: "nr. 12 din 03.02.2025",
      depunere: "2026-10-08",
      preaviz: "20",
    },
    verificate: [
      "Popescu Ana",
      "contabil",
      FIRMA,
      "nr. 12 din 03.02.2025",
      "joi, 5 noiembrie 2026",
    ],
    alt: "Cerere de demisie, model completat: preaviz de 20 de zile lucrătoare, ultima zi joi, 5 noiembrie 2026",
    captura: "cerere-demisie-exemplu",
  },
  {
    pagina: "/unelte/programare-concedii",
    api: "programare-concedii",
    parametri: {
      an: "2027",
      firma: FIRMA,
      compartiment: "Producție",
      zile: "21",
      angajati: "Popescu Ana\nIonescu Mihai\nRadu Elena",
    },
    verificate: [FIRMA, "Producție", "Popescu Ana", "Ionescu Mihai", "Radu Elena", "anul 2027"],
    alt: "Programarea concediilor de odihnă pe 2027, model completat, cu zilele lucrătoare din fiecare lună",
    captura: "programare-concedii-exemplu",
  },
  {
    pagina: "/unelte/adeverinta-salariat",
    api: "adeverinta-salariat",
    parametri: {
      firma: FIRMA,
      nr: "154",
      nume: "Popescu Ana",
      functie: "contabil",
      angajare: "2025-02-03",
      durata: "nedeterminata",
      ore: "8",
      scop: "medicul de familie",
    },
    verificate: [FIRMA, "Popescu Ana", "contabil", "03.02.2025", "medicul de familie"],
    alt: "Adeverință de salariat, model completat pentru medicul de familie",
    captura: "adeverinta-salariat-exemplu",
  },
  {
    pagina: "/unelte/fisa-instruire-ssm",
    api: "fisa-instruire-ssm",
    parametri: {
      nume: "Popescu Ana",
      functie: "operator CNC",
      loc: "Hala de producție",
      firma: FIRMA,
    },
    verificate: ["Popescu Ana", "operator CNC", "Hala de producție", FIRMA],
    alt: "Fișa individuală de instruire SSM, model completat pentru un operator CNC",
    captura: "fisa-instruire-ssm-exemplu",
  },
  {
    pagina: "/unelte/fisa-evaluare",
    api: "fisa-evaluare",
    parametri: {
      nume: "Popescu Ana",
      functie: "contabil",
      perioada: "ianuarie – decembrie 2026",
      evaluator: "Ionescu Mihai, director",
      firma: FIRMA,
    },
    verificate: ["Popescu Ana", "contabil", "ianuarie – decembrie 2026", "Ionescu Mihai, director"],
    alt: "Fișa de evaluare a performanțelor profesionale, model completat",
    captura: "fisa-evaluare-exemplu",
  },
];

export function exempluPentru(pagina: string): ExempluUnealta | undefined {
  return EXEMPLE_UNELTE.find((e) => e.pagina === pagina);
}

export function adresaExemplu(e: ExempluUnealta): string {
  return `${e.pagina}?${new URLSearchParams(e.parametri).toString()}#documentul`;
}

export function descarcareExemplu(e: ExempluUnealta, format: "pdf" | "docx" | "xlsx"): string {
  return `/api/unelte/${e.api}?${new URLSearchParams({ ...e.parametri, format }).toString()}`;
}

export function srcCaptura(e: ExempluUnealta, latura: 600 | 1200): string {
  return `/capturi/unelte/${e.captura}-${String(latura)}.webp`;
}

export function imagineExemplu(
  e: ExempluUnealta,
): Readonly<{ url: string; latime: number; inaltime: number; descriere: string }> {
  return {
    url: srcCaptura(e, 1200),
    latime: LATURA_CAPTURA,
    inaltime: LATURA_CAPTURA,
    descriere: e.alt,
  };
}
