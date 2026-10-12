import { PDFPage, type PDFPageDrawTextOptions } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentTabelar } from "./document-tabelar";
import { randeazaPdf } from "./pdf";

/**
 * Antetul foii de parcurs are 12 câmpuri (8 oct 2026). Pe o coloană, ocupau o
 * treime din prima pagină culcată; pe două, jumătate din înălțime.
 */
const CAMPURI = Array.from({ length: 8 }, (_, i) => ({
  eticheta: `Câmpul ${String(i + 1)}`,
  valoare: i === 7 ? "" : `valoarea ${String(i + 1)}`,
}));

const DOC: DocumentTabelar = {
  titlu: "Foaie de parcurs — octombrie 2026",
  subtitlu: null,
  campuri: CAMPURI,
  paragrafe: [],
  coloane: [],
  randuri: [],
  umbrite: [],
  note: [],
  semnaturi: [],
  orientare: "peisaj",
  numeFisier: "foaie",
};

type Desen = Readonly<{ text: string; x: number; y: number }>;

function spioneaza(): Desen[] {
  const desene: Desen[] = [];
  vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (
    this: PDFPage,
    text: string,
    optiuni?: PDFPageDrawTextOptions,
  ) {
    desene.push({ text, x: optiuni?.x ?? 0, y: optiuni?.y ?? 0 });
  });
  return desene;
}

const alCampului = (desene: readonly Desen[], n: number) =>
  desene.find((d) => d.text.startsWith(`Câmpul ${String(n)}:`));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("câmpurile antetului în PDF", { timeout: 30_000 }, () => {
  it("pe două coloane: perechile stau pe același rând, a doua la jumătatea paginii", async () => {
    const desene = spioneaza();
    await randeazaPdf({ ...DOC, campuriPeDouaColoane: true });
    const [unu, doi, trei] = [1, 2, 3].map((n) => alCampului(desene, n));
    expect(unu?.y).toBe(doi?.y);
    expect(doi?.x).toBeGreaterThan(300);
    expect(trei?.x).toBe(unu?.x);
    expect(trei?.y).toBeLessThan(unu?.y ?? 0);
    expect(alCampului(desene, 8)?.text).toBe("Câmpul 8: ______________________________");
  });

  it("fără opțiune rămân pe o coloană, ca la celelalte unelte", async () => {
    const desene = spioneaza();
    await randeazaPdf(DOC);
    const x = new Set(CAMPURI.map((_, i) => alCampului(desene, i + 1)?.x));
    expect(x.size).toBe(1);
  });

  it("un câmp lung se rupe pe rânduri în coloana lui, fără să calce perechea următoare", async () => {
    const desene = spioneaza();
    const lung = { eticheta: "Câmpul 1", valoare: "cuvânt ".repeat(40).trim() };
    await randeazaPdf({ ...DOC, campuri: [lung, ...CAMPURI.slice(1)], campuriPeDouaColoane: true });
    const coloanaStanga = desene.filter(
      (d) => d.x === alCampului(desene, 1)?.x && d.text.includes("cuvânt"),
    );
    expect(coloanaStanga.length).toBeGreaterThan(1);
    const ultimaLinie = Math.min(...coloanaStanga.map((d) => d.y));
    expect(alCampului(desene, 3)?.y ?? Infinity).toBeLessThan(ultimaLinie);
  });
});
