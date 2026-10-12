import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PaginaCondica from "./condica-de-prezenta/page";
import PaginaFoaieParcurs from "./foaie-de-parcurs/page";
import PaginaFoaie from "./foaie-de-pontaj/page";

const SAPTEZECI = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");

/**
 * Textul avizului (`role="status"`) sau "" dacă lipsește.
 *
 * `querySelector`, nu `getByRole`: condica cu 60 de nume are 1.260 de rânduri,
 * iar `getByRole` calculează rolul accesibil al fiecărui nod. Măsurat la
 * verificarea planului (8 oct 2026): cu `getByRole`, testul condicii a căzut cu
 * „Test timed out in 5000ms” când rula în paralel cu restul `src/app/(marketing)`.
 */
function aviz(container: HTMLElement): string {
  return container.querySelector('[role="status"]')?.textContent ?? "";
}

/**
 * Pagina spune ce a schimbat din ce a primit. Înainte, cu 70 de nume, foaia
 * avea 60 de rânduri și niciun semn (auditul din 8 oct 2026).
 *
 * Plafonul de 20 s: o pagină cu 60 de nume randată în happy-dom a durat 1–8 s
 * sub încărcarea suitei complete.
 */
describe("avizele de pe paginile uneltelor", { timeout: 20_000 }, () => {
  it("foaia de pontaj spune că a păstrat 60 din 70", async () => {
    const { container } = render(
      await PaginaFoaie({
        searchParams: Promise.resolve({ an: "2026", luna: "12", angajati: SAPTEZECI }),
      }),
    );
    expect(aviz(container)).toContain("Am păstrat primii 60 din 70 de angajați");
  });

  it("condica la fel", async () => {
    const { container } = render(
      await PaginaCondica({
        searchParams: Promise.resolve({ an: "2026", luna: "12", angajati: SAPTEZECI }),
      }),
    );
    expect(aviz(container)).toContain("Am păstrat primii 60 din 70 de angajați");
  });

  it("fără nimic de corectat, niciun aviz", async () => {
    const { container } = render(
      await PaginaFoaie({
        searchParams: Promise.resolve({ an: "2026", luna: "12", angajati: "Popa Ion" }),
      }),
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("foaia de pontaj spune când anul și luna din adresă au fost corectate", async () => {
    const { container } = render(
      await PaginaFoaie({ searchParams: Promise.resolve({ an: "1999", luna: "13" }) }),
    );
    expect(aviz(container)).toContain("Anul „1999” nu e un an între 2020 și 2035");
    expect(aviz(container)).toContain("Luna „13” nu e între 1 și 12");
  });

  it("condica și foaia de parcurs la fel", async () => {
    const condica = render(await PaginaCondica({ searchParams: Promise.resolve({ an: "abc" }) }));
    expect(aviz(condica.container)).toContain("Anul „abc”");
    condica.unmount();
    const parcurs = render(
      await PaginaFoaieParcurs({ searchParams: Promise.resolve({ luna: "0" }) }),
    );
    expect(aviz(parcurs.container)).toContain("Luna „0” nu e între 1 și 12");
  });
});
