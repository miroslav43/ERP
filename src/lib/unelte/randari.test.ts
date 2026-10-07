import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { normalizeazaFormat, numeFisierSigur, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { imparte, randeazaPdf, taie } from "./pdf";
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

  it("imparte rupe proza pe cuvinte, fără să piardă nimic și fără rând peste lățime", () => {
    // Cererea de concediu se tăia într-un singur rând cu „…” — văzut în PDF-ul randat.
    const masoara = (t: string) => t.length * 5;
    const text = "Subsemnatul Popa Ion vă rog să binevoiți a aproba concediul de odihnă";
    const randuri = imparte(text, 100, masoara);
    expect(randuri.length).toBeGreaterThan(1);
    expect(randuri.join(" ")).toBe(text);
    for (const r of randuri) expect(masoara(r)).toBeLessThanOrEqual(100);
    // Un cuvânt mai lung decât rândul se taie cu „…”, nu rupe bucla.
    expect(imparte("x".repeat(60), 100, masoara)).toHaveLength(1);
  });

  it("taie e logaritmică: un nume de 8.000 de caractere nu cere mii de măsurători", () => {
    // Revizuirea finală: `taie` scotea câte un caracter și remăsura tot — un nume
    // de 300 de caractere ținea generarea condicii 5,7 s (măsurat).
    let apeluri = 0;
    const masoara = (t: string) => {
      apeluri += 1;
      return t.length * 5;
    };
    const rezultat = taie("a".repeat(8000), 160, masoara);
    expect(masoara(rezultat)).toBeLessThanOrEqual(160 + 5);
    expect(rezultat.endsWith("…")).toBe(true);
    expect(apeluri).toBeLessThan(40);
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

/**
 * Rândul de jos al fișierului duce înapoi la unealtă. Fișierele se trimit mai
 * departe și se reîncarcă în alte firme; ca text simplu, rândul nu aducea pe
 * nimeni înapoi (auditul din 7 oct 2026).
 */
describe("legătura din subsolul fișierului", () => {
  const CU_SURSA: DocumentTabelar = { ...DOC, sursa: "/unelte/foaie-de-parcurs" };
  const TINTA = /\/unelte\/foaie-de-parcurs\?utm_source=fisier&(amp;)?utm_medium=/;

  it("PDF: adnotare URI peste text", async () => {
    const pdf = await PDFDocument.load(await randeazaPdf(CU_SURSA));
    const text = new TextDecoder("latin1").decode(await pdf.save({ useObjectStreams: false }));
    expect(text).toMatch(/\/Subtype \/Link/);
    expect(text).toMatch(/\/S \/URI/);
    expect(text).toMatch(TINTA);
  });

  it("Word: hyperlink extern", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(CU_SURSA));
    const relatii = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
    expect(relatii).toMatch(TINTA);
    expect((await zip.file("word/document.xml")?.async("string")) ?? "").toMatch(/<w:hyperlink/);
  });

  it("Excel: celulă cu legătură și titlul documentului", async () => {
    const zip = await JSZip.loadAsync(await randeazaXlsx(CU_SURSA));
    const relatii = Object.keys(zip.files).filter((f) => f.includes("worksheets/_rels/"));
    const continut = await Promise.all(relatii.map((f) => zip.file(f)?.async("string")));
    expect(continut.join(" ")).toMatch(TINTA);
    expect((await zip.file("docProps/core.xml")?.async("string")) ?? "").toContain(DOC.titlu);
  });

  it("fără sursă, duce la lista uneltelor", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(DOC));
    const relatii = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
    expect(relatii).toMatch(/\/unelte\?utm_source=fisier/);
  });
});
