// src/components/layout/breadcrumb.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Breadcrumb } from "./breadcrumb";

vi.mock("next/navigation", () => ({
  usePathname: () => "/panou",
}));

/**
 * UX-003: meniul spunea „Panou de control”, titlul și adresa „Panou”. Eticheta
 * firimiturii vine din meniu, deci o redenumire acolo se vede și aici.
 * UX-002: la 820 px firimitura curentă se tăia; `title` păstrează textul întreg.
 */
describe("Breadcrumb — pagina curentă", () => {
  it("se numește ca în meniu și are valoarea întreagă în title", () => {
    render(<Breadcrumb tiparePermise={[]} />);

    const curenta = screen.getByText("Panou");
    expect(curenta.getAttribute("aria-current")).toBe("page");
    expect(curenta.getAttribute("title")).toBe("Panou");
  });
});
