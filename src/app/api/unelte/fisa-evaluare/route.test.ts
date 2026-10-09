import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { GET } from "./route";

const cere = (q: URLSearchParams) =>
  GET(new NextRequest(`http://localhost/api/unelte/fisa-evaluare?${q.toString()}`));

function adresa(format: string, randuri: readonly (readonly [string, string, string])[]) {
  const q = new URLSearchParams({ nume: "Ilie Maria", format });
  for (const [criteriu, pondere, nota] of randuri) {
    q.append("criteriu", criteriu);
    q.append("pondere", pondere);
    q.append("nota", nota);
  }
  return q;
}

const NOTATA = [
  ["Calitatea muncii", "60", "4"],
  ["Respectarea termenelor", "40", "5"],
] as const;

describe("ruta fișei de evaluare", () => {
  it("Excelul e registrul cu formule, cu numele angajatului în fișier", async () => {
    const r = await cere(adresa("xlsx", NOTATA));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="fisa-evaluare-ilie-maria.xlsx"',
    );
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const xml = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    expect(xml).toContain("SUMPRODUCT(");
  });

  it("textul din Excel e curățat ca în celelalte formate", async () => {
    const r = await cere(adresa("xlsx", [["Calitatea muncii\u000bși a documentelor", "100", "4"]]));
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const siruri = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(siruri).toContain("Calitatea muncii și a documentelor");
  });

  it("PDF și Word trec prin randarea comună, cu nota finală în tabel", async () => {
    const pdf = await cere(adresa("pdf", NOTATA));
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const docx = await cere(adresa("docx", NOTATA));
    const zip = await JSZip.loadAsync(await docx.arrayBuffer());
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Total (nota finală)");
    expect(xml).toContain("4,40");
  });

  it("formatul cu majuscule dă formatul cerut (B8), iar Excelul are același cache ca restul", async () => {
    const docx = await cere(adresa("DOCX", NOTATA));
    expect(docx.headers.get("content-type")).toContain("wordprocessingml");
    const xlsx = await cere(adresa("xlsx", NOTATA));
    expect(xlsx.headers.get("cache-control")).toBe(docx.headers.get("cache-control"));
  });

  it("fără format dă PDF, ca înainte", async () => {
    const r = await cere(new URLSearchParams({ nume: "Ilie Maria" }));
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });

  it("fișa nu mai e în registrul rutei comune: ruta statică o servește", () => {
    expect(constructorPentru("fisa-evaluare")).toBeUndefined();
  });
});
