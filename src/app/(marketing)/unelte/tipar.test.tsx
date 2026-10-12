import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PaginaCerere from "./cerere-concediu-de-odihna/page";
import PaginaCondica from "./condica-de-prezenta/page";
import PaginaFisaEvaluare from "./fisa-evaluare/page";
import PaginaFisaSsm from "./fisa-instruire-ssm/page";
import PaginaFoaieParcurs from "./foaie-de-parcurs/page";
import PaginaFoaie from "./foaie-de-pontaj/page";

const GOL = { searchParams: Promise.resolve({}) };

/**
 * Pe fiecare unealtă cu document, la tipar rămâne DOAR `#documentul`: nici
 * antetul, nici formularul, nici benzile de explicații, nici subsolul. Testul
 * randează pagina reală (funcție async, fără bază de date) și verifică
 * marcajele; CSS-ul care le ascunde e verificat în browser (sonda și e2e).
 *
 * Plafonul de 20 s: fiecare pagină se randează întreagă în happy-dom (0,6–2,3 s
 * măsurat sub încărcarea suitei, la verificarea planului din 8 oct 2026).
 */
describe("tipărirea uneltelor", { timeout: 20_000 }, () => {
  it.each([
    ["foaie-de-pontaj", PaginaFoaie],
    ["condica-de-prezenta", PaginaCondica],
    ["foaie-de-parcurs", PaginaFoaieParcurs],
    ["fisa-instruire-ssm", PaginaFisaSsm],
    ["fisa-evaluare", PaginaFisaEvaluare],
    ["cerere-concediu-de-odihna", PaginaCerere],
  ] as const)("%s: la tipar rămâne doar documentul", async (_slug, Pagina) => {
    const { container } = render(await Pagina(GOL));
    const vizibile = [...container.querySelectorAll("section, header, footer")]
      .filter((e) => e.closest('[data-tipar="ascunde"]') === null)
      .filter((e) => e.id === "documentul" || e.closest("#documentul") === null)
      .map((e) => e.id || e.tagName.toLowerCase());
    expect(vizibile).toEqual(["documentul"]);
  });

  it("foaia de pontaj cere pagina A4 culcată", async () => {
    const { container } = render(await PaginaFoaie(GOL));
    expect(container.querySelector("#documentul figure")?.getAttribute("data-tipar-pagina")).toBe(
      "peisaj",
    );
  });

  it("previzualizarea urmează orientarea documentului", async () => {
    const parcurs = render(await PaginaFoaieParcurs(GOL));
    expect(
      parcurs.container.querySelector("#documentul figure")?.getAttribute("data-tipar-pagina"),
    ).toBe("peisaj");
    const condica = render(await PaginaCondica(GOL));
    expect(
      condica.container.querySelector("#documentul figure")?.hasAttribute("data-tipar-pagina"),
    ).toBe(false);
  });
});
