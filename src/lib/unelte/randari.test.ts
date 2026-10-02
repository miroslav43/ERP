import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { normalizeazaFormat, numeFisierSigur, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { randeazaPdf, taie } from "./pdf";
import { raspunsDocument } from "./raspuns";
import { randeazaXlsx } from "./xlsx";

const DOC: DocumentTabelar = {
  titlu: "Condica de prezență — octombrie 2026",
  subtitlu: "Firma Exemplu SRL",
  campuri: [{ eticheta: "Angajat", valoare: "Ștefan Țepeș-Ionescu, Ână Îî" }],
  paragrafe: ["Subsemnatul, vă rog să-mi aprobați cererea."],
  coloane: [
    { eticheta: "Data", latime: 2 },
    { eticheta: "Nume și prenume", latime: 5 },
    { eticheta: "Semnătura", latime: 3 },
  ],
  randuri: Array.from({ length: 80 }, (_, i) => [`${String(i + 1)}.10.2026`, "Popa Ion", ""]),
  umbrite: [0],
  note: ["Sărbători legale în lună: niciuna"],
  semnaturi: ["Întocmit", "Aprobat"],
  orientare: "peisaj",
  numeFisier: "condica-octombrie-2026",
};

describe("modelul comun", () => {
  it("formatul necunoscut cade pe PDF", () => {
    expect(normalizeazaFormat(null)).toBe("pdf");
    expect(normalizeazaFormat("exe")).toBe("pdf");
    expect(normalizeazaFormat("docx")).toBe("docx");
  });

  it("numeFisierSigur scoate diacriticele și ghilimelele", () => {
    expect(numeFisierSigur('foaie "ș" țară/2026')).toBe("foaie-s-tara-2026");
    expect(numeFisierSigur("„”")).toBe("document");
  });
});

describe("PDF", () => {
  it("randeazaPdf nu aruncă pe ș, ț, ă, î, â și paginează rândurile", async () => {
    const octeti = await randeazaPdf(DOC);
    expect(new TextDecoder().decode(octeti.slice(0, 5))).toBe("%PDF-");
    const citit = await PDFDocument.load(octeti);
    expect(citit.getPageCount()).toBeGreaterThan(1);
    const pagina = citit.getPage(0);
    expect(pagina.getWidth()).toBeGreaterThan(pagina.getHeight()); // peisaj
  });

  it("taie respectă lățimea și pune „…” doar când trebuie", () => {
    const masoara = (t: string) => t.length * 5;
    expect(taie("scurt", 100, masoara)).toBe("scurt");
    const lung = taie("x".repeat(200), 50, masoara);
    expect(masoara(lung)).toBeLessThanOrEqual(50);
    expect(lung.endsWith("…")).toBe(true);
  });
});

describe("Word", () => {
  it("randeazaDocx produce un .docx cu titlul, diacriticele și orientarea", async () => {
    const octeti = await randeazaDocx(DOC);
    const zip = await JSZip.loadAsync(octeti);
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("Condica de prezență");
    expect(xml).toContain("Ștefan Țepeș-Ionescu");
    expect(xml).toContain('w:orient="landscape"');
  });
});

describe("Excel", () => {
  it("randeazaXlsx produce un registru cu antetul tabelului", async () => {
    const octeti = await randeazaXlsx(DOC);
    const zip = await JSZip.loadAsync(octeti);
    const siruri = await zip.file("xl/sharedStrings.xml")?.async("string");
    expect(siruri).toContain("Nume și prenume");
  });
});

describe("răspunsul HTTP", () => {
  it("pune tipul, numele ASCII și atașamentul", async () => {
    const r = await raspunsDocument(DOC, "docx");
    expect(r.headers.get("content-type")).toContain("wordprocessingml");
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="condica-octombrie-2026.docx"',
    );
  });
});
