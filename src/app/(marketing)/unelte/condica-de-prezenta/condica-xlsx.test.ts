import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { registruCondica } from "./condica-xlsx";
import { parametriCondica } from "./model";

const parametri = (q: Record<string, string>) =>
  parametriCondica(
    new URLSearchParams({ an: "2026", luna: "12", angajati: "Popa Ion\nIlie Maria", ...q }),
  );

async function deschide(octeti: Uint8Array) {
  const registru = new ExcelJS.Workbook();
  // `ArrayBuffer`, nu `Buffer.from(...)`: vezi `foaie-xlsx.test.ts` (TS2345).
  await registru.xlsx.load(octeti.slice().buffer);
  const zip = await JSZip.loadAsync(octeti);
  const xml = async (cale: string) => (await zip.file(cale)?.async("string")) ?? "";
  return { registru, xml };
}

/** Auditul din 8 oct 2026: condica în Excel avea 0 formule, date ca text și nicio repetare a capului la tipar. */
describe("Excelul condicii", () => {
  it("are date reale, rânduri-marcaj și ora calculată din sosire, plecare și pauză", async () => {
    const { registru } = await deschide(await registruCondica(parametri({})));
    expect(registru.worksheets.map((f) => f.name)).toEqual(["Condica", "Total pe angajat"]);
    const f = registru.worksheets[0];
    if (f === undefined) throw new Error("fila lipsește");
    const data = f.getCell("A6").value;
    expect(data instanceof Date ? data.toISOString().slice(0, 10) : data).toBe("2026-12-01");
    expect(f.getCell("B6").value).toBe("Ziua Națională a României");
    expect(f.getCell("I6").value).toBe("SL");
    expect(f.getCell("H6").formula).toBeUndefined(); // pe un marcaj nu se calculează nimic
    expect(f.getCell("B7").value).toBe("Popa Ion");
    expect(f.getCell("H7").formula).toBe(
      'IF(AND(ISNUMBER(C7),ISNUMBER(E7)),MAX(0,MOD(E7-C7,1)-N(G7)/1440),"")',
    );
    expect(f.getCell("H7").numFmt).toBe("[h]:mm");
    expect(f.getCell("C7").numFmt).toBe("hh:mm");
    expect(f.getCell("B57").value).toBe("Ilie Maria"); // 5 + 21×2 + 10 = rândul 57
  });

  it("a doua filă adună pe om orele și zilele pe coduri", async () => {
    const { registru } = await deschide(await registruCondica(parametri({})));
    const t = registru.getWorksheet("Total pe angajat");
    if (t === undefined) throw new Error("fila lipsește");
    expect(t.getCell("A3").value).toBe("Popa Ion");
    expect(t.getCell("A4").value).toBe("Ilie Maria");
    expect(t.getCell("B3").formula).toBe('COUNTIFS(Condica!$B$6:$B$57,A3,Condica!$H$6:$H$57,">0")');
    expect(t.getCell("C3").formula).toBe("SUMIF(Condica!$B$6:$B$57,A3,Condica!$H$6:$H$57)");
    expect(t.getCell("D3").formula).toBe('COUNTIFS(Condica!$B$6:$B$57,A3,Condica!$I$6:$I$57,"CO")');
    expect(t.getCell("H4").formula).toBe('COUNTIFS(Condica!$B$6:$B$57,A4,Condica!$I$6:$I$57,"D")');
  });

  it("fără nume nu există fila de total, care n-ar avea pe cine aduna", async () => {
    const { registru } = await deschide(await registruCondica(parametri({ angajati: "" })));
    expect(registru.worksheets.map((f) => f.name)).toEqual(["Condica"]);
  });

  it("se tipărește pe A4 portret, cu capul repetat, și validează orele", async () => {
    const { xml } = await deschide(await registruCondica(parametri({})));
    // ExcelJS scapă apostroful: `&apos;Condica&apos;!$5:$5` (verificat pe 4.4.0).
    expect(await xml("xl/workbook.xml")).toMatch(/(&apos;|')Condica(&apos;|')!\$5:\$5/u);
    const foaie = await xml("xl/worksheets/sheet1.xml");
    expect(foaie).toMatch(/paperSize="9"/u);
    expect(foaie).toMatch(/orientation="portrait"/u);
    expect(foaie).toMatch(/type="decimal"/u);
    expect(foaie).toMatch(/<formula1>(&quot;|")CO,CM,CFS,AN,D,L,SL(&quot;|")<\/formula1>/u);
  });

  it("la ture, prima zi are marcajul SL și apoi rândurile oamenilor", async () => {
    const { registru } = await deschide(await registruCondica(parametri({ program: "ture" })));
    const f = registru.worksheets[0];
    const data = f?.getCell("A7").value;
    expect(data instanceof Date ? data.toISOString().slice(0, 10) : data).toBe("2026-12-01");
    expect(f?.getCell("B7").value).toBe("Popa Ion");
  });
});
