import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { PrevizualizareDocument } from "./previzualizare-document";

const DOC: DocumentTabelar = {
  titlu: "Condica\u000Bde prezență",
  subtitlu: "Firma\u0000 SRL",
  campuri: [],
  paragrafe: [],
  coloane: [{ eticheta: "Nume", latime: 1 }],
  randuri: [["Ana\u001FB"]],
  umbrite: [],
  note: [],
  semnaturi: [],
  orientare: "portret",
  numeFisier: "condica",
};

/** Ce vede omul pe ecran e ce primește în fișier, inclusiv după curățare. */
describe("previzualizarea documentului", () => {
  it("arată textul curățat, ca fișierele", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    expect(container.querySelector("figcaption")?.textContent).toContain("Condica de prezență");
    expect(container.textContent).toContain("Firma SRL");
    expect(container.textContent).toContain("AnaB");
    expect(container.textContent).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u);
  });
});
