import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { PrevizualizareDocument } from "./previzualizare-document";

const DOC: DocumentTabelar = {
  titlu: "Fișă de instruire individuală",
  subtitlu: null,
  campuri: [],
  paragrafe: [],
  coloane: [],
  randuri: [],
  umbrite: [],
  note: ["Notă finală."],
  semnaturi: [],
  orientare: "portret",
  numeFisier: "fisa",
  sectiuni: [
    {
      tip: "text",
      titlu: "Instruirea la angajare",
      paragrafe: ["1) Instruirea introductiv-generală\u000Ba fost efectuată."],
      semnaturi: ["Semnătura celui instruit", "Semnătura celui care a efectuat instruirea"],
    },
    {
      tip: "tabel",
      titlu: "Instruirea periodică",
      coloane: [
        { eticheta: "Data\ninstruirii", latime: 2 },
        { eticheta: "Ocupația", latime: 2 },
      ],
      randuri: [
        ["", "Electrician"],
        ["", "Electrician"],
      ],
      inaltimeRand: 28,
    },
    {
      tip: "casete",
      titlu: "Control medical periodic",
      numar: 3,
      rubrica: "Observații de specialitate",
      semnaturi: ["Semnătura și parafa medicului", "Data vizei"],
      nota: "* notă",
    },
  ],
};

/** Ce vede omul pe ecran e ce descarcă: aceleași secțiuni, în aceeași ordine. */
describe("previzualizarea unui document cu secțiuni", () => {
  it("arată titlurile secțiunilor, în ordine, înaintea notelor", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const titluri = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(titluri).toEqual([
      "Instruirea la angajare",
      "Instruirea periodică",
      "Control medical periodic",
    ]);
    const text = container.textContent ?? "";
    expect(text.indexOf("Control medical periodic")).toBeLessThan(text.indexOf("Notă finală."));
    expect(text).toContain("introductiv-generală a fost efectuată");
  });

  it("are rubricile de semnătură, rândurile înalte și câte o casetă pe viză", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Semnătura celui care a efectuat instruirea");
    const celule = [...container.querySelectorAll("tbody td")] as HTMLElement[];
    expect(celule).toHaveLength(4);
    for (const td of celule) expect(td.style.height).toBe("28pt");
    expect(text.match(/Observații de specialitate/gu)).toHaveLength(3);
    expect(text).toContain("* notă");
  });

  it("un document fără secțiuni arată ca înainte", () => {
    const { container } = render(
      <PrevizualizareDocument
        document={{
          ...DOC,
          sectiuni: [],
          coloane: [{ eticheta: "Nume", latime: 1 }],
          randuri: [["Ana"]],
        }}
      />,
    );
    expect(container.querySelectorAll("h3")).toHaveLength(0);
    const td = container.querySelector("tbody td") as HTMLElement | null;
    expect(td?.style.height).toBe("");
  });
});
