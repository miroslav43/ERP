// src/lib/excel/raport-flota.ts
//
// Raportul lunar al flotei ca `DocumentXlsx`, pentru `randeazaXlsx` (F8).
// `documentRaportFlota` e PURĂ; `xlsxRaportFlota` o randează exact cum o
// descarcă ambele rute (Excelul singur și pachetul). Fără `server-only` — le
// încarcă și testele.
//
// ── CE ESTE ÎN FIȘIER ───────────────────────────────────────────────────────
// Primul tabel e costul pe vehicul (ce vrea contabilul întâi); după el vin
// consumul față de normă, kilometrii pe șofer și registrul foilor aprobate,
// aceleași foi ca PDF-urile din pachet.
//
// ── DE CE CELULELE SUNT NUMERE ──────────────────────────────────────────────
// Până pe 22 oct 2026 sumele erau text în format românesc („1.234,56”), fiindcă
// `DocumentTabelar` are doar șiruri: contabilul nu putea aduna nicio coloană.
// Acum lei, kilometri, litri, consumuri și abateri sunt `CelulaNumerica`
// (valoarea reală + un cod de format Excel, pe care Excelul în română îl arată
// `1.234,56`). „—” rămâne text: SUM îl sare, nu-l ia drept zero. Varianta cu
// generator propriu (precedentul `foaie-colectiva.ts`) ar fi copiat așezarea
// lui `randeazaXlsx` (titlu, câmpuri, tabele, note); lărgirea e doar pe
// celulele tabelelor, iar uneltele publice trec neschimbate.
//
// Valorile se rotunjesc la precizia afișată: ce vede contabilul în celulă e ce
// adună SUM.
import type {
  RaportLunar,
  RandConsum,
  RandCost,
  RandRegistru,
  RandSofer,
  TotalCost,
} from "@/domain/fleet/rapoarte";
import { etichetaLuna } from "@/domain/fleet/rapoarte";
import { formatDate } from "@/lib/format/date";
import type { Coloana } from "@/lib/unelte/document-tabelar";
import {
  curataDocumentXlsx,
  formatCuUnitate,
  FORMAT_LEI,
  FORMAT_NUMAR_INTREG,
  FORMAT_PROCENT_CU_SEMN,
  numar,
  randeazaXlsx,
  type CelulaXlsx,
  type DocumentXlsx,
  type TabelXlsx,
} from "@/lib/unelte/xlsx";

const NR0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const NR2 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LIPSA = "—";

const rotunjit = (v: number, zecimale: number): number => {
  const f = 10 ** zecimale;
  return Math.round(v * f) / f;
};

/** Câmpurile de antet rămân text (nu se adună); tabelele sunt numere. */
const kmText = (v: number): string => NR0.format(v);
const leiText = (v: number): string => NR2.format(v);

const intreg = (v: number): CelulaXlsx => numar(v, FORMAT_NUMAR_INTREG);
const km = (v: number): CelulaXlsx => numar(Math.round(v), FORMAT_NUMAR_INTREG);
const lei = (v: number): CelulaXlsx => numar(rotunjit(v, 2), FORMAT_LEI);
const sauLipsa = (v: number | null, f: (n: number) => CelulaXlsx): CelulaXlsx =>
  v === null ? LIPSA : f(v);

/** Abaterea vine în procente (28,57); Excelul vrea fracția (0,286 → „+28,6%”). */
function procent(v: number | null): CelulaXlsx {
  if (v === null) return LIPSA;
  return numar(rotunjit(v / 100, 3), FORMAT_PROCENT_CU_SEMN);
}

const coloana = (eticheta: string, latime = 2): Coloana => ({ eticheta, latime });

function costuri(
  randuri: readonly RandCost[],
  total: TotalCost,
): readonly (readonly CelulaXlsx[])[] {
  const rand = (eticheta: string, r: TotalCost): readonly CelulaXlsx[] => [
    eticheta,
    intreg(r.foi),
    lei(r.service),
    lei(r.cheltuieli),
    lei(r.documente),
    lei(r.combustibilFoi),
    lei(r.total),
    km(r.km),
    sauLipsa(r.costPeKm, lei),
  ];
  return [...randuri.map((r) => rand(r.vehicul, r)), rand("Total flotă", total)];
}

/** Unitatea stă în formatul celulei („36,00 l”), deci valoarea rămâne număr. */
const alimentat = (litri: number, unitate: "l" | "kWh"): CelulaXlsx =>
  numar(rotunjit(litri, 2), formatCuUnitate(unitate));
const la100 = (v: number | null, unitate: "l" | "kWh"): CelulaXlsx =>
  v === null ? LIPSA : numar(rotunjit(v, 2), formatCuUnitate(`${unitate}/100`));

function tabelConsum(randuri: readonly RandConsum[]): TabelXlsx {
  return {
    titlu: "Consum pe vehicul, față de norma proprie",
    coloane: [
      coloana("Vehicul", 2.4),
      coloana("Foi"),
      coloana("Km"),
      coloana("Alimentat"),
      coloana("Consum real"),
      coloana("Norma"),
      coloana("Abatere"),
      coloana("Foi fără normă"),
    ],
    randuri: randuri.map((r) => [
      r.vehicul,
      intreg(r.foi),
      km(r.km),
      alimentat(r.litri, r.unitate),
      la100(r.consumReal, r.unitate),
      la100(r.normaMedie, r.unitate),
      procent(r.abatere),
      intreg(r.foiFaraNorma),
    ]),
  };
}

function tabelSoferi(randuri: readonly RandSofer[]): TabelXlsx {
  return {
    titlu: "Kilometri pe șofer",
    coloane: [
      coloana("Șofer", 2.4),
      coloana("Foi"),
      coloana("Zile"),
      coloana("Vehicule"),
      coloana("Km"),
    ],
    randuri: randuri.map((r) => [
      r.sofer,
      intreg(r.foi),
      intreg(r.zile),
      intreg(r.vehicule),
      km(r.km),
    ]),
  };
}

function tabelRegistru(randuri: readonly RandRegistru[]): TabelXlsx {
  return {
    titlu: "Foile aprobate ale lunii",
    coloane: [
      coloana("Nr. foaie", 2.4),
      coloana("Data"),
      coloana("Vehicul"),
      coloana("Șofer"),
      coloana("Km"),
      coloana("Alimentat"),
      coloana("Cost combustibil"),
      coloana("Consum real"),
      coloana("Norma"),
      // F12f (0217): codurile UIT (RO e-Transport) ale curselor foii.
      coloana("UIT", 2.4),
    ],
    randuri: randuri.map((r) => [
      r.numar ?? LIPSA,
      formatDate(r.data),
      r.vehicul,
      r.sofer,
      km(r.km),
      alimentat(r.litri, r.unitate),
      lei(r.costCombustibil),
      la100(r.consumReal, r.unitate),
      la100(r.norma, r.unitate),
      r.uituri.length === 0 ? "" : r.uituri.join(", "),
    ]),
  };
}

/** „1 ciornă, 2 trimise spre aprobare, 1 respinsă”, sau „nicio foaie”. */
function textNeaprobate(n: RaportLunar["foiNeaprobate"]): string {
  const parti = [
    n.ciorne === 0 ? null : `${String(n.ciorne)} ${n.ciorne === 1 ? "ciornă" : "ciorne"}`,
    n.trimise === 0
      ? null
      : `${String(n.trimise)} ${n.trimise === 1 ? "trimisă" : "trimise"} spre aprobare`,
    n.respinse === 0 ? null : `${String(n.respinse)} ${n.respinse === 1 ? "respinsă" : "respinse"}`,
  ].filter((p): p is string => p !== null);
  return parti.length === 0 ? "nicio foaie" : parti.join(", ");
}

export function documentRaportFlota(
  p: Readonly<{
    organizatie: string;
    raport: RaportLunar;
    /** Numărul vehiculului ales, când raportul e pe un singur vehicul. */
    vehicul: string | null;
    /** Momentul generării, deja formatat de apelant (domeniul nu citește ceasul). */
    generatLa: string;
  }>,
): DocumentXlsx {
  const { raport } = p;
  const luna = etichetaLuna(raport.luna);
  return {
    titlu: `Raport flotă — ${luna}`,
    subtitlu: p.vehicul === null ? p.organizatie : `${p.organizatie} · vehiculul ${p.vehicul}`,
    campuri: [
      { eticheta: "Luna", valoare: luna },
      { eticheta: "Vehicule", valoare: p.vehicul ?? "toată flota" },
      { eticheta: "Foi aprobate în lună", valoare: String(raport.totaluri.foi) },
      { eticheta: "Kilometri pe foile aprobate", valoare: kmText(raport.totaluri.km) },
      { eticheta: "Cost total, în lei", valoare: leiText(raport.totalCost.total) },
      {
        eticheta: "Foi neaprobate (nu intră în cifre)",
        valoare: textNeaprobate(raport.foiNeaprobate),
      },
      { eticheta: "Generat la", valoare: p.generatLa },
    ],
    paragrafe: [],
    coloane: [
      coloana("Vehicul", 2.4),
      coloana("Foi"),
      coloana("Service"),
      coloana("Cheltuieli"),
      coloana("Documente"),
      coloana("Combustibil (foi)"),
      coloana("Total"),
      coloana("Km"),
      coloana("Lei/km"),
    ],
    randuri: costuri(raport.costuri, raport.totalCost),
    umbrite: [],
    tabeleSuplimentare: [
      tabelConsum(raport.consum),
      tabelSoferi(raport.soferi),
      tabelRegistru(raport.registru),
    ],
    note: [
      "Kilometrii, litrii și combustibilul vin numai de pe foile APROBATE ale lunii; ciornele, foile trimise și cele respinse nu intră în cifre.",
      "Costul pe vehicul adună service-ul, cheltuielile fără foaie, documentele cu valabilitatea începută în lună și combustibilul foilor aprobate. Lei/km = total ÷ km; fără kilometri nu se calculează (—).",
      "Consum real = alimentat ÷ km × 100. Norma = media normelor de pe foi, ponderată cu kilometrii; abaterea pozitivă înseamnă consum peste normă.",
      "Sumele, kilometrii, litrii și consumurile din tabele sunt numere: coloanele se adună în Excel. „—” înseamnă că valoarea nu se poate calcula și nu intră în sumă.",
    ],
    semnaturi: [],
    orientare: "peisaj",
    numeFisier:
      p.vehicul === null
        ? `raport-flota-${raport.luna}`
        : `raport-flota-${raport.luna}-${p.vehicul}`,
  };
}

/**
 * Excelul raportului, exact cum îl descarcă ambele rute (`/api/export/flota` și
 * pachetul lunar): curățat și FĂRĂ subsolul uneltelor publice — e un export al
 * aplicației plătite.
 */
export function xlsxRaportFlota(d: DocumentXlsx): Promise<Uint8Array> {
  return randeazaXlsx(curataDocumentXlsx(d), { subsol: "aplicatie" });
}
