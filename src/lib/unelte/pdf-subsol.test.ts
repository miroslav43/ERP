import { PDFDocument, PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SEMNATURA_FISIER, type DocumentTabelar } from "./document-tabelar";
import { inlocuiesteGlifeLipsa, randeazaPdf } from "./pdf";

/**
 * Auditul din 8 oct 2026, pe PDF-ul foii de parcurs: rândul „Generat gratuit
 * cu administrativo.ro” și legătura lui apăreau doar pe ULTIMA pagină, iar un
 * emoji sau o ideogramă ieșeau pătrățele goale.
 */
const LUNG: DocumentTabelar = {
  titlu: "Foaie de parcurs — octombrie 2026",
  subtitlu: null,
  campuri: [{ eticheta: "Conducător auto", valoare: "Popa 🚗 Ion 中" }],
  paragrafe: [],
  coloane: [
    { eticheta: "Data", latime: 2 },
    { eticheta: "Traseul", latime: 6 },
  ],
  randuri: Array.from({ length: 90 }, (_, i) => [`${String(i + 1)}.10.2026`, "Sediu – Client"]),
  umbrite: [],
  note: [],
  semnaturi: ["Conducător auto", "Verificat"],
  orientare: "peisaj",
  numeFisier: "foaie",
  sursa: "/unelte/foaie-de-parcurs",
};

type Desen = Readonly<{ pagina: PDFPage; text: string }>;

/** Ce se desenează și pe ce pagină; `drawText` e singurul drum spre pagină. */
function spioneaza(): Desen[] {
  const desene: Desen[] = [];
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
    this: PDFPage,
    text: string,
  ) {
    desene.push({ pagina: this, text });
  });
  return desene;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PDF pe mai multe pagini", { timeout: 30_000 }, () => {
  it("rândul de jos apare o dată pe fiecare pagină, cu numărul paginii", async () => {
    const desene = spioneaza();
    const citit = await PDFDocument.load(await randeazaPdf(LUNG));
    const total = citit.getPageCount();
    expect(total).toBeGreaterThan(2);
    const cuSemnatura = desene.filter((d) => d.text === SEMNATURA_FISIER).map((d) => d.pagina);
    expect(new Set(cuSemnatura).size).toBe(total);
    expect(cuSemnatura).toHaveLength(total);
    expect(desene.map((d) => d.text)).toContain(`Pagina ${String(total)} din ${String(total)}`);
  });

  it("fiecare pagină are adnotarea Link spre unealtă", async () => {
    const citit = await PDFDocument.load(await randeazaPdf(LUNG));
    for (const pagina of citit.getPages()) {
      expect(pagina.node.Annots()?.size()).toBe(1);
    }
  });

  it("pe o singură pagină nu apare „Pagina 1 din 1”", async () => {
    const desene = spioneaza();
    await randeazaPdf({ ...LUNG, randuri: LUNG.randuri.slice(0, 3) });
    expect(desene.map((d) => d.text).filter((t) => t.startsWith("Pagina "))).toEqual([]);
  });
});

describe("glifele lipsă", { timeout: 30_000 }, () => {
  it("emoji și ideograme devin „?”, diacriticele rămân", async () => {
    const desene = spioneaza();
    await randeazaPdf(LUNG);
    expect(desene.map((d) => d.text)).toContain("Conducător auto: Popa ? Ion ?");
  });

  it("inlocuiesteGlifeLipsa păstrează rândul nou și scoate selectorii de variantă", () => {
    const are = (cod: number) => cod < 0x2000;
    expect(inlocuiesteGlifeLipsa("a\nb", are)).toBe("a\nb");
    expect(inlocuiesteGlifeLipsa("Ș❤️x", are)).toBe("Ș?x");
    expect(inlocuiesteGlifeLipsa("🚗🚗", are)).toBe("??");
  });
});
