import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";
import { randAntetFirma } from "@/lib/unelte/antet-firma";
import { CODURI_ABSENTA, LISTA_CODURI } from "@/lib/unelte/coduri-pontaj";
import { adresaDinFisier, SEMNATURA_FISIER } from "@/lib/unelte/document-tabelar";
import {
  pregatesteTiparXlsx,
  validareCoduri,
  VALIDARE_ORA,
  VALIDARE_PAUZA,
} from "@/lib/unelte/tipar-xlsx";

import { LUNI } from "../foaie-de-pontaj/foaie";
import { condicaDocument, randuriCondica, type ParametriCondica } from "./model";

/**
 * Condica în Excel, cu orele calculate.
 *
 * Auditul din 8 oct 2026: 0 formule, date ca text, fără rânduri de titlu
 * repetate. Acum: data e dată, ora sosirii și a plecării sunt ore (validate:
 * „8” fără două puncte e oprit), orele lucrate = plecare − sosire − pauză,
 * corect și peste miezul nopții, iar a doua filă adună pe om orele și zilele pe
 * coduri — exact ce trebuia recopiat de mână pentru salarii.
 */

const FILA = "Condica";
const RAND_CAP = 5;
const PRIMUL = 6;
const COLOANE = 9;
const CHENAR: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF9CA3AF" } },
  left: { style: "thin", color: { argb: "FF9CA3AF" } },
  bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
  right: { style: "thin", color: { argb: "FF9CA3AF" } },
};

export async function registruCondica(p: ParametriCondica): Promise<Uint8Array> {
  const d = condicaDocument(p);
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = d.titlu;
  const fila = registru.addWorksheet(FILA);
  fila.columns = [
    { width: 12 },
    { width: 30 },
    { width: 9 },
    { width: 16 },
    { width: 9 },
    { width: 16 },
    { width: 8 },
    { width: 9 },
    { width: 14 },
  ];

  fila.addRow([d.titlu]).font = { bold: true, size: 13 };
  fila.addRow([randAntetFirma(p.antet) ?? ""]);
  fila.addRow([
    "Orele se scriu cu două puncte (8:00). Ore lucrate = plecarea − sosirea − pauza; tura de peste miezul nopții se socotește corect.",
  ]).font = { size: 9, color: { argb: "FF6B7280" } };
  fila.addRow([]);
  const cap = fila.addRow(d.coloane.map((c) => c.eticheta.replace("\n", " ")));
  cap.font = { bold: true, size: 9 };
  cap.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let c = 1; c <= COLOANE; c += 1) cap.getCell(c).border = CHENAR;

  const randuri = randuriCondica(p);
  randuri.forEach((r, i) => {
    const n = PRIMUL + i;
    const data = new Date(Date.UTC(p.an, p.luna - 1, r.zi));
    if (r.fel === "marcaj") {
      const rand = fila.addRow([data, r.eticheta, null, null, null, null, null, null, r.cod]);
      rand.font = { italic: true, color: { argb: "FF6B7280" } };
      for (let c = 1; c <= COLOANE; c += 1) {
        rand.getCell(c).border = CHENAR;
        rand.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E9E6" } };
      }
      rand.getCell(1).numFmt = "dd.mm.yyyy";
      return;
    }
    const rand = fila.addRow([data, r.nume]);
    rand.height = 22;
    rand.getCell(1).numFmt = "dd.mm.yyyy";
    for (const c of [3, 5]) {
      rand.getCell(c).numFmt = "hh:mm";
      rand.getCell(c).dataValidation = VALIDARE_ORA;
    }
    rand.getCell(7).dataValidation = VALIDARE_PAUZA;
    rand.getCell(8).value = {
      formula: `IF(AND(ISNUMBER(C${String(n)}),ISNUMBER(E${String(n)})),MAX(0,MOD(E${String(n)}-C${String(n)},1)-N(G${String(n)})/1440),"")`,
    };
    rand.getCell(8).numFmt = "[h]:mm";
    // Observațiile primesc și text liber („delegație Cluj”): lista fără alertă.
    rand.getCell(9).dataValidation = validareCoduri(LISTA_CODURI, false);
    for (let c = 1; c <= COLOANE; c += 1) rand.getCell(c).border = CHENAR;
  });
  const ultim = PRIMUL + randuri.length - 1;

  fila.addRow([]);
  for (const nota of d.note) fila.addRow([nota]).font = { size: 9, color: { argb: "FF6B7280" } };
  fila.addRow(["Verificat (conducătorul locului de muncă): ______________"]);
  const legatura = fila.addRow([
    {
      text: SEMNATURA_FISIER,
      hyperlink: adresaDinFisier(
        { ...d, sursa: "/unelte/condica-de-prezenta" },
        "xlsx",
        ADRESA_SITE,
      ),
    },
  ]);
  legatura.getCell(1).font = { color: { argb: "FF6B7280" }, underline: true };

  fila.views = [{ state: "frozen", ySplit: RAND_CAP }];
  pregatesteTiparXlsx(fila, {
    orientare: "portret",
    randuriTitlu: { de: RAND_CAP, pana: RAND_CAP },
  });

  const oameni = [...new Set(p.angajati.filter((a) => a !== ""))];
  if (oameni.length > 0) filaTotal(registru, p, oameni, ultim);

  return new Uint8Array(await registru.xlsx.writeBuffer());
}

/** Pe om: zilele cu ore, orele lucrate și zilele pe fiecare cod de absență. */
function filaTotal(
  registru: ExcelJS.Workbook,
  p: ParametriCondica,
  oameni: readonly string[],
  ultim: number,
): void {
  const fila = registru.addWorksheet("Total pe angajat");
  fila.columns = [
    { width: 30 },
    { width: 11 },
    { width: 11 },
    ...CODURI_ABSENTA.map(() => ({ width: 6 })),
  ];
  fila.addRow([`Total pe angajat — ${LUNI[p.luna - 1] ?? ""} ${String(p.an)}`]).font = {
    bold: true,
    size: 13,
  };
  fila.addRow(["Angajat", "Zile cu ore", "Ore lucrate", ...CODURI_ABSENTA.map((c) => c.cod)]).font =
    {
      bold: true,
    };
  const coloana = (litera: string) =>
    `${FILA}!$${litera}$${String(PRIMUL)}:$${litera}$${String(ultim)}`;
  const [nume, ore, observatii] = [coloana("B"), coloana("H"), coloana("I")];
  oameni.forEach((om, k) => {
    const r = 3 + k;
    const rand = fila.addRow([
      om,
      { formula: `COUNTIFS(${nume},A${String(r)},${ore},">0")` },
      { formula: `SUMIF(${nume},A${String(r)},${ore})` },
      ...CODURI_ABSENTA.map((c) => ({
        formula: `COUNTIFS(${nume},A${String(r)},${observatii},"${c.cod}")`,
      })),
    ]);
    rand.getCell(3).numFmt = "[h]:mm";
  });
  pregatesteTiparXlsx(fila, { orientare: "portret", randuriTitlu: { de: 2, pana: 2 } });
}
