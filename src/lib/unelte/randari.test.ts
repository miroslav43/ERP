import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { SaxesParser } from "saxes";
import { describe, expect, it } from "vitest";

import {
  curataDocument,
  curataText,
  normalizeazaFormat,
  numeFisierSigur,
  type DocumentTabelar,
} from "./document-tabelar";
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

  it("formatul se citește fără majuscule și fără spații", () => {
    expect(normalizeazaFormat("DOCX")).toBe("docx");
    expect(normalizeazaFormat(" xlsx ")).toBe("xlsx");
    expect(normalizeazaFormat("Pdf")).toBe("pdf");
  });

  it("numeFisierSigur scoate diacriticele și ghilimelele", () => {
    expect(numeFisierSigur('foaie "ș" țară/2026')).toBe("foaie-s-tara-2026");
    expect(numeFisierSigur("„”")).toBe("document");
  });

  it("numeFisierSigur nu lasă liniuțe duble din compunerea „unealtă-” + nume", () => {
    expect(numeFisierSigur("fisa-evaluare-<script>alert(1)</script>")).toBe(
      "fisa-evaluare-script-alert-1-script",
    );
    expect(numeFisierSigur("pontaj--2026---10")).toBe("pontaj-2026-10");
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

  it("descărcarea nu intră în niciun cache comun: poate purta nume de angajați", async () => {
    const r = await raspunsDocument(DOC, "pdf");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("nicio rută de unealtă nu mai declară cache public", () => {
    const rute = readdirSync("src/app/api/unelte", { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith("route.ts"))
      .map((f) => readFileSync(join("src/app/api/unelte", f), "utf8"));
    expect(rute.length).toBeGreaterThanOrEqual(2);
    expect(rute.filter((s) => /cache-control["']?\s*:\s*["']public/iu.test(s))).toEqual([]);
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

/**
 * Parserul XML strict pe care îl folosește și exceljs. Respinge orice caracter
 * din afara producției `Char` din XML 1.0, exact ca Word. `happy-dom` NU e o
 * poartă aici: acceptă U+000B fără nicio eroare (verificat pe 8 oct 2026).
 */
function eroriXml(xml: string): readonly string[] {
  const erori: string[] = [];
  const parser = new SaxesParser({ xmlns: true });
  parser.on("error", (eroare) => {
    erori.push(eroare.message);
  });
  parser.write(xml).close();
  return erori;
}

/** Text lipit din Word, PowerPoint sau un PDF: rândul manual U+000B, NUL, BOM. */
const MURDAR: DocumentTabelar = {
  ...DOC,
  titlu: "Condica\u000Bde prezență",
  subtitlu: "Firma\u000CSRL",
  campuri: [{ eticheta: "Angajat", valoare: "Popa\u0000Ion\u0001\u001F\u007F\u{FFFE}\u{FFFF}" }],
  paragrafe: [`Text\u0008 lipit${String.fromCodePoint(0x2028)}din Word`],
  randuri: [["01.10.2026", "Ana\u001FB", "\u{200B}"]],
  note: ["Notă\u{85}finală"],
  semnaturi: ["Întocmit\u0002"],
};

describe("caracterele de control (auditul din 8 oct 2026)", () => {
  it("curataText scoate ce rupe XML-ul și păstrează rândul nou și diacriticele", () => {
    expect(curataText("Popa\u0000Ion")).toBe("PopaIon");
    expect(curataText("Popa\u000BIon")).toBe("Popa Ion");
    expect(curataText("Popa\tIon")).toBe("Popa Ion");
    expect(curataText("a\r\nb\rc")).toBe("a\nb\nc");
    expect(curataText("\u{200B}\u{FEFF}")).toBe("");
    expect(curataText("x\u{FFFE}y\u{FFFF}")).toBe("xy");
    expect(curataText(`L${String.fromCodePoint(0x2028)}S`)).toBe("L S");
    expect(curataText(`orfan${String.fromCharCode(0xd800)}`)).toBe("orfan");
    expect(curataText("Ștefan Țepeș, Ână Îî\n1\nM")).toBe("Ștefan Țepeș, Ână Îî\n1\nM");
  });

  it("curataDocument atinge fiecare text al documentului", () => {
    const d = curataDocument(MURDAR);
    const toate = [
      d.titlu,
      d.subtitlu ?? "",
      ...d.campuri.flatMap((c) => [c.eticheta, c.valoare]),
      ...d.paragrafe,
      ...d.coloane.map((c) => c.eticheta),
      ...d.randuri.flat(),
      ...d.note,
      ...d.semnaturi,
    ].join("|");
    expect(toate).not.toMatch(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u{FFFE}\u{FFFF}\u{200B}]/u,
    );
    expect(d.titlu).toBe("Condica de prezență");
    expect(d.umbrite).toEqual(MURDAR.umbrite);
    expect(d.numeFisier).toBe(MURDAR.numeFisier);
  });

  it("controlul: fără curățare, același Word NU e XML valid (parserul chiar vede)", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(MURDAR));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(eroriXml(xml).length).toBeGreaterThan(0);
  });

  it("Word-ul descărcat rămâne XML valid oricât de murdar e textul", async () => {
    const r = await raspunsDocument(MURDAR, "docx");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    for (const parte of ["word/document.xml", "docProps/core.xml"]) {
      const xml = (await zip.file(parte)?.async("string")) ?? "";
      expect(xml, parte).not.toBe("");
      expect(eroriXml(xml), parte).toEqual([]);
    }
    const document = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(document).toContain("Condica de prezență");
    expect(document).toContain("PopaIon");
  });

  it("PDF-ul și Excelul ies și ele din același document", async () => {
    const pdf = await raspunsDocument(MURDAR, "pdf");
    expect((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount()).toBeGreaterThan(0);
    const xlsx = await JSZip.loadAsync(await (await raspunsDocument(MURDAR, "xlsx")).arrayBuffer());
    const siruri = (await xlsx.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(eroriXml(siruri)).toEqual([]);
  });
});
