import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { amendaEvidenta } from "@/content/landing/intrebari-pontaj";

import { CeCereItm } from "./ce-cere-itm";

describe("banda „Ce cere inspectorul de muncă”", () => {
  it("arată cerința art. 119, cele două amenzi cu temeiul și ce acoperă documentul", () => {
    const { container } = render(<CeCereItm acoperire="Acest document acoperă art. 119." />);
    expect(screen.getByText("Acest document acoperă art. 119.")).toBeTruthy();
    expect(screen.getByText(amendaEvidenta("m").suma)).toBeTruthy();
    expect(screen.getByText(amendaEvidenta("e3").suma)).toBeTruthy();
    expect(container.textContent).toContain("art. 260 alin. (1) lit. m)");
    expect(container.textContent).toContain("de începere și de sfârșit");
    expect(container.textContent).not.toContain("undefined");
    expect(screen.getByRole("link", { name: /Tot ce cere art\. 119/u }).getAttribute("href")).toBe(
      "/evidenta-orelor-de-munca",
    );
  });
});
