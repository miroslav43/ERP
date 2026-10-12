import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { GET } from "./route";

const cere = (q: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/condica-de-prezenta?${q}`));

describe("ruta condicii", () => {
  it("Excelul vine din generatorul cu formule, cu numele pe lună", async () => {
    const r = await cere("an=2026&luna=12&format=xlsx&angajati=Popa%20Ion");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="condica-prezenta-2026-12.xlsx"',
    );
    const registru = new ExcelJS.Workbook();
    await registru.xlsx.load(await r.arrayBuffer());
    expect(registru.worksheets[0]?.name).toBe("Condica");
  });

  // Cu un nume, nu cu lista goală: zece rânduri goale × 21 de zile înseamnă 220 de
  // rânduri, iar PDF + Word pe ele au trecut de 5 s (măsurat: 1,8 s + 1,4 s singure).
  it("fără format dă PDF, ca înainte; „DOCX” e tot Word (B8); cache privat (A5)", async () => {
    const r = await cere("an=2026&luna=12&angajati=Popa%20Ion");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const w = await cere("an=2026&luna=12&format=DOCX&angajati=Popa%20Ion");
    expect(w.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("Word are coloanele noi", async () => {
    const r = await cere("an=2026&luna=12&format=docx&program=ls&angajati=Popa%20Ion");
    const zip = await JSZip.loadAsync(new Uint8Array(await r.arrayBuffer()));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain(">Observații<");
    expect(xml).toContain(">lucrate<");
  });

  it("condica nu mai trece prin ruta comună", () => {
    expect(constructorPentru("condica-de-prezenta")).toBeUndefined();
  });
});
