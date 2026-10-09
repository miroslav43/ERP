import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { constructorPentru } from "@/lib/unelte/registru";

import { GET } from "./route";

const cere = (interogare: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/foaie-de-parcurs?${interogare}`));

const COMPLET =
  "an=2026&luna=10&auto=B-123-ABC&marca=Dacia&sofer=Radu+Andrei&firma=Construct+SRL&cui=RO123&nr=17&categorie=autoturism&combustibil=motorina&utilizare=agent&norma=6,5&km=125000&stoc=20&curse=2";

// Generarea PDF-ului cu 62 de curse durează ~1 s singură și peste 5 s sub `pnpm test`
// (toate fișierele în paralel): plafonul implicit de 5 s o făcea instabilă.
describe("ruta foii de parcurs", { timeout: 30_000 }, () => {
  it("Excel-ul are formule, numele mașinii în fișier și cache privat", async () => {
    const r = await cere(`${COMPLET}&format=xlsx`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="foaie-de-parcurs-b-123-abc-2026-10.xlsx"',
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const foaie = (await zip.file("xl/worksheets/sheet1.xml")?.async("string")) ?? "";
    expect(foaie.match(/<f>/gu)?.length ?? 0).toBeGreaterThan(100);
  });

  it("PDF-ul și Word-ul trec prin modelul comun, cu categoria vehiculului", async () => {
    const pdf = await cere(`${COMPLET}&format=pdf`);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("cache-control")).toBe("private, no-store");
    const docx = await cere(`${COMPLET}&format=docx`);
    const zip = await JSZip.loadAsync(await docx.arrayBuffer());
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Categoria vehiculului: Autoturism");
    expect(xml).toContain("Alimentări cu combustibil");
  });

  it("fără format dă PDF, ca linkurile vechi", async () => {
    expect((await cere("an=2026&luna=10")).headers.get("content-type")).toBe("application/pdf");
  });

  it("caracterele de control nu ajung în Excel", async () => {
    const r = await cere("an=2026&luna=10&sofer=Popa%00%01%0BIon&format=xlsx");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    const siruri = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(siruri).toContain("Popa Ion");
    expect(siruri).not.toMatch(/[\u0000-\u0008\u000B\u000C]/u);
  });

  it("ruta comună nu mai servește foaia de parcurs: o servește ruta statică", () => {
    expect(constructorPentru("foaie-de-parcurs")).toBeUndefined();
  });
});
