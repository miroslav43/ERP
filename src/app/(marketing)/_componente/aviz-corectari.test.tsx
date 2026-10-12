import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvizCorectari } from "./aviz-corectari";

describe("avizul de corectare", () => {
  it("nu randează nimic fără avize", () => {
    const { container } = render(<AvizCorectari avize={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("anunță fiecare corectare și nu se tipărește", () => {
    render(<AvizCorectari avize={["Unu.", "Doi."]} />);
    const aviz = screen.getByRole("status");
    expect(aviz.getAttribute("data-tipar")).toBe("ascunde");
    expect([...aviz.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Unu.", "Doi."]);
  });
});
