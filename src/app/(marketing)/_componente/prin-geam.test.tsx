import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrinGeam } from "./prin-geam";

/**
 * `<dialog>` nu are `showModal()`/`close()` implementate în happy-dom —
 * `PrinGeam` le cheamă la deschidere/închidere, iar fără cârjă testul ar cădea
 * dintr-un motiv fără legătură cu ce verifică. Tiparul e copiat din
 * `src/app/(app)/pontaj/grila-saptamana.test.tsx:130-133`.
 */
beforeEach(() => {
  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  }
});

describe("banda prin geam", () => {
  // Catalogul (`arePrinGeam`) s-a mutat în `vitrine.ts` și e verificat acolo:
  // e apelat din graful de server, deci nu are voie să locuiască într-un fișier
  // `"use client"` ca acesta.

  it("încadrează vitrina leneș, cu titlu și raport de aspect fix", () => {
    const { container } = render(<PrinGeam cheie="leave" titlu="Concedii" />);
    const cadru = container.querySelector("iframe");

    expect(cadru).not.toBeNull();
    expect(cadru?.getAttribute("src")).toBe("/vitrina/leave");
    expect(cadru?.getAttribute("loading")).toBe("lazy");
    expect(cadru?.getAttribute("title")).toMatch(/Concedii/);
    // Fără raport fix, iframe-ul sosește târziu și împinge pagina: CLS garantat.
    // Raportul de aspect stă pe `div`-ul care înfășoară DOAR iframe-ul, nu pe
    // `<figure>` — vezi testul de mai jos pentru motivul structural.
    expect(cadru?.parentElement?.getAttribute("style") ?? "").toMatch(/aspect-ratio/);
  });

  it("avertismentul de sub cadru nu e strămoșit de elementul cu overflow-hidden", () => {
    /*
     * happy-dom nu calculează layout real (dimensiuni și poziții rămân 0),
     * deci un test de geometrie — cel folosit efectiv de revizor, cu CSS
     * compilat real randat în Chromium headless — nu e posibil aici. Ce SE
     * poate verifica e structura care garantează absența clipping-ului:
     * elementul cu `overflow-hidden` (care poartă și raportul de aspect fix)
     * nu trebuie să fie strămoșul lui `<figcaption>`. Dacă ar fi, iframe-ul
     * `h-full` ar umple tot content-box-ul fixat de `aspect-ratio`, iar
     * textul avertismentului — „Date fictive. Nimic din ce faci aici nu se
     * salvează." — ar fi împins sub marginea vizibilă și tăiat de
     * `overflow-hidden`. Regresie verificată empiric de revizor: la 600px
     * lățime, raport 16:10, 6,5px din text ieșeau din casetă.
     */
    const { container } = render(<PrinGeam cheie="leave" titlu="Concedii" />);
    const legenda = container.querySelector("figcaption");
    const cuOverflow = container.querySelector(".overflow-hidden");

    expect(legenda).not.toBeNull();
    expect(cuOverflow).not.toBeNull();
    expect(cuOverflow?.getAttribute("style") ?? "").toMatch(/aspect-ratio/);
    expect(legenda === null || cuOverflow === null ? false : cuOverflow.contains(legenda)).toBe(
      false,
    );
  });

  it("oferă o cale de deschidere accesibilă cu tastatura", () => {
    // Proiectul nu are `@testing-library/jest-dom` instalat, deci
    // `toBeInTheDocument()` nu există — convenția casei e `.not.toBeNull()`
    // pe rezultatul unui `queryBy*` (ex. `bara-filtre.test.tsx:137`).
    render(<PrinGeam cheie="leave" titlu="Concedii" />);
    expect(screen.queryByRole("button", { name: /Deschide/ })).not.toBeNull();
  });

  it("deschide caseta pe tot ecranul la clic, cu al doilea iframe creat abia atunci", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const utilizator = userEvent.setup();
    const { container } = render(<PrinGeam cheie="leave" titlu="Concedii" />);

    // Înainte de deschidere există un singur iframe — cel din passe-partout.
    expect(container.querySelectorAll("iframe")).toHaveLength(1);

    await utilizator.click(screen.getByRole("button", { name: /Deschide demonstrația/ }));

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    expect(container.querySelectorAll("iframe")).toHaveLength(2);
  });
});
