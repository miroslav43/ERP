import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { PrevizualizareDocument } from "./previzualizare-document";

/**
 * Previzualizarea arată ce se descarcă: și tabelele de după cel principal
 * (alimentările și rezumatul foii de parcurs, din 8 oct 2026), fiecare cu
 * titlul și legenda lui, curățate ca în fișiere.
 */
const DOC: DocumentTabelar = {
  titlu: "Foaie de parcurs — octombrie 2026",
  subtitlu: null,
  campuri: [],
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
        { eticheta: "Cantitate\n(l)", latime: 2 },
      ],
      randuri: [["BF\u000B7781", ""]],
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

describe("previzualizarea tabelelor suplimentare", () => {
  it("fiecare tabel are legenda lui, în ordine, după tabelul principal", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const legende = [...container.querySelectorAll("table caption")].map((c) => c.textContent);
    expect(legende).toEqual([
      "Foaie de parcurs — octombrie 2026",
      "Alimentări cu combustibil",
      "Rezumatul lunii",
    ]);
  });

  it("antetul și celulele tabelului suplimentar sunt cele din model, curățate", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const alimentari = container.querySelectorAll("table")[1];
    expect(alimentari).toBeDefined();
    const t = within(alimentari as HTMLElement);
    expect(t.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Nr. bon",
      "Cantitate\n(l)",
    ]);
    expect(t.getAllByRole("cell")[0]?.textContent).toBe("BF 7781");
  });

  it("fără tabele suplimentare rămâne un singur tabel", () => {
    const { tabeleSuplimentare: _ignorat, ...fara } = DOC;
    const { container } = render(<PrevizualizareDocument document={fara} />);
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });
});
