import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { arePrinGeam, PrinGeam } from "./prin-geam";

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
  it("știe pentru care module există vitrină", () => {
    expect(arePrinGeam("leave")).toBe(true);
    expect(arePrinGeam("courses")).toBe(false);
  });

  it("încadrează vitrina leneș, cu titlu și raport de aspect fix", () => {
    const { container } = render(<PrinGeam cheie="leave" titlu="Concedii" />);
    const cadru = container.querySelector("iframe");

    expect(cadru).not.toBeNull();
    expect(cadru?.getAttribute("src")).toBe("/vitrina/leave");
    expect(cadru?.getAttribute("loading")).toBe("lazy");
    expect(cadru?.getAttribute("title")).toMatch(/Concedii/);
    // Fără raport fix, iframe-ul sosește târziu și împinge pagina: CLS garantat.
    expect(container.querySelector("figure")?.getAttribute("style") ?? "").toMatch(/aspect-ratio/);
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
