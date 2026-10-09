import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { PrevizualizareDocument } from "./previzualizare-document";

/**
 * Previzualizarea promite „ce vede omul pe ecran e ce descarcă”
 * (`document-tabelar.ts`). Auditul din 8 oct 2026 a găsit-o oprită la note:
 * fără semnăturile pe care PDF-ul și Word-ul le aveau. Rubricile și data la
 * semnături ale fișei de evaluare trebuie să apară și aici.
 */
const DOC: DocumentTabelar = {
  titlu: "Fișa de evaluare a performanțelor profesionale",
  subtitlu: null,
  campuri: [],
  paragrafe: [],
  coloane: [
    { eticheta: "Criteriu", latime: 6.5, rupe: true },
    { eticheta: "Pondere\n(%)", latime: 1.5 },
  ],
  randuri: [["Calitatea muncii", "100"]],
  umbrite: [],
  note: ["Scala notelor: 1 — mult sub cerințele postului."],
  semnaturi: ["Evaluator", "Angajat — am luat la cunoștință"],
  orientare: "portret",
  numeFisier: "fisa",
};

describe("previzualizarea documentului", () => {
  it("arată semnăturile din fișier, la orice unealtă", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    const semnaturi = container.querySelector("[data-semnaturi]");
    expect(semnaturi?.textContent).toContain("Evaluator");
    expect(semnaturi?.textContent).toContain("Angajat — am luat la cunoștință");
    expect(semnaturi?.textContent).not.toContain("Data:");
  });

  it("fără semnături, nu randează rândul gol", () => {
    const { container } = render(<PrevizualizareDocument document={{ ...DOC, semnaturi: [] }} />);
    expect(container.querySelector("[data-semnaturi]")).toBeNull();
  });

  it("rubricile, data la semnături și rândurile înalte, când documentul le are", () => {
    const { container } = render(
      <PrevizualizareDocument
        document={{
          ...DOC,
          dataLaSemnaturi: true,
          inaltimeRand: 26,
          rubrici: [
            { titlu: "Obiective pentru perioada următoare", text: "Raport lunar", randuriGoale: 4 },
            { titlu: "Comentariile angajatului", text: "", randuriGoale: 4 },
          ],
        }}
      />,
    );
    const rubrici = [...container.querySelectorAll("[data-rubrica]")];
    expect(rubrici.map((r) => r.firstElementChild?.textContent)).toEqual([
      "Obiective pentru perioada următoare",
      "Comentariile angajatului",
    ]);
    expect(rubrici[0]?.textContent).toContain("Raport lunar");
    // Rubrica goală are cele patru rânduri de scris; cea completată, unul.
    expect(rubrici.map((r) => r.querySelectorAll("div[aria-hidden]").length)).toEqual([1, 4]);
    const semnaturi = container.querySelector("[data-semnaturi]")?.textContent ?? "";
    expect(semnaturi.match(/Data:/gu)).toHaveLength(2);
    expect(container.querySelector("tbody td")?.className).toContain("h-10");
  });
});
