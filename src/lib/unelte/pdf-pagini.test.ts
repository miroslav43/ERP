import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { textAntetRulant, textPagina, type DocumentTabelar } from "./document-tabelar";
import { latimiColoane, randeazaPdf, randeazaPdfMultiplu } from "./pdf";

/**
 * Auditul din 8 oct 2026, pe condică: chenar #D9DBE0 de 0,5 pt, rânduri de
 * 16 pt (5,6 mm) pentru semnătură, iar pagina 2+ fără lună, fără firmă și fără
 * număr de pagină. Fișa individuală de pontaj cere, în plus, mai multe
 * documente într-un singur PDF: câte o fișă pe angajat.
 */
function baza(randuri: number, extra: Partial<DocumentTabelar> = {}): DocumentTabelar {
  return {
    titlu: "Condica de prezență — decembrie 2026",
    subtitlu: "Construct SRL",
    campuri: [],
    paragrafe: [],
    coloane: [
      { eticheta: "Data", latime: 2 },
      { eticheta: "Nume", latime: 6 },
      { eticheta: "Semnătura", latime: 3 },
    ],
    randuri: Array.from({ length: randuri }, (_, i) => [String(i + 1), "Popa Ion", ""]),
    umbrite: [],
    note: [],
    semnaturi: [],
    orientare: "portret",
    numeFisier: "proba",
    ...extra,
  };
}

const pagini = async (octeti: Uint8Array) => (await PDFDocument.load(octeti)).getPageCount();

describe("textele de pe marginea paginii", () => {
  it("„Pagina X din Y” doar când documentul are mai multe pagini", () => {
    expect(textPagina(0, 1)).toBeNull();
    expect(textPagina(1, 3)).toBe("Pagina 2 din 3");
  });

  it("antetul rulant are titlul și, când există, subtitlul", () => {
    expect(textAntetRulant(baza(1))).toBe("Condica de prezență — decembrie 2026 · Construct SRL");
    expect(textAntetRulant(baza(1, { subtitlu: null }))).toBe(
      "Condica de prezență — decembrie 2026",
    );
  });
});

describe("randarea PDF", () => {
  it("rândurile de semnătură, de 22 pt, cer mai multe pagini decât cele de 16 pt", async () => {
    const joase = await pagini(await randeazaPdf(baza(80)));
    const inalte = await pagini(await randeazaPdf(baza(80, { inaltimeRand: 22 })));
    expect(inalte).toBeGreaterThan(joase);
  });

  it("mai multe documente intră în același fișier, fiecare de la pagină nouă", async () => {
    expect(await pagini(await randeazaPdfMultiplu([baza(5), baza(5)]))).toBe(2);
    const lung = await pagini(await randeazaPdf(baza(80)));
    expect(await pagini(await randeazaPdfMultiplu([baza(80), baza(5)]))).toBe(lung + 1);
  });

  it("fără documente refuză, nu produce un PDF gol", async () => {
    await expect(randeazaPdfMultiplu([])).rejects.toThrow(/Niciun document/u);
  });

  it("lățimile coloanelor umplu exact lățimea utilă a paginii", () => {
    const portret = latimiColoane(baza(1)).reduce((s, w) => s + w, 0);
    expect(portret).toBeCloseTo(595.28 - 2 * 40, 6);
    const peisaj = latimiColoane(baza(1, { orientare: "peisaj" })).reduce((s, w) => s + w, 0);
    expect(peisaj).toBeCloseTo(841.89 - 2 * 40, 6);
  });
});
