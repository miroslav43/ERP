import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";
import {
  adresaDinFisier,
  SEMNATURA_FISIER,
  type DocumentTabelar,
} from "@/lib/unelte/document-tabelar";

import { SCALA_NOTE } from "./calcul";
import {
  NOTA_LEGALA,
  rezultatFisa,
  TEXT_FORMULA,
  TEXT_SCALA,
  type ParametriFisaEvaluare,
} from "./model";

/**
 * Excelul fișei de evaluare, cu FORMULE.
 *
 * ── DE CE NU REFOLOSEȘTE `randeazaXlsx` ───────────────────────────────────
 * Randarea comună scrie celule de text: pentru o foaie de completat de mână e
 * destul. Auditul din 8 oct 2026 a găsit însă la fișa de evaluare un Excel cu
 * ZERO formule (`grep '<f>'` = 0), „100” salvat ca text și nimic care să
 * spună că ponderile nu fac 100 — adică un tabel Word în alt format. Excelul e
 * locul unde fișa poate face ce nu face hârtia: punctajul pe criteriu, nota
 * finală și calificativul se calculează pe loc, iar o pondere greșită se vede
 * cu roșu. Același lucru face deja foaia de pontaj (`api/unelte/foaie-de-pontaj`).
 *
 * ── TEXTUL DIN DOCUMENT, CIFRELE DIN PARAMETRI ────────────────────────────
 * Textele scrise de om (antetul, criteriile, rubricile) vin din documentul
 * `d`, care a trecut deja prin `curataDocument` în `raspunsDocument`. Cifrele
 * (ponderi, note, praguri) vin din `p`, unde sunt deja numere validate.
 *
 * ── FORMULELE ȘI VALORILE LOR ─────────────────────────────────────────────
 * Fiecare formulă poartă și rezultatul calculat aici, cu aceeași funcție ca
 * PDF-ul: o previzualizare care nu recalculează (telefonul, e-mailul) arată
 * cifra corectă, iar Excel recalculează oricum la deschidere (`fullCalcOnLoad`).
 * `COUNTA` pe coloana criteriilor, nu numărul de rânduri scris în formulă: un
 * rând inserat în interiorul tabelului intră singur în calcul.
 */

const COLOANE = [
  { latime: 46 },
  { latime: 11 },
  { latime: 11 },
  { latime: 11 },
  { latime: 34 },
] as const;

const ROSU_FUNDAL = "FFF6D5D5";
const ROSU_TEXT = "FF9B1C1C";
const GRI_TEXT = "FF6B7280";
const ANTET_FUNDAL = "FFEFF1EE";

const chenar: Partial<ExcelJS.Borders> = {
  top: { style: "hair" },
  left: { style: "hair" },
  bottom: { style: "hair" },
  right: { style: "hair" },
};

/**
 * `Worksheet.dataValidations` există la rulare (`lib/doc/worksheet.js`), dar
 * lipsește din tipurile exceljs 4.4.0.
 */
type FilaCuValidari = ExcelJS.Worksheet & {
  dataValidations: { add(adresa: string, validare: ExcelJS.DataValidation): void };
};

/** Câte rânduri de ~44 de caractere ocupă textul în coloana criteriului. */
const randuriText = (text: string) => Math.max(1, Math.ceil(text.length / 44));

export async function randeazaXlsxEvaluare(
  d: DocumentTabelar,
  p: ParametriFisaEvaluare,
): Promise<Uint8Array> {
  const r = rezultatFisa(p);
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = d.titlu;
  registru.calcProperties.fullCalcOnLoad = true;
  const fila = registru.addWorksheet("Evaluare", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  fila.columns = COLOANE.map((c) => ({ width: c.latime }));

  /** Un rând de text pe toată lățimea, rupt pe rânduri. */
  const randLat = (text: string, optiuni: Partial<ExcelJS.Font> = {}) => {
    const rand = fila.addRow([text]);
    fila.mergeCells(rand.number, 1, rand.number, COLOANE.length);
    rand.getCell(1).alignment = { wrapText: true, vertical: "top" };
    rand.getCell(1).font = optiuni;
    rand.height = Math.max(15, Math.ceil(text.length / 110) * 15);
    return rand;
  };

  fila.addRow([d.titlu]).font = { bold: true, size: 13 };
  if (d.subtitlu !== null) fila.addRow([d.subtitlu]);
  for (const c of d.campuri) {
    const rand = fila.addRow([`${c.eticheta}:`, c.valoare === "" ? null : c.valoare]);
    fila.mergeCells(rand.number, 2, rand.number, COLOANE.length);
  }
  fila.addRow([]);

  const antet = fila.addRow(d.coloane.map((c) => c.eticheta));
  antet.font = { bold: true };
  antet.alignment = { wrapText: true, vertical: "middle" };
  antet.eachCell((celula) => {
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ANTET_FUNDAL } };
    celula.border = chenar;
  });
  fila.views = [{ state: "frozen", ySplit: antet.number }];

  const prim = antet.number + 1;
  const ultim = prim + p.grila.length - 1;
  p.grila.forEach((rand, i) => {
    const nr = prim + i;
    // Textul criteriului din document (curățat), cifrele din parametri (validate).
    const criteriu = d.randuri[i]?.[0] ?? rand.criteriu;
    const punctaj = r.punctaje[i] ?? null;
    const randFila = fila.addRow([
      criteriu,
      rand.pondere,
      rand.nota,
      {
        formula: `IF(AND(ISNUMBER(B${String(nr)}),ISNUMBER(C${String(nr)})),B${String(nr)}*C${String(nr)}/100,"")`,
        result: punctaj === null ? "" : punctaj / 100,
      },
      null,
    ]);
    randFila.height = Math.max(26, randuriText(criteriu) * 15);
    randFila.eachCell({ includeEmpty: true }, (celula, coloana) => {
      if (coloana > COLOANE.length) return;
      celula.border = chenar;
      celula.alignment = { wrapText: true, vertical: "top" };
    });
    randFila.getCell(4).numFmt = "0.00";
  });

  // Validările se pun pe INTERVAL, nu pe fiecare celulă: exceljs 4.4.0 sortează
  // adresele ca text („B10” < „B9”) când le strânge în intervale și scrie, de la
  // zece rânduri în sus, două intervale suprapuse (B10:B14 și B9:B14) — o
  // validare pe care Excel n-o poate crea din interfață. Cheia de interval
  // trece neschimbată (`optimiseDataValidations`, ramura `addr.dimensions`).
  const validari = (fila as FilaCuValidari).dataValidations;
  validari.add(`B${String(prim)}:B${String(ultim)}`, {
    type: "whole",
    operator: "between",
    allowBlank: true,
    formulae: [1, 100],
    showErrorMessage: true,
    errorTitle: "Pondere în afara intervalului",
    error: "Ponderea este un număr întreg de la 1 la 100.",
  });
  validari.add(`C${String(prim)}:C${String(ultim)}`, {
    type: "list",
    allowBlank: true,
    formulae: ['"1,2,3,4,5"'],
    showErrorMessage: true,
    errorTitle: "Notă în afara scalei",
    error: "Nota este un număr întreg de la 1 la 5.",
    showInputMessage: true,
    promptTitle: "Nota",
    prompt: SCALA_NOTE.map((x) => `${String(x.nota)} — ${x.descriere}`).join("; "),
  });

  const B = `B${String(prim)}:B${String(ultim)}`;
  const C = `C${String(prim)}:C${String(ultim)}`;
  const A = `A${String(prim)}:A${String(ultim)}`;
  const totalRand = fila.addRow([
    "Total",
    { formula: `SUM(${B})`, result: r.sumaPonderi },
    null,
    {
      formula: `IF(AND(B${String(ultim + 1)}=100,COUNT(${B})=COUNTA(${A}),COUNT(${C})=COUNTA(${A})),SUMPRODUCT(${B},${C})/100,"")`,
      result: r.notaFinala === null ? "" : r.notaFinala / 100,
    },
    {
      formula: `IF(B${String(ultim + 1)}=100,"","Ponderile trebuie să însumeze 100%.")`,
      result: r.sumaPonderi === 100 ? "" : "Ponderile trebuie să însumeze 100%.",
    },
  ]);
  const t = totalRand.number;
  totalRand.font = { bold: true };
  totalRand.eachCell({ includeEmpty: true }, (celula, coloana) => {
    if (coloana <= COLOANE.length) celula.border = chenar;
  });
  totalRand.getCell(4).numFmt = "0.00";
  totalRand.getCell(5).font = { bold: true, color: { argb: ROSU_TEXT } };
  // Roșu cât timp ponderile nu fac 100: se vede fără să citești formula.
  fila.addConditionalFormatting({
    ref: `B${String(t)}`,
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [`$B$${String(t)}<>100`],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: ROSU_FUNDAL } },
          font: { color: { argb: ROSU_TEXT }, bold: true },
        },
      },
    ],
  });

  fila.addRow([]);
  const notaRand = fila.addRow([
    "Nota finală",
    { formula: `D${String(t)}`, result: r.notaFinala === null ? "" : r.notaFinala / 100 },
  ]);
  notaRand.font = { bold: true };
  notaRand.getCell(2).numFmt = "0.00";
  const califRand = fila.addRow(["Calificativ"]);
  califRand.font = { bold: true };
  fila.addRow([]);
  // Pragurile stau în foaie, în celule: le schimbi, calificativul se schimbă.
  fila.addRow(["Pragurile calificativelor (se pot schimba)"]).font = { bold: true };
  const randPrag = (eticheta: string, sutimi: number) => {
    const rand = fila.addRow([eticheta, sutimi / 100]);
    rand.getCell(2).numFmt = "0.00";
    rand.getCell(2).border = chenar;
    return `B${String(rand.number)}`;
  };
  const fb = randPrag("Foarte bine, de la", p.praguri.foarteBine);
  const b = randPrag("Bine, de la", p.praguri.bine);
  const s = randPrag("Satisfăcător, de la", p.praguri.satisfacator);
  fila.addRow(["Sub pragul pentru Satisfăcător: Nesatisfăcător."]);
  const nf = `B${String(notaRand.number)}`;
  califRand.getCell(2).value = {
    formula: `IF(${nf}="","",IF(${nf}>=${fb},"Foarte bine",IF(${nf}>=${b},"Bine",IF(${nf}>=${s},"Satisfăcător","Nesatisfăcător"))))`,
    result: r.calificativ ?? "",
  };

  fila.addRow([]);
  randLat(TEXT_SCALA, { color: { argb: GRI_TEXT } });
  randLat(TEXT_FORMULA, { color: { argb: GRI_TEXT } });
  randLat(NOTA_LEGALA, { color: { argb: GRI_TEXT } });
  randLat(
    "Un criteriu nou: inserează un rând în interiorul tabelului, iar formulele de total îl cuprind singure.",
    { color: { argb: GRI_TEXT }, italic: true },
  );

  for (const rubrica of d.rubrici ?? []) {
    fila.addRow([]);
    fila.addRow([rubrica.titlu]).font = { bold: true };
    const paragrafe = rubrica.text.split("\n").filter((x) => x.trim() !== "");
    for (const x of paragrafe) randLat(x);
    const goale = paragrafe.length > 0 ? 1 : rubrica.randuriGoale;
    for (let k = 0; k < goale; k += 1) {
      const rand = fila.addRow([]);
      rand.height = 20;
      for (let c = 1; c <= COLOANE.length; c += 1)
        rand.getCell(c).border = { bottom: { style: "hair" } };
    }
  }

  fila.addRow([]);
  // Trei semnături pe coloanele A, B–D și E, cu numele, semnătura și data.
  const pozitii = [1, 2, 5] as const;
  const randuriSemnatura = [
    d.semnaturi,
    d.semnaturi.map(() => "Semnătura: ______________"),
    d.semnaturi.map(() => "Data: ______________"),
  ];
  for (const valori of randuriSemnatura) {
    const rand = fila.addRow([]);
    valori.forEach((v, i) => {
      const coloana = pozitii[i];
      if (coloana !== undefined) rand.getCell(coloana).value = v;
    });
    fila.mergeCells(rand.number, 2, rand.number, 4);
    rand.height = 22;
  }

  fila.addRow([]);
  const semnatura = fila.addRow([
    { text: SEMNATURA_FISIER, hyperlink: adresaDinFisier(d, "xlsx", ADRESA_SITE) },
  ]);
  semnatura.getCell(1).font = { color: { argb: GRI_TEXT }, underline: true };

  return new Uint8Array(await registru.xlsx.writeBuffer());
}
