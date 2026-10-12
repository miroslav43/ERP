import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { documenteleFoii } from "./foaie-document";
import { construiestePontaj, parametriPontaj } from "./pontaj";
import { TabelColectiv } from "./tabel-colectiv";

/**
 * Auditul din 8 oct 2026: pe web, coloanele de zi aveau lățimi inegale — 1–9
 * cam 22 px, 10–31 cam 35 px — iar PDF-ul le avea egale. Tabelul de pe ecran
 * vine acum din ACELAȘI `DocumentTabelar` ca PDF-ul, cu `table-fixed`.
 */
describe("tabelul foii colective pe ecran", () => {
  const pontaj = construiestePontaj(
    parametriPontaj(
      new URLSearchParams({ an: "2026", luna: "12", angajati: "Popa Ion\nIlie Maria | 4" }),
    ),
  );
  const [document] = documenteleFoii(pontaj);

  it("are coloanele de zi fixe și egale", () => {
    const { container } = render(<TabelColectiv pontaj={pontaj} document={document} />);
    expect(container.querySelector("table")?.className).toContain("table-fixed");
    const latimi = [...container.querySelectorAll("col")].map((c) => c.getAttribute("style"));
    expect(latimi).toHaveLength(document.coloane.length);
    expect(new Set(latimi.slice(2, 2 + 31)).size).toBe(1);
  });

  it("marchează sărbătoarea în cap și arată aceleași celule ca PDF-ul", () => {
    const { container } = render(<TabelColectiv pontaj={pontaj} document={document} />);
    expect(container.querySelector('th[data-zi="1"]')?.getAttribute("title")).toBe(
      "Ziua Națională a României",
    );
    expect(container.querySelectorAll("th[data-zi]")).toHaveLength(31);
    const randuri = container.querySelectorAll("tbody tr");
    expect(randuri).toHaveLength(2);
    const celule = (i: number) =>
      [...(randuri[i]?.querySelectorAll("td") ?? [])].map((c) => c.textContent);
    expect(randuri[1]?.querySelector("th")?.textContent).toBe("Ilie Maria");
    expect(celule(1).slice(0, 2)).toEqual(["4", "SL"]); // h/zi, 1 decembrie
    expect(celule(0)[5]).toBe("L"); // 5 decembrie
  });
});
