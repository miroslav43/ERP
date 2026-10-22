// src/domain/fleet/contabil/articole.ts
//
// Modelul exportului contabil al flotei (F12g): ce linie intră în note, cum se
// separă TVA-ul și ce articole contabile SIMPLE rezultă. Funcție pură, fără ceas
// și fără I/O, ca `src/domain/payroll/contabil/nota.ts`.
//
// ── EXPORTUL PROPUNE, NU ÎNREGISTREAZĂ ──────────────────────────────────────
// Nu alocă număr de registru (L16) și nu scrie nimic în bază. Contabilul vede
// conturile înainte de descărcare și le poate schimba.
//
// ── DE CE ARTICOLE SIMPLE ───────────────────────────────────────────────────
// Saga refuză articolele compuse cu conturi de casă, bancă sau deconturi
// (manualul Saga C, „Articole contabile”), iar contul de decontare implicit e
// 542. Un cont pe debit și unul pe credit pe fiecare linie înseamnă și o notă
// echilibrată prin construcție (L2).
//
// ── TVA-UL, PE BANI ÎNTREGI (L8) ────────────────────────────────────────────
//   baza = round(total / (1 + cota)),  tva = total − baza
//   la `limitat_50`: tva_deductibil = floor(tva / 2), tva_nedeductibil = rest
// Pe întregi suma articolelor e EGALĂ cu totalul documentului, fără excepție
// (testul o verifică pe 10.000 de valori). `floor` pe partea deductibilă e
// varianta prudentă: un ban dedus în plus e o eroare fiscală, unul nededus nu.
// Partea nedeductibilă e mereu un articol separat, chiar pe același cont ca
// baza: indicele `Baza=` din WinMentor arată astfel spre o bază curată.
//
// ⚠ De confirmat de contabil (NOTES.md, F12): conturile, regimul implicit
// `limitat_50`, proxy-ul „bon fără CUI-ul stației ⇒ TVA nedeductibil”,
// tratamentul TVA-ului nedeductibil, cota pe rovinietă și pe peaj.
import type { DateString } from "@/lib/format/date";

import type { ConfigurareExport, FirmaExport } from "./configurare";
import { cotaTvaLa } from "./cote-tva";
import {
  comparaLinii,
  ETICHETE_CATEGORIE_CONTABILA,
  ETICHETE_DOCUMENT,
  type LinieCost,
  type RegimDeducere,
} from "./linii";
import { inAscii } from "./text-ascii";

/** Masa totală maximă autorizată peste care limitarea nu se aplică (Codul fiscal, art. 298 alin. 2). */
const PRAG_MASA_KG = 3500;

export type RolArticol = "baza" | "tva_deductibil" | "tva_nedeductibil" | "total";

export interface ArticolContabil {
  readonly linieId: string;
  readonly data: DateString;
  /** Numărul determinist al documentului (L14). */
  readonly numarDocument: string;
  readonly contDebit: string;
  readonly contCredit: string;
  /** Strict pozitiv: un articol de zero nu se scrie. */
  readonly sumaBani: number;
  /** În română, cu diacritice; transliterarea o face fiecare format. */
  readonly explicatie: string;
  readonly rol: RolArticol;
}

export type MotivExcludere =
  "suma_zero" | "service_spv" | "card_flota" | "foaie_neaprobata" | "foaie_stearsa";

export const ETICHETE_MOTIV: Readonly<Record<MotivExcludere, string>> = {
  suma_zero: "Sumă zero.",
  service_spv:
    "Factură de service: vine prin SPV, iar programul de contabilitate o importă singur. Bifați „include service” ca s-o puneți în note.",
  card_flota: "Plătit cu cardul de flotă: factura emitentului vine prin SPV.",
  foaie_neaprobata: "Foaie neaprobată: se mai poate corecta.",
  foaie_stearsa: "Foaia de parcurs a fost ștearsă.",
};

export interface LinieInclusa {
  readonly linie: LinieCost;
  readonly articole: readonly ArticolContabil[];
  /** `null` la firma neplătitoare de TVA: nu se separă nimic. */
  readonly regim: RegimDeducere | null;
  /** Regimul nu vine din F10, ci din masă sau din regimul implicit. */
  readonly regimDedus: boolean;
  readonly cotaProcent: number | null;
  readonly bazaBani: number;
  readonly tvaDeductibilBani: number;
  readonly tvaNedeductibilBani: number;
  readonly contDebit: string;
}

export interface LinieExclusa {
  readonly linie: LinieCost;
  readonly motiv: MotivExcludere;
}

export interface ProblemaExport {
  readonly cod: "cota_necunoscuta";
  readonly linie: LinieCost;
  readonly detalii: string;
}

export interface RezultatExport {
  readonly incluse: readonly LinieInclusa[];
  readonly excluse: readonly LinieExclusa[];
  /** Blocante: ruta nu emite fișierul cât timp există una. */
  readonly probleme: readonly ProblemaExport[];
  readonly avertismente: readonly string[];
  readonly totalDebitBani: number;
  readonly totalCreditBani: number;
}

/** Avertismentele care se spun în orice export (specificația F12g, §10 și D12). */
export const AVERTISMENTE_FIXE: readonly string[] = [
  "Bonurile din afara României nu se disting; verificați-le înainte de import.",
  "Dacă pentru un bon s-a cerut și factură, excludeți bonul: factura vine prin SPV, iar cheltuiala ar intra de două ori.",
  "Regimul de TVA (plătitor sau nu) e cel curent al firmei, nu cel de la data documentelor.",
];

/**
 * Baza din totalul cu TVA, rotunjită aritmetic, pe întregi:
 * `round(total × 100 / (100 + p))` = `floor((200·total + 100 + p) / (200 + 2p))`.
 */
export function bazaDinTotal(totalBani: number, procent: number): number {
  const numitor = 100 + procent;
  return Math.floor((2 * totalBani * 100 + numitor) / (2 * numitor));
}

/** Numărul documentului, determinist (L14): același export dă aceleași numere. */
export function numarDocument(linie: LinieCost): string {
  const curat = inAscii(linie.document ?? "");
  if (curat.length >= 1 && curat.length <= 16) return curat;
  return `FL${linie.id.slice(0, 8).toUpperCase()}`;
}

function motivExcludere(linie: LinieCost, c: ConfigurareExport): MotivExcludere | null {
  if (linie.totalBani === 0) return "suma_zero";
  if (linie.foaieStearsa) return "foaie_stearsa";
  if (linie.sursa === "service" && !c.includeService) return "service_spv";
  if (linie.peCardDeFlota) return "card_flota";
  if (c.doarAprobate && linie.stareFoaie !== null && linie.stareFoaie !== "aprobat") {
    return "foaie_neaprobata";
  }
  return null;
}

function explicatieBaza(linie: LinieCost, numar: string): string {
  const parti = [
    `${ETICHETE_CATEGORIE_CONTABILA[linie.categorie]} ${linie.vehicul.nr ?? "vehicul necunoscut"}`,
    `${ETICHETE_DOCUMENT[linie.sursa]} ${linie.document?.trim() || numar}`,
  ];
  if (linie.furnizor !== null && linie.furnizor.trim() !== "") parti.push(linie.furnizor.trim());
  return parti.join(", ");
}

function regimLinie(
  linie: LinieCost,
  c: ConfigurareExport,
): { regim: RegimDeducere; sursa: "f10" | "masa" | "implicit" } {
  if (linie.regimDeclarat !== null) return { regim: linie.regimDeclarat, sursa: "f10" };
  const masa = linie.vehicul.masaMaximaKg;
  if (masa !== null && masa > PRAG_MASA_KG) return { regim: "integral", sursa: "masa" };
  return { regim: c.regimImplicit, sursa: "implicit" };
}

export function construiesteArticole(
  linii: readonly LinieCost[],
  configurare: ConfigurareExport,
  firma: FirmaExport,
): RezultatExport {
  const incluse: LinieInclusa[] = [];
  const excluse: LinieExclusa[] = [];
  const probleme: ProblemaExport[] = [];
  const faraRegim = new Set<string>();
  let bonuriFaraCui = 0;
  let surseFaraCui = 0;

  for (const linie of [...linii].sort(comparaLinii)) {
    if (!Number.isInteger(linie.totalBani) || linie.totalBani < 0) {
      throw new RangeError(
        `Totalul liniei ${linie.id} trebuie să fie un număr întreg nenegativ de bani.`,
      );
    }
    const motiv = motivExcludere(linie, configurare);
    if (motiv !== null) {
      excluse.push({ linie, motiv });
      continue;
    }

    const numar = numarDocument(linie);
    const cont = configurare.conturi[linie.categorie];
    const credit = configurare.contDecontare;
    const articol = (rol: RolArticol, contDebit: string, suma: number, explicatie: string) =>
      ({
        linieId: linie.id,
        data: linie.data,
        numarDocument: numar,
        contDebit,
        contCredit: credit,
        sumaBani: suma,
        explicatie,
        rol,
      }) satisfies ArticolContabil;
    const explicatie = explicatieBaza(linie, numar);

    if (!firma.platitorTva) {
      incluse.push({
        linie,
        articole: [articol("total", cont, linie.totalBani, explicatie)],
        regim: null,
        regimDedus: false,
        cotaProcent: null,
        bazaBani: linie.totalBani,
        tvaDeductibilBani: 0,
        tvaNedeductibilBani: 0,
        contDebit: cont,
      });
      continue;
    }

    const cotaStandard = cotaTvaLa(linie.data);
    if (cotaStandard === null) {
      probleme.push({
        cod: "cota_necunoscuta",
        linie,
        detalii: `Documentul din ${linie.data} e dinaintea primei cote de TVA cunoscute (01.01.2017); cota nu se ghicește.`,
      });
      continue;
    }
    const procent = configurare.coeficientTva[linie.categorie] === "zero" ? 0 : cotaStandard;
    const baza = bazaDinTotal(linie.totalBani, procent);
    const tva = linie.totalBani - baza;

    const { regim, sursa } = regimLinie(linie, configurare);
    if (sursa === "implicit") faraRegim.add(linie.vehicul.nr ?? "vehicul necunoscut");

    const faraCui = linie.sursaAreCui && linie.cuiFurnizor === null;
    if (faraCui && tva > 0) bonuriFaraCui += 1;
    if (!linie.sursaAreCui && tva > 0) surseFaraCui += 1;
    const tvaDeductibil = faraCui ? 0 : regim === "integral" ? tva : Math.floor(tva / 2);
    const tvaNedeductibil = tva - tvaDeductibil;

    const articole: ArticolContabil[] = [];
    if (baza > 0) articole.push(articol("baza", cont, baza, explicatie));
    if (tvaDeductibil > 0) {
      articole.push(
        articol(
          "tva_deductibil",
          configurare.contTvaDeductibil,
          tvaDeductibil,
          `TVA deductibil, ${ETICHETE_DOCUMENT[linie.sursa]} ${numar}`,
        ),
      );
    }
    if (tvaNedeductibil > 0) {
      articole.push(
        articol(
          "tva_nedeductibil",
          configurare.tvaNedeductibila === "pe_cheltuiala"
            ? cont
            : configurare.contTvaNedeductibila,
          tvaNedeductibil,
          `TVA nedeductibil, ${ETICHETE_DOCUMENT[linie.sursa]} ${numar}`,
        ),
      );
    }

    const suma = articole.reduce((s, a) => s + a.sumaBani, 0);
    if (suma !== linie.totalBani) {
      throw new Error(
        `Articolele liniei ${linie.id} însumează ${String(suma)} bani, nu ${String(linie.totalBani)}.`,
      );
    }
    incluse.push({
      linie,
      articole,
      regim,
      regimDedus: sursa !== "f10",
      cotaProcent: procent,
      bazaBani: baza,
      tvaDeductibilBani: tvaDeductibil,
      tvaNedeductibilBani: tvaNedeductibil,
      contDebit: cont,
    });
  }

  const avertismente: string[] = [...AVERTISMENTE_FIXE];
  if (faraRegim.size > 0) {
    avertismente.push(
      `Vehiculele fără regim fiscal declarat primesc regimul implicit (${configurare.regimImplicit === "limitat_50" ? "deducere 50%" : "deducere integrală"}): ${[...faraRegim].sort().join(", ")}. Declarați regimul în Parc auto → Fiscal.`,
    );
  }
  if (bonuriFaraCui > 0) {
    avertismente.push(
      `${String(bonuriFaraCui)} ${bonuriFaraCui === 1 ? "bon" : "bonuri"} fără CUI-ul stației: TVA-ul e trecut nedeductibil, fiindcă bonul nu pare citit complet (CIF-ul firmei pe bon nu e dovedit). Decizia rămâne a contabilului.`,
    );
  }
  if (surseFaraCui > 0) {
    avertismente.push(
      "Cheltuielile și facturile de service nu au CUI-ul furnizorului în aplicație: TVA-ul lor se separă ca deductibil. Verificați documentele fără CIF-ul firmei.",
    );
  }
  if (configurare.includeService && incluse.some((i) => i.linie.sursa === "service")) {
    avertismente.push(
      "Facturile de service intră în note: dacă programul de contabilitate le-a importat deja din SPV, cheltuiala apare de două ori.",
    );
  }
  avertismente.push(...avertismenteNumere(incluse));

  const total = incluse.reduce((s, i) => s + i.articole.reduce((t, a) => t + a.sumaBani, 0), 0);
  return {
    incluse,
    excluse,
    probleme,
    avertismente,
    totalDebitBani: total,
    totalCreditBani: total,
  };
}

/**
 * Același număr de document în aceeași zi, pe mai multe linii incluse. La același
 * furnizor e probabil bonul introdus de două ori; la furnizori diferiți e un bon
 * real diferit, pe care sincronizarea „Nr.+data” din Saga îl poate lua drept
 * dublură (⚠ nedocumentat dacă ține cont de furnizor).
 */
function avertismenteNumere(incluse: readonly LinieInclusa[]): string[] {
  const grupuri = new Map<string, LinieCost[]>();
  for (const { linie } of incluse) {
    const numar = numarDocument(linie);
    const cheie = `${numar}|${linie.data}`;
    const grup = grupuri.get(cheie) ?? [];
    grup.push(linie);
    grupuri.set(cheie, grup);
  }
  const rezultat: string[] = [];
  for (const grup of grupuri.values()) {
    if (grup.length < 2) continue;
    const [prima] = grup;
    if (prima === undefined) continue;
    const furnizori = new Set(grup.map((l) => l.cuiFurnizor ?? l.furnizor ?? ""));
    const numar = numarDocument(prima);
    rezultat.push(
      furnizori.size > 1
        ? `Numărul „${numar}” din ${prima.data} apare la furnizori diferiți: Saga poate păstra doar unul la sincronizarea „Nr.+data”. Verificați-le la import.`
        : `Numărul „${numar}” din ${prima.data} apare de mai multe ori (bonul introdus pe două foi?). Verificați înainte de import.`,
    );
  }
  return rezultat;
}
