import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { registruPontaj } from "./foaie-xlsx";
import { construiestePontaj, parametriPontaj } from "./pontaj";

const pontaj = (q: Record<string, string>) =>
  construiestePontaj(
    parametriPontaj(
      new URLSearchParams({ an: "2026", luna: "12", angajati: "Popa Ion\nIlie Maria | 4", ...q }),
    ),
  );

async function deschide(octeti: Uint8Array) {
  const registru = new ExcelJS.Workbook();
  // `ArrayBuffer`, nu `Buffer.from(...)`: tipul `Buffer` din exceljs extinde
  // `ArrayBuffer`, iar `Buffer<ArrayBuffer>` din Node nu-l satisface (TS2345,
  // verificat cu tsconfig-ul proiectului). Așa citește și `src/lib/import/excel.ts`.
  await registru.xlsx.load(octeti.slice().buffer);
  const zip = await JSZip.loadAsync(octeti);
  const xml = async (cale: string) => (await zip.file(cale)?.async("string")) ?? "";
  return { registru, xml };
}

/*
 * Decembrie 2026, 31 de zile: zilele sunt C…AG, apoi AH Normă, AI Ore lucrate,
 * AJ Ore supl., AK Ore noapte, AL CO, AM CM, AN CFS, AO AN, AP D.
 */
describe("Excelul foii colective", () => {
  it("are formule reale: normă, ore lucrate, COUNTIF pe fiecare cod, totaluri", async () => {
    const { registru } = await deschide(await registruPontaj(pontaj({})));
    expect(registru.worksheets.map((f) => f.name)).toEqual(["decembrie 2026"]);
    const f = registru.worksheets[0];
    if (f === undefined) throw new Error("fila lipsește");
    expect(f.getCell("A7").value).toBe("Popa Ion");
    expect(f.getCell("B7").value).toBe(8);
    expect(f.getCell("B8").value).toBe(4);
    expect(f.getCell("C7").value).toBe("SL");
    expect(f.getCell("D7").value).toBeNull();
    expect(f.getCell("G7").value).toBe("L");
    expect(f.getCell("AH7").formula).toBe("ROUND(ROUND(B7*60,0)*21/60,2)");
    expect(f.getCell("AI7").formula).toBe("SUM(C7:AG7)");
    expect(f.getCell("AL7").formula).toBe('COUNTIF(C7:AG7,"CO")');
    expect(f.getCell("AN8").formula).toBe('COUNTIF(C8:AG8,"CFS")');
    expect(f.getCell("AP8").formula).toBe('COUNTIF(C8:AG8,"D")');
    expect(f.getCell("A9").value).toBe("TOTAL");
    expect(f.getCell("C9").formula).toBe("SUM(C7:C8)");
    expect(f.getCell("AH9").formula).toBe("SUM(AH7:AH8)");
    // Colțul: suma rândului de total pe zile — dacă nu se închide cu coloana, se vede.
    expect(f.getCell("AI9").formula).toBe("SUM(C9:AG9)");
    expect(f.getCell("AL9").formula).toBe("SUM(AL7:AL8)");
    // Auditul: coloana de total n-avea lățime.
    for (let c = 1; c <= 42; c += 1) expect(f.getColumn(c).width, String(c)).toBeGreaterThan(0);
  });

  it("norma din coloana „Normă” rotunjește ziua la minut, ca rândul cu norma lunii", async () => {
    // 7,33 h se afișează „7:20”; rândul 3 spune 21 × 7:20 = 154 h, deci și
    // coloana trebuie să dea 154, nu ROUND(7,33 × 21) = 153,93.
    const { registru } = await deschide(
      await registruPontaj(pontaj({ ore: "7.33", angajati: "Popa Ion" })),
    );
    const f = registru.worksheets[0];
    if (f === undefined) throw new Error("fila lipsește");
    expect(String(f.getCell("A3").value)).toContain("= 154 h normă");
    expect(f.getCell("AH7").formula).toBe("ROUND(ROUND(B7*60,0)*21/60,2)");
  });

  it("se tipărește pe A4 culcat, cu cele două rânduri de cap repetate", async () => {
    const { xml } = await deschide(await registruPontaj(pontaj({})));
    // ExcelJS scapă apostroful în XML: `&apos;decembrie 2026&apos;!$5:$6` (verificat pe 4.4.0).
    expect(await xml("xl/workbook.xml")).toMatch(/(&apos;|')decembrie 2026(&apos;|')!\$5:\$6/u);
    const foaie = await xml("xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/paperSize="9"/u);
    expect(foaie).toMatch(/orientation="landscape"/u);
  });

  it("celulele de zi au lista de coduri, iar orele peste norma de timp parțial se colorează", async () => {
    const { xml } = await deschide(await registruPontaj(pontaj({})));
    const foaie = await xml("xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/<formula1>(&quot;|")CO,CM,CFS,AN,D,L,SL(&quot;|")<\/formula1>/u);
    expect(foaie).toMatch(/<conditionalFormatting sqref="AI7:AI8"/u);
    expect(foaie).toMatch(/AND\(\$B7(&lt;|<)8,AI7(&gt;|>)AH7\)/u);
  });

  it("nota lui B4 de listă tăiată ajunge în Excel, doar când lista e tăiată", async () => {
    const multi = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");
    const text = async (q: Record<string, string>) => {
      const { registru } = await deschide(await registruPontaj(pontaj(q)));
      return (registru.worksheets[0]?.getSheetValues() ?? [])
        .flat()
        .filter((v): v is string => typeof v === "string")
        .join(" ");
    };
    expect(await text({ angajati: multi })).toContain("ceilalți 10 nu apar aici");
    expect(await text({})).not.toContain("nu apar aici");
  });

  it("nota de timp parțial citează amenda din pagina evidenței orelor", async () => {
    const { registru } = await deschide(await registruPontaj(pontaj({})));
    const text = (registru.worksheets[0]?.getSheetValues() ?? [])
      .flat()
      .filter((v): v is string => typeof v === "string")
      .join(" ");
    expect(text).toMatch(/10\.000 – 15\.000 lei/u);
    expect(text).toMatch(/art\. 15¹ lit\. d\)/u);
  });
});

describe("Excelul fișelor individuale", () => {
  it("are o filă pe om, cu nume sigure și dublurile deosebite", async () => {
    const { registru } = await deschide(
      await registruPontaj(
        pontaj({ varianta: "individuala", angajati: "Popa Ion\nPopa Ion\nAna/Maria | 4" }),
      ),
    );
    expect(registru.worksheets.map((f) => f.name)).toEqual([
      "Popa Ion",
      "Popa Ion (2)",
      "Ana Maria",
    ]);
  });

  it("calculează orele din început, sfârșit și pauză, și peste miezul nopții", async () => {
    const { registru, xml } = await deschide(
      await registruPontaj(pontaj({ varianta: "individuala" })),
    );
    const f = registru.worksheets[1]; // Ilie Maria, 4 h/zi
    if (f === undefined) throw new Error("fila lipsește");
    const data = f.getCell("A7").value;
    expect(data instanceof Date ? data.toISOString().slice(0, 10) : data).toBe("2026-12-01");
    expect(f.getCell("B7").value).toBe("marți");
    expect(f.getCell("I7").value).toBe("SL");
    expect(f.getCell("J7").value).toBe("Ziua Națională a României");
    expect(f.getCell("I11").value).toBe("L"); // 5 decembrie
    expect(f.getCell("F7").formula).toBe(
      'IF(AND(ISNUMBER(C7),ISNUMBER(D7)),MAX(0,MOD(D7-C7,1)-N(E7)/1440),"")',
    );
    expect(f.getCell("F7").numFmt).toBe("[h]:mm");
    expect(f.getCell("C7").numFmt).toBe("hh:mm");
    expect(f.getCell("A38").value).toBe("TOTAL");
    expect(f.getCell("F38").formula).toBe("SUM(F7:F37)");
    expect(f.getCell("B40").formula).toBe("COUNT(F7:F37)");
    // 84 h = 3,5 zile Excel. Se citește din XML: la `load`, ExcelJS transformă orice
    // număr cu format de oră (`[h]:mm`) într-un `Date` (1900-01-02T12:00), nu în 3,5.
    expect(await xml("xl/worksheets/sheet2.xml")).toMatch(/<c r="B41"[^>]*><v>3\.5<\/v><\/c>/u);
    expect(f.getCell("B42").formula).toBe("ROUND((F38-B41)*24,2)");
    expect(f.getCell("B43").formula).toBe('COUNTIF(I7:I37,"CO")');
    expect(f.getCell("A48").formula).toContain("F38>B41"); // semnalul de timp parțial
    const foaie = await xml("xl/worksheets/sheet2.xml");
    expect(foaie).toMatch(/type="decimal"/u); // C/D: ora cu două puncte
    expect(foaie).toMatch(/orientation="portrait"/u);
    expect(await xml("xl/workbook.xml")).toMatch(/(&apos;|')Ilie Maria(&apos;|')!\$6:\$6/u);
  });

  it("cine are normă întreagă nu primește rândul de semnal", async () => {
    const { registru } = await deschide(
      await registruPontaj(pontaj({ varianta: "individuala", angajati: "Popa Ion" })),
    );
    const f = registru.worksheets[0];
    expect(String(f?.getCell("A48").formula ?? "")).not.toContain("F38>B41");
  });
});
