import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";
import {
  adresaDinFisier,
  curataText,
  SEMNATURA_FISIER,
  type DocumentTabelar,
} from "@/lib/unelte/document-tabelar";
import { pregatesteTiparXlsx } from "@/lib/unelte/tipar-xlsx";

import {
  CHEI_REZUMAT,
  COLOANA,
  coloaneAlimentari,
  ETICHETA_NORMA,
  eticheteRezumat,
  MAX_KM,
  RANDURI_ALIMENTARI,
  randuriCurse,
  TITLU_ALIMENTARI,
  TITLU_REZUMAT,
  unitatePentru,
  type CheieRezumat,
  type ParametriFoaieParcurs,
} from "./model";

/**
 * Foaia de parcurs în Excel, cu FORMULE.
 *
 * ── DE CE NU RANDAREA COMUNĂ ──────────────────────────────────────────────
 * `randeazaXlsx` scrie text: auditul din 8 oct 2026 a numărat zero formule în
 * fișier, iar „Total km parcurși: ________” se aduna de mână. Cine alege Excel
 * îl alege tocmai pentru calcul. Aici:
 * - km parcurși = km la sosire − km la plecare, pe fiecare cursă;
 * - consumul după normă = km parcurși × normă ÷ 100, cu norma dintr-o SINGURĂ
 *   celulă a antetului (schimbată acolo, se recalculează toată foaia);
 * - totalurile lunii, alimentările, stocul după normă și diferența față de
 *   stocul constatat la bord — cifra care arată dacă norma ține.
 *
 * Etichetele, coloanele și ordinea vin din `model.ts`, aceleași ca în PDF, Word
 * și previzualizare; aici se adaugă doar formulele, formatele și validările.
 *
 * Celulele cu formulă sunt gri: „nu scrie aici”. Fișierul nu e protejat cu
 * parolă — o foaie pe care contabilul n-o poate corecta e mai rea decât una
 * pe care o poate strica.
 */

const GRI_FORMULA = "FFF2F4F2";
const GRI_WEEKEND = "FFE6E9E6";
const CHENAR: Partial<ExcelJS.Borders> = {
  top: { style: "hair" },
  left: { style: "hair" },
  bottom: { style: "hair" },
  right: { style: "hair" },
};

/** Lățimile în „caractere” ale ExcelJS, alese ca foaia să încapă pe A4 lat. */
const LATIMI = [11, 5, 7, 7, 30, 24, 10, 10, 9, 9, 13] as const;

export async function randeazaFoaieParcursXlsx(
  p: ParametriFoaieParcurs,
  d: DocumentTabelar,
): Promise<Uint8Array> {
  const t = curataText;
  const u = unitatePentru(p.combustibil);
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = t(d.titlu);
  // Formulele se recalculează la deschidere: ExcelJS nu le evaluează, deci
  // fișierul nu poartă valori calculate în cache.
  registru.calcProperties.fullCalcOnLoad = true;
  const fila = registru.addWorksheet("Foaie de parcurs");
  fila.columns = LATIMI.map((width) => ({ width }));
  const litera = (indice: number) => fila.getColumn(indice + 1).letter;
  const gri = (celula: ExcelJS.Cell) => {
    celula.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: GRI_FORMULA },
    };
  };

  const titlu = fila.addRow([t(d.titlu)]);
  titlu.font = { bold: true, size: 13 };

  // Antetul: eticheta pe A:D, valoarea pe E:K. Norma e NUMĂR, nu text: toate
  // formulele de consum citesc celula ei.
  let celulaNorma = "";
  for (const c of d.campuri) {
    const rand = fila.addRow([`${t(c.eticheta)}:`]);
    fila.mergeCells(rand.number, 1, rand.number, 4);
    fila.mergeCells(rand.number, 5, rand.number, 11);
    const valoare = rand.getCell(5);
    if (c.eticheta === ETICHETA_NORMA) {
      rand.getCell(1).value = `${ETICHETA_NORMA} (${u}/100 km):`;
      valoare.value = p.norma;
      valoare.numFmt = "0.0##";
      valoare.alignment = { horizontal: "left" };
      celulaNorma = `$E$${String(rand.number)}`;
    } else {
      valoare.value = t(c.valoare);
    }
    valoare.border = { bottom: { style: "hair" } };
  }
  if (celulaNorma === "") {
    // Fără celula normei, fiecare formulă de consum ar trimite la nimic.
    throw new Error("Foaia de parcurs n-are rubrica normei de consum.");
  }
  fila.addRow([]);

  // ── Cursele ──────────────────────────────────────────────────────────────
  const antet = fila.addRow(d.coloane.map((c) => t(c.eticheta)));
  antet.font = { bold: true };
  antet.alignment = { wrapText: true, vertical: "top" };
  antet.eachCell((celula) => {
    celula.border = CHENAR;
  });
  // Antetul tabelului se repetă pe fiecare pagină TIPĂRITĂ. Nu se îngheață pe
  // ecran: cu cele 13 rânduri ale antetului de document deasupra, ar fi rămas
  // fixă jumătate din fereastră. A4 culcat, subsolul numerotat: tiparul comun
  // al fișierelor Excel ale uneltelor, același ca la foaia de pontaj și condică.
  pregatesteTiparXlsx(fila, {
    orientare: "peisaj",
    randuriTitlu: { de: antet.number, pana: antet.number },
  });

  const L = {
    kmPlecare: litera(COLOANA.kmPlecare),
    kmSosire: litera(COLOANA.kmSosire),
    km: litera(COLOANA.km),
    consum: litera(COLOANA.consum),
  };
  const curse = randuriCurse(p);
  const primaCursa = antet.number + 1;
  curse.forEach((c, i) => {
    const rand = fila.addRow([]);
    const r = String(rand.number);
    rand.getCell(COLOANA.data + 1).value = new Date(Date.UTC(p.an, p.luna - 1, c.zi));
    rand.getCell(COLOANA.data + 1).numFmt = "dd.mm.yyyy";
    rand.getCell(COLOANA.ziua + 1).value = c.ziua;
    const plecare = rand.getCell(COLOANA.kmPlecare + 1);
    const sosire = rand.getCell(COLOANA.kmSosire + 1);
    if (i === 0 && p.kmInitial !== null) plecare.value = p.kmInitial;
    for (const celula of [plecare, sosire]) celula.numFmt = "#,##0";
    // Kilometrajul de bord crește: un „125.000” scris „12.500” la sosire e
    // refuzat pe loc, nu descoperit la sfârșitul lunii.
    plecare.dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [0, MAX_KM],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Kilometraj",
      error: "Kilometrajul de bord se scrie în km întregi.",
    };
    sosire.dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [`${L.kmPlecare}${r}`],
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Kilometraj",
      error: "Km la sosire nu pot fi mai puțini decât km la plecare.",
    };
    const km = rand.getCell(COLOANA.km + 1);
    km.value = {
      formula: `IF(AND(ISNUMBER(${L.kmPlecare}${r}),ISNUMBER(${L.kmSosire}${r})),${L.kmSosire}${r}-${L.kmPlecare}${r},"")`,
    };
    km.numFmt = "#,##0";
    const consum = rand.getCell(COLOANA.consum + 1);
    consum.value = {
      formula: `IF(AND(ISNUMBER(${L.km}${r}),ISNUMBER(${celulaNorma})),ROUND(${L.km}${r}*${celulaNorma}/100,2),"")`,
    };
    consum.numFmt = "0.00";
    d.coloane.forEach((_, j) => {
      const celula = rand.getCell(j + 1);
      celula.border = CHENAR;
      if (c.weekend) {
        celula.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: GRI_WEEKEND },
        };
      }
    });
    gri(km);
    gri(consum);
  });
  const ultimaCursa = fila.rowCount;

  const total = fila.addRow(["Total lună"]);
  total.font = { bold: true };
  const intervalKm = `${L.km}${String(primaCursa)}:${L.km}${String(ultimaCursa)}`;
  const intervalConsum = `${L.consum}${String(primaCursa)}:${L.consum}${String(ultimaCursa)}`;
  const intervalSosire = `${L.kmSosire}${String(primaCursa)}:${L.kmSosire}${String(ultimaCursa)}`;
  total.getCell(COLOANA.km + 1).value = { formula: `SUM(${intervalKm})` };
  total.getCell(COLOANA.km + 1).numFmt = "#,##0";
  total.getCell(COLOANA.consum + 1).value = {
    formula: `IF(ISNUMBER(${celulaNorma}),SUM(${intervalConsum}),"")`,
  };
  total.getCell(COLOANA.consum + 1).numFmt = "0.00";
  gri(total.getCell(COLOANA.km + 1));
  gri(total.getCell(COLOANA.consum + 1));
  const totalKm = `${L.km}${String(total.number)}`;
  const totalConsum = `${L.consum}${String(total.number)}`;

  // ── Alimentările: Data | Nr. bon (B:D) | Stația (E) | Cantitate (F) | Valoare (G:H) | Semnătura (I:K)
  fila.addRow([]);
  fila.addRow([TITLU_ALIMENTARI]).font = { bold: true };
  const ca = coloaneAlimentari(u).map((c) => t(c.eticheta));
  const pozitii: readonly (readonly [number, number])[] = [
    [1, 1],
    [2, 4],
    [5, 5],
    [6, 6],
    [7, 8],
    [9, 11],
  ];
  const randAlimentare = (valori: readonly string[]) => {
    const rand = fila.addRow([]);
    pozitii.forEach(([de, pana], k) => {
      if (pana > de) fila.mergeCells(rand.number, de, rand.number, pana);
      rand.getCell(de).value = valori[k] ?? null;
      for (let j = de; j <= pana; j += 1) rand.getCell(j).border = CHENAR;
    });
    return rand;
  };
  const antetAlimentari = randAlimentare(ca);
  antetAlimentari.font = { bold: true };
  antetAlimentari.alignment = { wrapText: true, vertical: "top" };
  const primaAlimentare = antetAlimentari.number + 1;
  for (let i = 0; i < RANDURI_ALIMENTARI; i += 1) {
    const rand = randAlimentare([]);
    rand.getCell(1).numFmt = "dd.mm.yyyy";
    rand.getCell(6).numFmt = "0.00";
    rand.getCell(7).numFmt = "#,##0.00";
  }
  const ultimaAlimentare = fila.rowCount;
  const totalAlimentari = randAlimentare(["Total"]);
  totalAlimentari.font = { bold: true };
  totalAlimentari.getCell(6).value = {
    formula: `SUM(F${String(primaAlimentare)}:F${String(ultimaAlimentare)})`,
  };
  totalAlimentari.getCell(6).numFmt = "0.00";
  totalAlimentari.getCell(7).value = {
    formula: `SUM(G${String(primaAlimentare)}:G${String(ultimaAlimentare)})`,
  };
  totalAlimentari.getCell(7).numFmt = "#,##0.00";
  gri(totalAlimentari.getCell(6));
  gri(totalAlimentari.getCell(7));
  const alimentat = `F${String(totalAlimentari.number)}`;
  const valoareAlimentari = `G${String(totalAlimentari.number)}`;

  // ── Rezumatul: eticheta pe A:D, valoarea în E ────────────────────────────
  fila.addRow([]);
  fila.addRow([TITLU_REZUMAT]).font = { bold: true };
  const etichete = eticheteRezumat(u);
  const primulRezumat = fila.rowCount + 1;
  const adresa = (k: CheieRezumat) => `E${String(primulRezumat + CHEI_REZUMAT.indexOf(k))}`;
  const formule: Readonly<Record<CheieRezumat, ExcelJS.CellValue>> = {
    kmInceput: p.kmInitial,
    kmSfarsit: {
      formula: `IF(COUNT(${intervalSosire})=0,"",MAX(${intervalSosire}))`,
    },
    kmTotal: { formula: totalKm },
    norma: { formula: `IF(ISNUMBER(${celulaNorma}),${celulaNorma},"")` },
    consumNormat: { formula: totalConsum },
    stocInceput: p.stocInitial,
    alimentat: { formula: alimentat },
    stocCalculat: {
      formula: `IF(AND(ISNUMBER(${adresa("stocInceput")}),ISNUMBER(${adresa("consumNormat")})),ROUND(${adresa("stocInceput")}+${adresa("alimentat")}-${adresa("consumNormat")},2),"")`,
    },
    stocConstatat: null,
    diferenta: {
      formula: `IF(AND(ISNUMBER(${adresa("stocConstatat")}),ISNUMBER(${adresa("stocCalculat")})),ROUND(${adresa("stocConstatat")}-${adresa("stocCalculat")},2),"")`,
    },
    valoare: { formula: valoareAlimentari },
  };
  const deCompletat: ReadonlySet<CheieRezumat> = new Set([
    "kmInceput",
    "stocInceput",
    "stocConstatat",
  ]);
  for (const k of CHEI_REZUMAT) {
    const rand = fila.addRow([t(etichete[k])]);
    fila.mergeCells(rand.number, 1, rand.number, 4);
    const celula = rand.getCell(5);
    celula.value = formule[k];
    celula.numFmt = k === "kmInceput" || k === "kmSfarsit" || k === "kmTotal" ? "#,##0" : "0.00";
    for (let j = 1; j <= 5; j += 1) rand.getCell(j).border = CHENAR;
    if (!deCompletat.has(k)) gri(celula);
  }

  fila.addRow([]);
  for (const n of d.note) {
    const rand = fila.addRow([t(n)]);
    fila.mergeCells(rand.number, 1, rand.number, 11);
    rand.getCell(1).alignment = { wrapText: true, vertical: "top" };
    rand.height = 28;
  }
  fila.addRow([]);
  const semnaturi = fila.addRow([]);
  d.semnaturi.forEach((s, i) => {
    semnaturi.getCell(i === 0 ? 1 : 7).value = `${t(s)}: ______________`;
  });
  const legatura = fila.addRow([
    {
      text: SEMNATURA_FISIER,
      hyperlink: adresaDinFisier(d, "xlsx", ADRESA_SITE),
    },
  ]);
  legatura.getCell(1).font = { color: { argb: "FF6B7280" }, underline: true };

  return new Uint8Array(await registru.xlsx.writeBuffer());
}
