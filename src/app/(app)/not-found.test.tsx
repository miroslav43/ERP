// src/app/(app)/not-found.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NegasitApp from "./not-found";

/**
 * Ce apără fișierul: 404-ul din interiorul aplicației (UX-043).
 *
 * Prinde `notFound()` din `requireFeature` (modul dezactivat) și din paginile
 * `[id]` cu fișă străină sau inexistentă. Contractul e cel pe care îl verifică
 * `e2e/module.spec.ts` pe staging pentru modulele dezactivate: un titlu de
 * NIVEL 1 cu textul exact „Pagina nu există”. `StareGoala` pune titlul într-un
 * `<p>`, deci folosită aici ar fi făcut e2e-ul să pice pe toate rutele
 * „dezactivat” fără ca vreo poartă locală să observe.
 */
describe("404-ul aplicației", () => {
  it("are titlul de nivel 1 „Pagina nu există”", () => {
    render(<NegasitApp />);
    expect(screen.getByRole("heading", { level: 1, name: "Pagina nu există" })).toBeDefined();
  });

  it("duce înapoi la panou printr-un link vizibil", () => {
    render(<NegasitApp />);
    const link = screen.getByRole("link", { name: "Înapoi la panou" });
    expect(link.getAttribute("href")).toBe("/panou");
  });

  it("explică și varianta modulului neactivat", () => {
    render(<NegasitApp />);
    expect(screen.getByText(/secțiunea nu e activată pentru firma dumneavoastră/u)).toBeDefined();
  });
});
