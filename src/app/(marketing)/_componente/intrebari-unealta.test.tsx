import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IntrebariUnealta } from "./intrebari-unealta";

describe("lista de întrebări a unei unelte", () => {
  it("pune fiecare întrebare ca titlu, cu temeiul și legătura când există", () => {
    render(
      <IntrebariUnealta
        titlu="Ce se mai întreabă"
        intrebari={[
          { q: "Prima?", a: "Răspuns unu." },
          {
            q: "A doua?",
            a: "Răspuns doi.",
            temei: "art. 119 alin. (1) Codul muncii",
            legatura: { href: "?varianta=individuala#documentul", eticheta: "Fă fișele" },
          },
        ]}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Prima?",
      "A doua?",
    ]);
    expect(screen.getByText("art. 119 alin. (1) Codul muncii")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Fă fișele" }).getAttribute("href")).toBe(
      "?varianta=individuala#documentul",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
