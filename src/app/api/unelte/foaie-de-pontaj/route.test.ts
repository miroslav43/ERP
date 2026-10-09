import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

const cere = (interogare: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/foaie-de-pontaj?${interogare}`));

async function parte(r: Response, cale: string): Promise<string> {
  const zip = await JSZip.loadAsync(await r.arrayBuffer());
  return (await zip.file(cale)?.async("string")) ?? "";
}

const SAPTEZECI = encodeURIComponent(
  Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n"),
);

describe("ruta foii de pontaj", () => {
  it("Excel-ul cu nume iese cu cache-control private, no-store", async () => {
    const r = await cere("luna=10&an=2026&angajati=Ion+Popa");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("PDF-ul trece prin răspunsul comun, cu același antet", async () => {
    const r = await cere("luna=10&an=2026&angajati=Ion+Popa&format=pdf");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("Excelul spune că lista a fost tăiată la 60", async () => {
    const r = await cere(`an=2026&luna=12&angajati=${SAPTEZECI}`);
    expect(await parte(r, "xl/sharedStrings.xml")).toContain(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
  });

  it("Word-ul la fel", async () => {
    const r = await cere(`an=2026&luna=12&format=docx&angajati=${SAPTEZECI}`);
    expect(await parte(r, "word/document.xml")).toContain("ceilalți 10 nu apar aici");
  });

  it("fără tăiere, fără notă", async () => {
    const r = await cere("an=2026&luna=12&angajati=Popa%20Ion");
    expect(await parte(r, "xl/sharedStrings.xml")).not.toContain("nu apar aici");
  });

  it("Excelul foii (fără raspunsDocument) primește numele curățate de B3", async () => {
    // exceljs lasă U+FFFE, care rupe sharedStrings.xml, și lipește cuvintele la
    // U+000B. Excelul foii nu trece prin `raspunsDocument`; îl apără `citesteAngajati`.
    const siruri = await parte(
      await cere("an=2026&luna=12&angajati=Popa%EF%BF%BEIon%0AIlie%0BMaria"),
      "xl/sharedStrings.xml",
    );
    expect(siruri).toContain("PopaIon");
    expect(siruri).toContain("Ilie");
    expect(siruri).toContain("Maria");
    expect(siruri).not.toContain("\u{FFFE}");
  });

  it("Excelul scrie norma în ceas, fără virgulă mobilă", async () => {
    const siruri = await parte(await cere("an=2026&luna=6&ore=7.3"), "xl/sharedStrings.xml");
    expect(siruri).toContain("21 de zile lucrătoare × 7:18 h = 153:18 h normă");
    expect(siruri).not.toContain("153.2999");
  });

  it("formatul se citește fără majuscule: PDF dă PDF, nu Excel", async () => {
    expect((await cere("an=2026&luna=12&format=PDF")).headers.get("content-type")).toBe(
      "application/pdf",
    );
    expect((await cere("an=2026&luna=12&format=DOCX")).headers.get("content-type")).toContain(
      "wordprocessingml",
    );
  });
});

const octetiDin = async (r: Response) => new Uint8Array(await r.arrayBuffer());

/** Variantele, programul și antetul din E (auditul din 8 oct 2026). */
describe("ruta foii de pontaj: variante, program, antet", () => {
  it("fără format dă tot Excelul colectiv, cu formule", async () => {
    const r = await cere("an=2026&luna=12&angajati=Popa%20Ion");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="pontaj-2026-12.xlsx"');
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load((await octetiDin(r)).slice().buffer);
    expect(registru.worksheets[0]?.getCell("AI7").formula).toBe("SUM(C7:AG7)");
  });

  it("varianta individuală în PDF: o pagină pe om, sub un singur fișier", async () => {
    const r = await cere(
      "an=2026&luna=12&varianta=individuala&format=pdf&angajati=Popa%20Ion%0AIlie%20Maria%20%7C%204%0ARadu%20Andrei",
    );
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="fise-pontaj-2026-12.pdf"',
    );
    expect((await PDFDocument.load(await octetiDin(r))).getPageCount()).toBe(3);
  });

  it("varianta individuală în Word: o secțiune pe om", async () => {
    const r = await cere(
      "an=2026&luna=12&varianta=individuala&format=docx&angajati=Popa%20Ion%0AIlie%20Maria",
    );
    const zip = await JSZip.loadAsync(await octetiDin(r));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml.match(/<w:sectPr/gu)).toHaveLength(2);
  });

  it("varianta individuală în Excel: o filă pe om", async () => {
    const r = await cere("an=2026&luna=12&varianta=individuala&angajati=Popa%20Ion%0AIlie%20Maria");
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load((await octetiDin(r)).slice().buffer);
    expect(registru.worksheets.map((f) => f.name)).toEqual(["Popa Ion", "Ilie Maria"]);
  });

  it("Word colectiv are antetul firmei, coloanele de total și sărbătorile marcate", async () => {
    const r = await cere("an=2026&luna=12&format=docx&firma=Construct%20SRL&cui=14399840");
    const zip = await JSZip.loadAsync(await octetiDin(r));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Construct SRL · CUI 14399840");
    expect(xml).toContain(">CFS<");
    expect(xml).toContain(">noapte<");
    expect(xml).toContain(">SL<");
  });

  it("programul pe ture ajunge în fișier", async () => {
    const r = await cere("an=2026&luna=12&program=ture&angajati=Popa%20Ion");
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load((await octetiDin(r)).slice().buffer);
    expect(registru.worksheets[0]?.getCell("C7").value).toBeNull(); // 1 dec: nimic dinainte
    expect(String(registru.worksheets[0]?.getCell("A3").value)).toContain("toate zilele (ture)");
  });
});
