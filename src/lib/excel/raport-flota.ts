// src/lib/excel/raport-flota.ts
//
// Raportul lunar al flotei ca `DocumentTabelar`, pentru `randeazaXlsx` (F8).
// Funcție PURĂ: același obiect ar putea fi randat și în PDF sau Word, dar
// pachetul pentru contabil e Excel. Fără `server-only` — o încarcă și testele.
//
// ── CE ESTE ÎN FIȘIER ───────────────────────────────────────────────────────
// Primul tabel e costul pe vehicul (ce vrea contabilul întâi); după el vin
// consumul față de normă, kilometrii pe șofer și registrul foilor aprobate,
// aceleași foi ca PDF-urile din pachet.
//
// ── DE CE CELULELE SUNT TEXT ────────────────────────────────────────────────
// `DocumentTabelar` nu are celule numerice: `randuri` e `string[][]`, ca să
// aibă aceeași formă în PDF, Word și Excel. Sumele sunt deci scrise în formatul
// românesc (`1.234,56`), iar nota de la sfârșit spune asta pe față, ca nimeni să
// nu caute o sumă automată într-o coloană de text.
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
import type { Coloana, DocumentTabelar, TabelSuplimentar } from "@/lib/unelte/document-tabelar";

const NR0 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
const NR1 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NR2 = new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const LIPSA = "—";

const km = (v: number): string => NR0.format(v);
const lei = (v: number): string => NR2.format(v);
const sauLipsa = (v: number | null, f: (n: number) => string): string =>
  v === null ? LIPSA : f(v);

function procent(v: number | null): string {
  if (v === null) return LIPSA;
  // „+28,6%”: semnul arată direcția, iar zero nu are semn.
  const semn = v > 0 ? "+" : "";
  return `${semn}${NR1.format(v)}%`;
}

const coloana = (eticheta: string, latime = 2): Coloana => ({ eticheta, latime });

function costuri(randuri: readonly RandCost[], total: TotalCost): readonly (readonly string[])[] {
  const rand = (eticheta: string, r: TotalCost): readonly string[] => [
    eticheta,
    String(r.foi),
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

const alimentat = (litri: number, unitate: "l" | "kWh"): string =>
  `${NR2.format(litri)} ${unitate}`;
const la100 = (v: number | null, unitate: "l" | "kWh"): string =>
  v === null ? LIPSA : `${NR2.format(v)} ${unitate}/100`;

function tabelConsum(randuri: readonly RandConsum[]): TabelSuplimentar {
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
      String(r.foi),
      km(r.km),
      alimentat(r.litri, r.unitate),
      la100(r.consumReal, r.unitate),
      la100(r.normaMedie, r.unitate),
      procent(r.abatere),
      String(r.foiFaraNorma),
    ]),
  };
}

function tabelSoferi(randuri: readonly RandSofer[]): TabelSuplimentar {
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
      String(r.foi),
      String(r.zile),
      String(r.vehicule),
      km(r.km),
    ]),
  };
}

function tabelRegistru(randuri: readonly RandRegistru[]): TabelSuplimentar {
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
): DocumentTabelar {
  const { raport } = p;
  const luna = etichetaLuna(raport.luna);
  return {
    titlu: `Raport flotă — ${luna}`,
    subtitlu: p.vehicul === null ? p.organizatie : `${p.organizatie} · vehiculul ${p.vehicul}`,
    campuri: [
      { eticheta: "Luna", valoare: luna },
      { eticheta: "Vehicule", valoare: p.vehicul ?? "toată flota" },
      { eticheta: "Foi aprobate în lună", valoare: String(raport.totaluri.foi) },
      { eticheta: "Kilometri pe foile aprobate", valoare: km(raport.totaluri.km) },
      { eticheta: "Cost total, în lei", valoare: lei(raport.totalCost.total) },
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
      "Valorile din tabele sunt text, scrise în formatul românesc (1.234,56): nu se adună automat în Excel.",
    ],
    semnaturi: [],
    orientare: "peisaj",
    numeFisier:
      p.vehicul === null
        ? `raport-flota-${raport.luna}`
        : `raport-flota-${raport.luna}-${p.vehicul}`,
  };
}
