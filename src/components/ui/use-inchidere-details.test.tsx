// src/components/ui/use-inchidere-details.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, type ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { useInchidereDetails } from "./use-inchidere-details";

/**
 * Un `<details>` se închide nativ doar prin clic pe propriul `summary`. Meniul
 * contului rămânea deschis după Escape și după un clic în pagină, acoperind
 * butoanele din dreapta-sus (UX-041). Hook-ul adaugă cele două ieșiri pe care
 * le așteaptă oricine a folosit vreodată un meniu.
 */
function Proba(): ReactElement {
  const panou = useRef<HTMLDetailsElement | null>(null);
  useInchidereDetails(panou);
  return (
    <div>
      <p>În afara meniului</p>
      <details ref={panou} data-testid="panou">
        <summary>Contul meu</summary>
        <button type="button">Înăuntru</button>
      </details>
    </div>
  );
}

function deschide(): HTMLDetailsElement {
  const details = screen.getByTestId("panou") as HTMLDetailsElement;
  details.open = true;
  return details;
}

describe("useInchidereDetails", () => {
  it("Escape închide panoul și readuce focusul pe summary", () => {
    render(<Proba />);
    const details = deschide();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(screen.getByText("Contul meu"));
  });

  it("altă tastă decât Escape nu închide", () => {
    render(<Proba />);
    const details = deschide();

    fireEvent.keyDown(document, { key: "Enter" });

    expect(details.open).toBe(true);
  });

  it("Escape cu panoul închis nu mută focusul", () => {
    render(<Proba />);
    const buton = screen.getByText("În afara meniului");
    buton.setAttribute("tabindex", "-1");
    buton.focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(buton);
  });

  it("un clic în afara panoului îl închide", () => {
    render(<Proba />);
    const details = deschide();

    fireEvent.pointerDown(screen.getByText("În afara meniului"));

    expect(details.open).toBe(false);
  });

  it("un clic înăuntrul panoului nu-l închide", () => {
    render(<Proba />);
    const details = deschide();

    fireEvent.pointerDown(screen.getByText("Înăuntru"));

    expect(details.open).toBe(true);
  });
});
