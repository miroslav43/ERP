import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { LISTA_CODURI } from "./coduri-pontaj";
import { numeFilaSigur, pregatesteTiparXlsx, validareCoduri, VALIDARE_ORA } from "./tipar-xlsx";

async function xml(registru: ExcelJS.Workbook, cale: string): Promise<string> {
  const zip = await JSZip.loadAsync(await registru.xlsx.writeBuffer());
  return (await zip.file(cale)?.async("string")) ?? "";
}

/**
 * Auditul din 8 oct 2026: `print_title_rows=None`, `paperSize=None` pe foaia de
 * pontaj; condica fără `_xlnm.Print_Titles`. Cu 60 de angajați, pagina a doua
 * tipărită din Excel n-avea capul de tabel.
 */
describe("tiparul Excel", () => {
  it("A4, orientarea cerută, rândurile de titlu repetate și pagina în subsol", async () => {
    const registru = new ExcelJS.Workbook();
    const fila = registru.addWorksheet("decembrie 2026");
    fila.addRow(["Titlu"]);
    pregatesteTiparXlsx(fila, { orientare: "peisaj", randuriTitlu: { de: 5, pana: 6 } });
    const carte = await xml(registru, "xl/workbook.xml");
    expect(carte).toContain("_xlnm.Print_Titles");
    // ExcelJS scapă apostroful din XML: `&apos;decembrie 2026&apos;!$5:$6` (verificat pe 4.4.0).
    expect(carte).toMatch(/(&apos;|')decembrie 2026(&apos;|')!\$5:\$6/u);
    const foaie = await xml(registru, "xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/paperSize="9"/u);
    expect(foaie).toMatch(/orientation="landscape"/u);
    expect(foaie).toMatch(/fitToWidth="1"/u);
    expect(foaie).toMatch(/<oddFooter>[^<]*&amp;P din &amp;N/u);
  });

  it("lista de coduri: săgeată fără alertă pe celulele de ore, strictă pe coloana de cod", async () => {
    const registru = new ExcelJS.Workbook();
    const fila = registru.addWorksheet("Proba");
    fila.getCell("C7").dataValidation = validareCoduri(LISTA_CODURI, false);
    fila.getCell("I7").dataValidation = validareCoduri(LISTA_CODURI, true);
    fila.getCell("D7").dataValidation = VALIDARE_ORA;
    const foaie = await xml(registru, "xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/<formula1>(&quot;|")CO,CM,CFS,AN,D,L,SL(&quot;|")<\/formula1>/u);
    expect(foaie.match(/<dataValidation /gu)).toHaveLength(3);
    expect(foaie.match(/showErrorMessage="1"/gu)).toHaveLength(2); // I7 și D7, nu C7
    expect(foaie).toMatch(/type="decimal"/u);
  });
});

describe("numele filelor", () => {
  it("scoate caracterele interzise, taie la 31, deosebește dublurile fără să țină cont de majuscule", () => {
    const folosite = new Set<string>();
    expect(numeFilaSigur("Popa Ion", folosite)).toBe("Popa Ion");
    expect(numeFilaSigur("Popa Ion", folosite)).toBe("Popa Ion (2)");
    expect(numeFilaSigur("popa ion", folosite)).toBe("popa ion (3)");
    expect(numeFilaSigur("Ana/Maria: [test]*?", folosite)).toBe("Ana Maria test");
    expect(numeFilaSigur("'Ion'", folosite)).toBe("Ion");
    expect(numeFilaSigur("' 'Ilie", folosite)).toBe("Ilie");
    expect(numeFilaSigur("Radu' '", folosite)).toBe("Radu");
    expect(numeFilaSigur("", folosite)).toBe("Fișă");
    expect(numeFilaSigur("History", folosite)).toBe("Fișă History");
    expect(numeFilaSigur("x".repeat(40), folosite)).toHaveLength(31);
  });

  it("orice nume produs e acceptat de ExcelJS, inclusiv dublurile lungi", () => {
    const registru = new ExcelJS.Workbook();
    const folosite = new Set<string>();
    const dorite = [
      "Popescu-Vasilescu Ana-Maria Ștefania",
      "Popescu-Vasilescu Ana-Maria Ștefania",
      "O'Neil Ion'",
      "a/b\\c",
      "",
      "History",
      // Apostroful ascuns după un spațiu: după tăierea de la capete, rămâne la capăt.
      "' 'Ion",
      "Popa Ion' '",
    ];
    for (const dorit of dorite) {
      expect(() => registru.addWorksheet(numeFilaSigur(dorit, folosite))).not.toThrow();
    }
    expect(registru.worksheets).toHaveLength(dorite.length);
  });
});
