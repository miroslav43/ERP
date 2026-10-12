import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "./document-tabelar";
import { randeazaDocx, randeazaDocxMultiplu } from "./docx";
import { raspunsBinar, raspunsDocumente } from "./raspuns";

function fisa(nume: string, extra: Partial<DocumentTabelar> = {}): DocumentTabelar {
  return {
    titlu: `Fișă individuală de pontaj — decembrie 2026`,
    subtitlu: "Construct SRL",
    campuri: [{ eticheta: "Angajat", valoare: nume }],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Semnătura", latime: 3 },
    ],
    randuri: [["01.12", ""]],
    umbrite: [],
    note: [],
    semnaturi: [],
    orientare: "portret",
    numeFisier: "fisa",
    ...extra,
  };
}

async function fisiere(octeti: Uint8Array, prefix: string): Promise<string> {
  const zip = await JSZip.loadAsync(octeti);
  const nume = Object.keys(zip.files).filter((f) => f.startsWith(prefix));
  const continut = await Promise.all(nume.map((f) => zip.file(f)?.async("string")));
  return continut.join("\n");
}

describe("Word cu mai multe documente", () => {
  it("fiecare fișă e o secțiune proprie, cu numele ei", async () => {
    const xml = await fisiere(
      await randeazaDocxMultiplu([fisa("Popa Ion"), fisa("Ilie Maria")]),
      "word/document.xml",
    );
    expect(xml.match(/<w:sectPr/gu)).toHaveLength(2);
    expect(xml).toContain("Popa Ion");
    expect(xml).toContain("Ilie Maria");
  });

  it("rândurile cer înălțimea minimă și nu se rup între pagini", async () => {
    const xml = await fisiere(
      await randeazaDocx(fisa("Popa Ion", { inaltimeRand: 22 })),
      "word/document.xml",
    );
    expect(xml).toMatch(/<w:trHeight[^>]*w:val="440"/u);
    expect(xml).toMatch(/<w:trHeight[^>]*w:hRule="atLeast"/u);
    expect(xml).toMatch(/<w:cantSplit/u);
  });

  it("subsolul numără paginile secțiunii, antetul repetă titlul și firma", async () => {
    const octeti = await randeazaDocx(fisa("Popa Ion"));
    const subsol = await fisiere(octeti, "word/footer");
    expect(subsol).toContain("Pagina");
    expect(subsol).toMatch(/SECTIONPAGES/u);
    expect(subsol).toMatch(/PAGE/u);
    expect(await fisiere(octeti, "word/header")).toContain(
      "Fișă individuală de pontaj — decembrie 2026 · Construct SRL",
    );
  });

  it("fără documente refuză", async () => {
    await expect(randeazaDocxMultiplu([])).rejects.toThrow(/Niciun document/u);
  });
});

describe("răspunsul cu mai multe documente", () => {
  it("PDF-urile fișelor stau unul după altul, sub un singur nume", async () => {
    const r = await raspunsDocumente([fisa("A"), fisa("B")], "pdf", "fise-pontaj-2026-12");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="fise-pontaj-2026-12.pdf"',
    );
    const pdf = await PDFDocument.load(new Uint8Array(await r.arrayBuffer()));
    expect(pdf.getPageCount()).toBe(2);
  });

  it("curăță fiecare document, ca răspunsul cu unul singur", async () => {
    const vt = String.fromCharCode(11); // rândul manual din Word, care strica XML-ul
    const r = await raspunsDocumente(
      [fisa(`Popa${vt}Ion`), fisa("Ilie Maria")],
      "docx",
      "fise-pontaj-2026-12",
    );
    const xml = await fisiere(new Uint8Array(await r.arrayBuffer()), "word/document.xml");
    expect(xml).not.toContain(vt);
    expect(xml).toContain("Popa Ion");
  });

  it("raspunsBinar pune tipul, atașamentul, numele ASCII și cache-ul privat al lui A5", () => {
    const r = raspunsBinar(new Uint8Array([1, 2, 3]), "xlsx", "pontaj ș-2026");
    expect(r.headers.get("content-type")).toContain("spreadsheetml");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="pontaj-s-2026.xlsx"');
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
});
