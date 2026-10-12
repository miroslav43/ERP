import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RO } from "@/content/landing/ro";

import { Banda } from "./banda";
import { BaraConsimtamant } from "./bara-consimtamant";
import { Cadru } from "./cadru";

/**
 * Pe 8 oct 2026, foaia de pontaj tipărită din browser ieșea pe 5 pagini A4, cu
 * meniul, bara de cookie-uri și subsolul. Regula `[data-tipar="ascunde"]` exista
 * în globals.css, dar n-o purta niciuna dintre bucățile astea.
 */
describe("tipărirea paginilor publice", () => {
  it("antetul și subsolul cadrului nu se tipăresc; conținutul da", () => {
    const { container } = render(
      <Cadru text={RO}>
        <p>documentul</p>
      </Cadru>,
    );
    expect(container.querySelector("header")?.getAttribute("data-tipar")).toBe("ascunde");
    expect(container.querySelector("footer")?.getAttribute("data-tipar")).toBe("ascunde");
    expect(container.querySelector("main")?.closest('[data-tipar="ascunde"]')).toBeNull();
  });

  it("Banda pune marcajul pe <section>, și doar când e cerut", () => {
    const { container } = render(
      <>
        <Banda id="ascunsa" titlu="De ce" data-tipar="ascunde" />
        <Banda id="documentul" />
      </>,
    );
    expect(container.querySelector("#ascunsa")?.getAttribute("data-tipar")).toBe("ascunde");
    expect(container.querySelector("#documentul")?.hasAttribute("data-tipar")).toBe(false);
  });

  it("bara de cookie-uri nu se tipărește", async () => {
    localStorage.clear();
    render(<BaraConsimtamant />);
    const bara = await screen.findByRole("region", { name: "Cookie-uri de analiză" });
    expect(bara.getAttribute("data-tipar")).toBe("ascunde");
  });
});
