import ExcelJS from "exceljs";

import { ADRESA_SITE } from "@/content/landing/contact";
import { amendaEvidenta, textAmenda } from "@/content/landing/intrebari-pontaj";
import { cuDe } from "@/content/legal/zile-libere";
import { randAntetFirma } from "@/lib/unelte/antet-firma";
import { CODURI_ABSENTA, LISTA_CODURI, TEXT_LEGENDA } from "@/lib/unelte/coduri-pontaj";
import { adresaDinFisier, SEMNATURA_FISIER } from "@/lib/unelte/document-tabelar";
import {
  numeFilaSigur,
  pregatesteTiparXlsx,
  validareCoduri,
  VALIDARE_DURATA,
  VALIDARE_ORA,
  VALIDARE_PAUZA,
} from "@/lib/unelte/tipar-xlsx";

import { oreFoaie } from "./foaie";
import {
  documenteleFoii,
  notaSarbatori,
  NOTA_COLECTIVA_119,
  NOTA_FISA_119,
} from "./foaie-document";
import {
  angajatiPentruFise,
  etichetaProgram,
  normaLunara,
  oreScurt,
  rezumatNorma,
  type AngajatPontaj,
  type Pontaj,
} from "./pontaj";

/**
 * Foaia de pontaj în Excel, cu FORMULE — nu prin `randeazaXlsx`, care nu știe de
 * formule (vezi `src/lib/unelte/xlsx.ts`).
 *
 * ── CE CALCULEAZĂ ──────────────────────────────────────────────────────────
 * Foaia colectivă: norma fiecăruia (h/zi × zilele lucrătoare), orele lucrate,
 * câte zile de CO, CM, CFS, AN și D are fiecare (`COUNTIF`), totalurile pe zi și
 * colțul care le închide. Fișa individuală: orele lucrate din ora de început, cea
 * de sfârșit și pauză, ca durată (`[h]:mm`, regula ceasului din
 * `src/lib/format/ore.ts`), corect și pentru tura de peste miezul nopții
 * (`MOD(sfârșit − început, 1)`); apoi zilele lucrate, diferența față de normă și
 * absențele pe coduri.
 *
 * Auditul din 8 oct 2026: condica avea 0 formule; easyhours.ro dă gratuit
 * exact asta — `ROUND(MOD(E-C,1)*24-pauză/60)` — dar fără sărbători și fără
 * nume. Aici sunt amândouă.
 */

const SURSA = "/unelte/foaie-de-pontaj";
const UMPLERE_SARBATOARE = "FFF0E6D2";
const UMPLERE_REPAUS = "FFE6E9E6";
const UMPLERE_ALERTA = "FFFDE2E1";
/** Subțire, gri închis: chenarul „hair” de până acum dispărea la tipărire. */
const CHENAR: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF9CA3AF" } },
  left: { style: "thin", color: { argb: "FF9CA3AF" } },
  bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
  right: { style: "thin", color: { argb: "FF9CA3AF" } },
};
const GRI_TEXT = { color: { argb: "FF6B7280" } } as const;

function umple(celula: ExcelJS.Cell, argb: string): void {
  celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function legatura(fila: ExcelJS.Worksheet, adresa: string): void {
  const rand = fila.addRow([{ text: SEMNATURA_FISIER, hyperlink: adresa }]);
  rand.getCell(1).font = { ...GRI_TEXT, underline: true };
}

// ── Foaia colectivă ────────────────────────────────────────────────────────

const RAND_CAP = 5;
const RAND_LITERE = 6;
const PRIMUL_RAND = 7;

function filaColectiva(registru: ExcelJS.Workbook, p: Pontaj, adresaSursa: string): void {
  const fila = registru.addWorksheet(p.eticheta);
  const nZile = p.zile.length;
  const colZi = (i: number) => 3 + i;
  const colNorma = 3 + nZile;
  const colOre = colNorma + 1;
  const colSupl = colNorma + 2;
  const colNoapte = colNorma + 3;
  const colCod = (k: number) => colNorma + 4 + k;
  const ultimaCol = colCod(CODURI_ABSENTA.length - 1);
  const adresa = (rand: number, col: number) => fila.getCell(rand, col).address;

  fila.columns = [
    { width: 24 },
    { width: 6 },
    ...p.zile.map(() => ({ width: 3.8 })),
    { width: 8 },
    { width: 8 },
    { width: 7 },
    { width: 7 },
    ...CODURI_ABSENTA.map(() => ({ width: 5 })),
  ];

  fila.addRow([`Foaie colectivă de prezență — ${p.eticheta}`]).font = { bold: true, size: 13 };
  fila.addRow([randAntetFirma(p.antet) ?? ""]);
  fila.addRow([rezumatNorma(p)]);
  fila.addRow([TEXT_LEGENDA]).font = { ...GRI_TEXT, size: 9 };

  const cap = fila.addRow([
    "Angajat",
    "h/zi",
    ...p.zile.map((z) => z.zi),
    "Normă",
    "Ore lucrate",
    "Ore supl.",
    "Ore noapte",
    ...CODURI_ABSENTA.map((c) => c.cod),
  ]);
  const litere = fila.addRow(["", "", ...p.zile.map((z) => z.litera)]);
  for (const r of [cap, litere]) {
    r.font = { bold: true, size: 9 };
    r.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  cap.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  /** Chenar pe tot rândul; nisipiu pe sărbători, gri pe zilele din afara programului. */
  const coloreaza = (rand: ExcelJS.Row) => {
    for (let c = 1; c <= ultimaCol; c += 1) rand.getCell(c).border = CHENAR;
    p.zile.forEach((z, i) => {
      const celula = rand.getCell(colZi(i));
      if (z.sarbatoare !== null) umple(celula, UMPLERE_SARBATOARE);
      else if (!z.inProgram) umple(celula, UMPLERE_REPAUS);
    });
  };
  coloreaza(cap);
  coloreaza(litere);

  p.angajati.forEach((a, k) => {
    const r = PRIMUL_RAND + k;
    const rand = fila.addRow([
      a.nume,
      a.oreZi,
      ...p.zile.map((z) => (z.codImplicit === "" ? null : z.codImplicit)),
    ]);
    rand.height = 18;
    coloreaza(rand);
    const zile = `${adresa(r, colZi(0))}:${adresa(r, colZi(nZile - 1))}`;
    // Ziua rotunjită la minut ÎNAINTE de înmulțire, ca `normaLunara` și rândul
    // cu norma lunii: 7,33 h → 7:20 → 21 × 7:20 = 154, nu 153,93.
    rand.getCell(colNorma).value = {
      formula: `ROUND(ROUND(${adresa(r, 2)}*60,0)*${String(p.zileLucratoare)}/60,2)`,
    };
    rand.getCell(colOre).value = { formula: `SUM(${zile})` };
    rand.getCell(colOre).font = { bold: true };
    CODURI_ABSENTA.forEach((c, j) => {
      rand.getCell(colCod(j)).value = { formula: `COUNTIF(${zile},"${c.cod}")` };
    });
    // Săgeata cu coduri, fără alertă: în aceeași celulă se scriu și ore.
    p.zile.forEach((_, i) => {
      rand.getCell(colZi(i)).dataValidation = validareCoduri(LISTA_CODURI, false);
    });
    rand.getCell(2).dataValidation = {
      type: "decimal",
      operator: "between",
      allowBlank: true,
      formulae: [0.5, 24],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Normă invalidă",
      error: "Scrie orele pe zi ale angajatului, între 0,5 și 24.",
    };
  });

  const ultimul = PRIMUL_RAND + p.angajati.length - 1;
  const rTotal = ultimul + 1;
  const coloana = (c: number) => `${adresa(PRIMUL_RAND, c)}:${adresa(ultimul, c)}`;
  const total = fila.addRow(["TOTAL"]);
  total.font = { bold: true };
  coloreaza(total);
  p.zile.forEach((_, i) => {
    total.getCell(colZi(i)).value = { formula: `SUM(${coloana(colZi(i))})` };
  });
  total.getCell(colNorma).value = { formula: `SUM(${coloana(colNorma)})` };
  /*
   * Colțul — totalul general — e suma rândului de total PE ZILE, nu a coloanei
   * „Ore lucrate”: ambele dau același număr, dar așa o greșeală se vede. Dacă
   * cele două nu se închid, colțul nu se potrivește cu suma coloanei de deasupra.
   */
  total.getCell(colOre).value = {
    formula: `SUM(${adresa(rTotal, colZi(0))}:${adresa(rTotal, colZi(nZile - 1))})`,
  };
  for (const c of [colSupl, colNoapte, ...CODURI_ABSENTA.map((_, j) => colCod(j))]) {
    total.getCell(c).value = { formula: `SUM(${coloana(c)})` };
  }

  // Normă sub 8 h și ore peste norma lunii: semnal, nu verdict (art. 15¹ lit. d)).
  const ore = fila.getColumn(colOre).letter;
  const norma = fila.getColumn(colNorma).letter;
  fila.addConditionalFormatting({
    ref: coloana(colOre),
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: [
          `AND($B${String(PRIMUL_RAND)}<8,${ore}${String(PRIMUL_RAND)}>${norma}${String(PRIMUL_RAND)})`,
        ],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: UMPLERE_ALERTA } },
          font: { bold: true, color: { argb: "FFB42318" } },
        },
      },
    ],
  });

  fila.addRow([]);
  fila.addRow([notaSarbatori(p)]);
  fila.addRow([NOTA_COLECTIVA_119]);
  if (p.notaAngajati !== null) fila.addRow([p.notaAngajati]); // nota lui B4: lista e tăiată
  const partial = amendaEvidenta("e3");
  fila.addRow([
    `Roșu la „Ore lucrate”: un angajat cu mai puțin de 8 h pe zi a trecut de norma lunii. La timp parțial, depășirea programului din contract e muncă nedeclarată: ${textAmenda(partial)} (${partial.temei}).`,
  ]);
  fila.addRow([
    "Întocmit: ______________",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Verificat: ______________",
  ]);
  legatura(fila, adresaSursa);

  fila.views = [{ state: "frozen", xSplit: 2, ySplit: RAND_LITERE }];
  pregatesteTiparXlsx(fila, {
    orientare: "peisaj",
    randuriTitlu: { de: RAND_CAP, pana: RAND_LITERE },
  });
}

// ── Fișa individuală ───────────────────────────────────────────────────────

const RAND_CAP_FISA = 6;
const PRIMUL_RAND_FISA = 7;
const COLOANE_FISA = 10;

function filaFisa(
  registru: ExcelJS.Workbook,
  p: Pontaj,
  a: AngajatPontaj,
  nume: string,
  adresaSursa: string,
  notaAngajati: string | null,
): void {
  const fila = registru.addWorksheet(nume);
  fila.columns = [
    { width: 11 },
    { width: 10 },
    { width: 9 },
    { width: 9 },
    { width: 8 },
    { width: 9 },
    { width: 8 },
    { width: 8 },
    { width: 6 },
    { width: 28 },
  ];
  const norma = normaLunara(p.zileLucratoare, a.oreZi);

  fila.addRow([`Fișă individuală de pontaj — ${p.eticheta}`]).font = { bold: true, size: 13 };
  fila.addRow([randAntetFirma(p.antet) ?? ""]);
  fila.addRow([`Angajat: ${a.nume === "" ? "______________________________" : a.nume}`]);
  fila.addRow([
    `Normă: ${oreScurt(a.oreZi)} h/zi × ${cuDe(p.zileLucratoare, "zile lucrătoare")} = ${oreFoaie(norma)} · program ${etichetaProgram(p.program)}`,
  ]);
  fila.addRow([]);
  const cap = fila.addRow([
    "Data",
    "Ziua",
    "Ora început",
    "Ora sfârșit",
    "Pauză (min)",
    "Ore lucrate",
    "Ore supl.",
    "Ore noapte",
    "Cod",
    "Observații",
  ]);
  cap.font = { bold: true, size: 9 };
  cap.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  for (let c = 1; c <= COLOANE_FISA; c += 1) cap.getCell(c).border = CHENAR;

  p.zile.forEach((z, i) => {
    const r = PRIMUL_RAND_FISA + i;
    const rand = fila.addRow([
      new Date(Date.UTC(p.an, p.luna - 1, z.zi)),
      z.numeZi,
      null,
      null,
      null,
      null,
      null,
      null,
      z.codImplicit === "" ? null : z.codImplicit,
      z.sarbatoare,
    ]);
    rand.height = 17;
    rand.getCell(1).numFmt = "dd.mm.yyyy";
    for (const c of [3, 4]) {
      rand.getCell(c).numFmt = "hh:mm";
      rand.getCell(c).dataValidation = VALIDARE_ORA;
    }
    rand.getCell(5).dataValidation = VALIDARE_PAUZA;
    // MOD(…, 1): o tură 22:00–06:00 dă 8:00, nu −16:00. MAX(0, …): o pauză mai
    // lungă decât intervalul nu dă o durată negativă (afișată „#####”).
    rand.getCell(6).value = {
      formula: `IF(AND(ISNUMBER(C${String(r)}),ISNUMBER(D${String(r)})),MAX(0,MOD(D${String(r)}-C${String(r)},1)-N(E${String(r)})/1440),"")`,
    };
    for (const c of [6, 7, 8]) rand.getCell(c).numFmt = "[h]:mm";
    for (const c of [7, 8]) rand.getCell(c).dataValidation = VALIDARE_DURATA;
    rand.getCell(9).dataValidation = validareCoduri(LISTA_CODURI, true);
    for (let c = 1; c <= COLOANE_FISA; c += 1) {
      const celula = rand.getCell(c);
      celula.border = CHENAR;
      if (z.sarbatoare !== null) umple(celula, UMPLERE_SARBATOARE);
      else if (!z.inProgram) umple(celula, UMPLERE_REPAUS);
    }
  });

  const ultim = PRIMUL_RAND_FISA + p.zile.length - 1;
  const rTotal = ultim + 1;
  const total = fila.addRow(["TOTAL"]);
  total.font = { bold: true };
  for (const [c, litera] of [
    [6, "F"],
    [7, "G"],
    [8, "H"],
  ] as const) {
    total.getCell(c).value = {
      formula: `SUM(${litera}${String(PRIMUL_RAND_FISA)}:${litera}${String(ultim)})`,
    };
    total.getCell(c).numFmt = "[h]:mm";
  }
  for (let c = 1; c <= COLOANE_FISA; c += 1) total.getCell(c).border = CHENAR;

  fila.addRow([]);
  const rNorma = rTotal + 3;
  fila.addRow([
    "Zile lucrate",
    { formula: `COUNT(F${String(PRIMUL_RAND_FISA)}:F${String(ultim)})` },
  ]);
  // Norma ca durată (zile Excel), ca să se scadă direct din totalul `[h]:mm`.
  fila.addRow(["Normă lunară", norma / 24]).getCell(2).numFmt = "[h]:mm";
  // Diferența în ore ZECIMALE: o durată negativă se afișează „#####” în Excel.
  fila.addRow([
    "Diferență față de normă (ore)",
    { formula: `ROUND((F${String(rTotal)}-B${String(rNorma)})*24,2)` },
  ]);
  for (const c of CODURI_ABSENTA) {
    fila.addRow([
      `${c.cod} — ${c.denumire}`,
      { formula: `COUNTIF(I${String(PRIMUL_RAND_FISA)}:I${String(ultim)},"${c.cod}")` },
    ]);
  }
  if (a.oreZi < 8) {
    const semnal = fila.addRow([
      {
        formula: `IF(F${String(rTotal)}>B${String(rNorma)},"Peste norma lunii la timp parțial: verifică art. 15¹ lit. d) din Codul muncii.","")`,
      },
    ]);
    semnal.getCell(1).font = { bold: true, color: { argb: "FFB42318" } };
  }
  fila.addRow([]);
  fila.addRow([
    "Salariat: ______________",
    "",
    "",
    "Întocmit: ______________",
    "",
    "",
    "Verificat: ______________",
  ]);
  fila.addRow([TEXT_LEGENDA]).font = { ...GRI_TEXT, size: 9 };
  fila.addRow([NOTA_FISA_119]).font = { ...GRI_TEXT, size: 9 };
  if (notaAngajati !== null) fila.addRow([notaAngajati]);
  legatura(fila, adresaSursa);

  fila.views = [{ state: "frozen", ySplit: RAND_CAP_FISA }];
  pregatesteTiparXlsx(fila, {
    orientare: "portret",
    randuriTitlu: { de: RAND_CAP_FISA, pana: RAND_CAP_FISA },
  });
}

export async function registruPontaj(p: Pontaj): Promise<Uint8Array> {
  const [document] = documenteleFoii(p);
  const registru = new ExcelJS.Workbook();
  registru.creator = "Administrativo";
  registru.title = document.titlu;
  const adresaSursa = adresaDinFisier({ ...document, sursa: SURSA }, "xlsx", ADRESA_SITE);
  if (p.varianta === "colectiva") {
    filaColectiva(registru, p, adresaSursa);
  } else {
    const folosite = new Set<string>();
    angajatiPentruFise(p).forEach((a, i) => {
      const nume = numeFilaSigur(a.nume === "" ? `Fișă ${String(i + 1)}` : a.nume, folosite);
      filaFisa(registru, p, a, nume, adresaSursa, i === 0 ? p.notaAngajati : null);
    });
  }
  return new Uint8Array(await registru.xlsx.writeBuffer());
}
