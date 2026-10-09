import JSZip from "jszip";
import { PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { curataDocument, mapeazaTexte, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { randeazaPdf } from "./pdf";
import { randeazaXlsx } from "./xlsx";

/**
 * Tabelele de după tabelul principal (8 oct 2026): foaia de parcurs are nevoie
 * de alimentări și de un rezumat al lunii, cu coloanele lor, în toate cele trei
 * formate și în previzualizare.
 */
const BAZA: DocumentTabelar = {
  titlu: "Foaie de parcurs — octombrie 2026",
  subtitlu: null,
  campuri: [{ eticheta: "Nr. de înmatriculare", valoare: "B-123-ABC" }],
  paragrafe: [],
  coloane: [
    { eticheta: "Data", latime: 2 },
    { eticheta: "Traseul", latime: 6 },
  ],
  randuri: [["01.10.2026", "Sediu – Client"]],
  umbrite: [],
  tabeleSuplimentare: [
    {
      titlu: "Alimentări cu combustibil",
      coloane: [
        { eticheta: "Nr. bon", latime: 2 },
        { eticheta: "Stația (furnizorul)", latime: 4 },
      ],
      randuri: [["BF-7781", "Stația Ștefănești"]],
    },
    {
      titlu: "Rezumatul lunii",
      coloane: [
        { eticheta: "Indicator", latime: 6 },
        { eticheta: "Valoare", latime: 2 },
      ],
      randuri: [["Total km parcurși în lună", "1.234"]],
    },
  ],
  note: [],
  semnaturi: [],
  orientare: "peisaj",
  numeFisier: "foaie",
};

const { tabeleSuplimentare: TABELE, ...FARA_TABELE } = BAZA;

/** Textele desenate în PDF, în ordine; `drawText` e singurul drum spre pagină. */
function textePdf(): { texte: string[]; opreste: () => void } {
  const texte: string[] = [];
  const spion = vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
    this: PDFPage,
    text: string,
  ) {
    texte.push(text);
  });
  return { texte, opreste: () => spion.mockRestore() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tabelele suplimentare în model", () => {
  it("mapeazaTexte atinge titlul, etichetele și celulele lor, nu și lățimile", () => {
    const d = mapeazaTexte(BAZA, (t) => t.toUpperCase());
    expect(d.tabeleSuplimentare?.[0]?.titlu).toBe("ALIMENTĂRI CU COMBUSTIBIL");
    expect(d.tabeleSuplimentare?.[0]?.coloane[1]).toEqual({
      eticheta: "STAȚIA (FURNIZORUL)",
      latime: 4,
    });
    expect(d.tabeleSuplimentare?.[1]?.randuri[0]).toEqual(["TOTAL KM PARCURȘI ÎN LUNĂ", "1.234"]);
  });

  it("un document fără tabele suplimentare rămâne fără cheie", () => {
    expect(TABELE).toHaveLength(2);
    expect("tabeleSuplimentare" in mapeazaTexte(FARA_TABELE, (t) => t)).toBe(false);
  });

  it("curataDocument curăță și celulele tabelelor suplimentare", () => {
    const murdar = mapeazaTexte(BAZA, (t) => `${t}\u000B\u0000`);
    expect(curataDocument(murdar).tabeleSuplimentare?.[0]?.randuri[0]).toEqual([
      "BF-7781 ",
      "Stația Ștefănești ",
    ]);
  });
});

describe("tabelele suplimentare în fișiere", { timeout: 60_000 }, () => {
  it("PDF: titlul, antetul și celulele fiecărui tabel ajung pe pagină, după tabelul principal", async () => {
    const { texte, opreste } = textePdf();
    await randeazaPdf(BAZA);
    opreste();
    const ordine = [
      "Sediu – Client",
      "Alimentări cu combustibil",
      "Stația (furnizorul)",
      "Stația Ștefănești",
      "Rezumatul lunii",
      "1.234",
    ].map((t) => texte.indexOf(t));
    expect(ordine.every((i) => i >= 0)).toBe(true);
    expect([...ordine].sort((a, b) => a - b)).toEqual(ordine);
  });

  it("PDF: un tabel scurt nu se rupe între pagini, oricât de jos ar începe", async () => {
    const pagini: PDFPage[] = [];
    const texte: string[] = [];
    vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
      this: PDFPage,
      text: string,
    ) {
      texte.push(text);
      pagini.push(this);
    });
    const rezumat = BAZA.tabeleSuplimentare?.[1];
    if (rezumat === undefined) throw new Error("Lipsește rezumatul din BAZA.");
    const lung = {
      ...rezumat,
      randuri: Array.from({ length: 11 }, (_, i) => [`R${String(i)}`, ""]),
    };
    for (let n = 14; n <= 34; n += 2) {
      texte.length = 0;
      pagini.length = 0;
      await randeazaPdf({
        ...BAZA,
        randuri: Array.from({ length: n }, () => ["01.10.2026", "Sediu – Client"]),
        tabeleSuplimentare: [lung],
      });
      const pagina = (t: string) => pagini[texte.indexOf(t)];
      expect(texte, `${String(n)} rânduri`).toContain("R10");
      expect(pagina("Rezumatul lunii"), `${String(n)} rânduri`).toBe(pagina("R10"));
    }
  });

  it("PDF: fără tabele suplimentare nu apare niciun titlu în plus", async () => {
    const { texte, opreste } = textePdf();
    await randeazaPdf(FARA_TABELE);
    opreste();
    expect(texte).not.toContain("Alimentări cu combustibil");
  });

  it("Word: un tabel pe fiecare, cu antetul repetat pe pagină nouă", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(BAZA));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml.match(/<w:tbl>/gu)).toHaveLength(3);
    expect(xml.match(/<w:tblHeader\/>/gu)).toHaveLength(3);
    expect(xml.indexOf("Alimentări cu combustibil")).toBeGreaterThan(xml.indexOf("Sediu – Client"));
    expect(xml).toContain("Stația Ștefănești");
  });

  it("Excel: titlul și rândurile tabelelor, după cel principal", async () => {
    const zip = await JSZip.loadAsync(await randeazaXlsx(BAZA));
    const siruri = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    for (const t of [
      "Alimentări cu combustibil",
      "Stația (furnizorul)",
      "Rezumatul lunii",
      "1.234",
    ]) {
      expect(siruri).toContain(t);
    }
  });
});
