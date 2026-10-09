import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { curataDocument } from "@/lib/unelte/document-tabelar";

import { randeazaXlsxEvaluare } from "./excel";
import { construiesteFisaEvaluare, parametriFisaEvaluare } from "./model";

/**
 * Auditul din 8 oct 2026: Excelul fișei avea ZERO formule, „100” ca text și
 * nimic care să spună că ponderile nu fac 100. Aici se verifică foaia citită
 * înapoi cu exceljs, celulă cu celulă, plus XML-ul pentru validări și
 * formatarea condiționată.
 */
function adresa(randuri: readonly (readonly [string, string, string])[]): URLSearchParams {
  const q = new URLSearchParams({ nume: "Ilie Maria", format: "xlsx" });
  for (const [criteriu, pondere, nota] of randuri) {
    q.append("criteriu", criteriu);
    q.append("pondere", pondere);
    q.append("nota", nota);
  }
  return q;
}

const NOTATA = [
  ["Cunoștințe profesionale", "20", "4"],
  ["Calitatea muncii", "20", "5"],
  ["Respectarea termenelor", "15", "3"],
  ["Comunicare", "15", "4"],
  ["Inițiativă", "15", "3"],
  ["Respectarea procedurilor", "15", "4"],
] as const;

async function foaie(q: URLSearchParams) {
  const p = parametriFisaEvaluare(q);
  const octeti = await randeazaXlsxEvaluare(curataDocument(construiesteFisaEvaluare(p)), p);
  const registru = new ExcelJS.Workbook();
  await registru.xlsx.load(new Uint8Array(octeti).buffer);
  const fila = registru.getWorksheet("Evaluare");
  if (fila === undefined) throw new Error("Fila „Evaluare” lipsește.");
  const zip = await JSZip.loadAsync(octeti);
  const xml = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
  return { fila, xml };
}

/** Rândul a cărui primă celulă e exact textul dat. */
function rand(fila: ExcelJS.Worksheet, text: string): ExcelJS.Row {
  let gasit: ExcelJS.Row | undefined;
  fila.eachRow((r) => {
    if (gasit === undefined && r.getCell(1).value === text) gasit = r;
  });
  if (gasit === undefined) throw new Error(`Rândul „${text}” lipsește.`);
  return gasit;
}

const formula = (celula: ExcelJS.Cell) => (celula.value as ExcelJS.CellFormulaValue).formula;
/** Rezultatul păstrat al formulei; un șir gol se citește înapoi ca lipsă. */
const rezultat = (celula: ExcelJS.Cell) => (celula.value as ExcelJS.CellFormulaValue).result ?? "";

describe("Excelul fișei de evaluare", () => {
  it("ponderile și notele sunt numere, punctajul e formulă cu rezultatul calculat", async () => {
    const { fila } = await foaie(adresa(NOTATA));
    const primul = rand(fila, "Cunoștințe profesionale");
    expect(primul.getCell(2).value).toBe(20);
    expect(primul.getCell(3).value).toBe(4);
    expect(formula(primul.getCell(4))).toMatch(/^IF\(AND\(ISNUMBER\(B\d+\),ISNUMBER\(C\d+\)\)/u);
    expect(rezultat(primul.getCell(4))).toBe(0.8);
  });

  it("totalul e SUM, nota finală SUMPRODUCT, calificativul citește pragurile din celule", async () => {
    const { fila } = await foaie(adresa(NOTATA));
    const total = rand(fila, "Total");
    expect(formula(total.getCell(2))).toMatch(/^SUM\(B\d+:B\d+\)$/u);
    expect(rezultat(total.getCell(2))).toBe(100);
    expect(formula(total.getCell(4))).toContain("SUMPRODUCT(");
    expect(formula(total.getCell(4))).toContain("COUNTA(");
    expect(rezultat(total.getCell(4))).toBe(3.9);
    expect(rezultat(rand(fila, "Nota finală").getCell(2))).toBe(3.9);
    const calificativ = rand(fila, "Calificativ").getCell(2);
    expect(rezultat(calificativ)).toBe("Bine");
    const prag = rand(fila, "Foarte bine, de la");
    expect(prag.getCell(2).value).toBe(4.5);
    expect(formula(calificativ)).toContain(`>=B${String(prag.number)},"Foarte bine"`);
  });

  it("ponderi care nu fac 100: total 90, fără notă finală, controlul spune ce e greșit", async () => {
    const { fila, xml } = await foaie(
      adresa(NOTATA.map((r, i) => (i === 0 ? [r[0], "10", r[2]] : r))),
    );
    const total = rand(fila, "Total");
    expect(rezultat(total.getCell(2))).toBe(90);
    expect(rezultat(total.getCell(4))).toBe("");
    expect(rezultat(total.getCell(5))).toBe("Ponderile trebuie să însumeze 100%.");
    expect(xml).toMatch(
      new RegExp(`<conditionalFormatting sqref="B${String(total.number)}">`, "u"),
    );
    expect(xml).toContain(`$B$${String(total.number)}&lt;&gt;100`);
  });

  it("validări pe tot intervalul: ponderea întreagă 1–100, nota din lista 1–5", async () => {
    const { fila, xml } = await foaie(adresa([...NOTATA, ...NOTATA]));
    const prim = rand(fila, "Cunoștințe profesionale").number;
    const ultim = rand(fila, "Total").number - 1;
    // Câte un interval pe coloană, nesuprapuse: exceljs le-ar fi spart în
    // B10:B20 și B9:B20 dacă validarea s-ar fi pus pe fiecare celulă.
    const intervale = [...xml.matchAll(/<dataValidation type="(\w+)"[^>]*sqref="([^"]+)"/gu)].map(
      (m) => `${m[1] ?? ""} ${m[2] ?? ""}`,
    );
    expect(intervale).toEqual([
      `whole B${String(prim)}:B${String(ultim)}`,
      `list C${String(prim)}:C${String(ultim)}`,
    ]);
    expect(xml).toMatch(/<formula1>1<\/formula1><formula2>100<\/formula2>/u);
    expect(xml).toContain("<formula1>&quot;1,2,3,4,5&quot;</formula1>");
    // Un rând nou scris direct într-un atribut XML devine spațiu la citire (XML
    // 1.0, normalizarea atributelor), deci scala din mesajul de ajutor stă pe un rând.
    expect(xml).toContain('prompt="1 — mult sub cerințele postului; 2 — sub cerințele postului;');
  });

  it("fișa goală, de completat: formulele există, rezultatele sunt goale", async () => {
    const { fila, xml } = await foaie(new URLSearchParams({ format: "xlsx" }));
    expect((xml.match(/<f>/gu) ?? []).length).toBeGreaterThanOrEqual(6 + 4);
    expect(rezultat(rand(fila, "Total").getCell(2))).toBe(100);
    expect(rezultat(rand(fila, "Nota finală").getCell(2))).toBe("");
    expect(rand(fila, "Comentariile angajatului")).toBeDefined();
  });

  it("Excel recalculează la deschidere: `fullCalcOnLoad` rămâne în registru", async () => {
    // Rezultatele păstrate sunt cele de la generare; fără recalculare, o notă
    // schimbată în Excel ar lăsa nota finală veche pe ecran.
    const p = parametriFisaEvaluare(adresa(NOTATA));
    const octeti = await randeazaXlsxEvaluare(curataDocument(construiesteFisaEvaluare(p)), p);
    const zip = await JSZip.loadAsync(octeti);
    const xml = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
    expect(xml).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/u);
  });

  it("criteriul lung se rupe pe rânduri și rândul e destul de înalt", async () => {
    const lung = `Calitatea relației cu clienții și respectarea termenelor de livrare stabilite prin contract ${"x".repeat(25)}`;
    const { fila } = await foaie(adresa([[lung, "100", "5"]]));
    const r = rand(fila, lung);
    expect(r.getCell(1).alignment.wrapText).toBe(true);
    expect(r.height).toBeGreaterThanOrEqual(45);
  });
});
