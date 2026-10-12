// src/components/layout/schelet-nav.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScheletNav, ScheletTopbar } from "./schelet-nav";

/**
 * UX-036: „Se încarcă meniul…” și „Se încarcă antetul…” au măsurat 1,03:1 —
 * culoarea moștenită de pe crem (`--color-foreground`, navy) pe fundalul navy.
 * Textele sunt `sr-only`, deci nu se văd; dar orice audit automat de contrast
 * le numără, iar un `sr-only` scos vreodată ar ieși ilizibil. Alb pe navy:
 * 14,66:1.
 */
describe("Scheletele de încărcare — textul pentru cititorul de ecran", () => {
  it.each([
    ["meniul", ScheletNav, "Se încarcă meniul…"],
    ["antetul", ScheletTopbar, "Se încarcă antetul…"],
  ] as const)("%s: textul e sr-only și alb, nu navy pe navy", (_nume, Schelet, text) => {
    render(<Schelet />);

    const eticheta = screen.getByText(text);
    expect(eticheta.className).toContain("sr-only");
    expect(eticheta.className).toContain("text-white");
  });
});
