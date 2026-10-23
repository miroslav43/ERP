// src/lib/unelte/subsol-aplicatie.test.ts
//
// A5: rândul „Generat gratuit cu administrativo.ro” (și legătura lui) stă DOAR
// pe fișierele uneltelor publice de la /unelte. Un export din aplicația plătită
// nu face reclamă pe fișierul clientului, pe niciun format. XLSX era deja
// reparat (`randeazaXlsx(d, { subsol })`, `lib/excel/raport-flota.test.ts`);
// aici PDF-ul și Word-ul, pe ambele căi.

import JSZip from "jszip";
import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SEMNATURA_FISIER, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx, randeazaDocxMultiplu } from "./docx";
import { randeazaPdf, randeazaPdfMultiplu } from "./pdf";
import { raspunsDocument, raspunsDocumente } from "./raspuns";

const DOC: DocumentTabelar = {
  titlu: "Raport lunar — octombrie 2026",
  subtitlu: "Firma Exemplu SRL",
  campuri: [{ eticheta: "Perioada", valoare: "1–31 octombrie 2026" }],
  paragrafe: [],
  coloane: [
    { eticheta: "Vehicul", latime: 3 },
    { eticheta: "Km", latime: 2 },
  ],
  randuri: Array.from({ length: 70 }, (_, i) => [`B ${String(100 + i)} ABC`, "1.200"]),
  umbrite: [],
  note: [],
  semnaturi: ["Întocmit"],
  orientare: "portret",
  numeFisier: "raport-octombrie-2026",
  sursa: "/unelte/foaie-de-parcurs",
};

/** Textele desenate în PDF; `drawText` e singurul drum spre pagină. */
function spioneazaTexte(): string[] {
  const texte: string[] = [];
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
    this: PDFPage,
    text: string,
  ) {
    texte.push(text);
  });
  return texte;
}

async function adnotari(octeti: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(octeti);
  return pdf.getPages().reduce((n, p) => n + (p.node.Annots()?.size() ?? 0), 0);
}

async function textWord(octeti: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(octeti);
  const parti = await Promise.all(
    Object.keys(zip.files)
      .filter((nume) => nume.startsWith("word/") && nume.endsWith(".xml"))
      .map(async (nume) => (await zip.file(nume)?.async("string")) ?? ""),
  );
  const relatii = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  return parti.join("\n") + relatii;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PDF — exportul din aplicație n-are subsolul uneltelor", { timeout: 30_000 }, () => {
  it("`subsol: aplicatie`: niciun rând „Generat gratuit…”, nicio legătură", async () => {
    const texte = spioneazaTexte();
    await randeazaPdf(DOC, { subsol: "aplicatie" });
    expect(texte).not.toContain(SEMNATURA_FISIER);
    vi.restoreAllMocks();
    expect(await adnotari(await randeazaPdf(DOC, { subsol: "aplicatie" }))).toBe(0);
  });

  it("implicit (o randare nouă care uită opțiunea) e tot fără reclamă", async () => {
    const texte = spioneazaTexte();
    await randeazaPdfMultiplu([DOC, DOC]);
    expect(texte).not.toContain(SEMNATURA_FISIER);
  });

  it("numerotarea paginilor rămâne", async () => {
    const texte = spioneazaTexte();
    await randeazaPdf(DOC, { subsol: "aplicatie" });
    expect(texte.some((t) => /^Pagina \d+ din \d+$/u.test(t))).toBe(true);
  });

  it("`subsol: unealta`: rândul apare pe fiecare pagină, cu legătură", async () => {
    const texte = spioneazaTexte();
    const octeti = await randeazaPdf(DOC, { subsol: "unealta" });
    vi.restoreAllMocks();
    const pagini = (await PDFDocument.load(octeti)).getPageCount();
    expect(texte.filter((t) => t === SEMNATURA_FISIER)).toHaveLength(pagini);
    expect(await adnotari(octeti)).toBe(pagini);
  });
});

describe("Word — exportul din aplicație n-are subsolul uneltelor", () => {
  it("`subsol: aplicatie` și implicit: fără rândul și fără hyperlink", async () => {
    for (const octeti of [
      await randeazaDocx(DOC, { subsol: "aplicatie" }),
      await randeazaDocxMultiplu([DOC, DOC]),
    ]) {
      const text = await textWord(octeti);
      expect(text).not.toContain(SEMNATURA_FISIER);
      expect(text).not.toContain("utm_source=fisier");
    }
  });

  it("`subsol: unealta`: rândul și legătura spre unealtă", async () => {
    const text = await textWord(await randeazaDocx(DOC, { subsol: "unealta" }));
    expect(text).toContain(SEMNATURA_FISIER);
    expect(text).toContain("utm_source=fisier");
  });
});

describe(
  "calea uneltelor publice (`raspuns.ts`) își păstrează subsolul",
  { timeout: 30_000 },
  () => {
    it("raspunsDocument: PDF și Word", async () => {
      const texte = spioneazaTexte();
      await raspunsDocument(DOC, "pdf");
      expect(texte).toContain(SEMNATURA_FISIER);
      vi.restoreAllMocks();
      const word = await raspunsDocument(DOC, "docx");
      expect(await textWord(new Uint8Array(await word.arrayBuffer()))).toContain(SEMNATURA_FISIER);
    });

    it("raspunsDocumente (fișele multiple): PDF și Word", async () => {
      const texte = spioneazaTexte();
      await raspunsDocumente([DOC, DOC], "pdf", "fise");
      expect(texte).toContain(SEMNATURA_FISIER);
      vi.restoreAllMocks();
      const word = await raspunsDocumente([DOC, DOC], "docx", "fise");
      expect(await textWord(new Uint8Array(await word.arrayBuffer()))).toContain(SEMNATURA_FISIER);
    });
  },
);
