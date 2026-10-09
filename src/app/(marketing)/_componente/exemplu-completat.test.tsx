// src/app/(marketing)/_componente/exemplu-completat.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { exempluPentru } from "@/content/landing/exemple-unelte";

import { ExempluCompletat } from "./exemplu-completat";

describe("ExempluCompletat", () => {
  it("arată captura cu dimensiuni, alt și cele două legături", () => {
    render(<ExempluCompletat exemplu={exempluPentru("/unelte/cerere-demisie")} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("alt")).toMatch(/model completat/u);
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("1200");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(screen.getByRole("link", { name: /Deschide exemplul/u }).getAttribute("href")).toMatch(
      /^\/unelte\/cerere-demisie\?.*#documentul$/u,
    );
    expect(screen.getByRole("link", { name: /PDF/u }).getAttribute("href")).toMatch(
      /^\/api\/unelte\/cerere-demisie\?.*format=pdf/u,
    );
  });

  it("fără exemplu nu randează nimic", () => {
    const { container } = render(<ExempluCompletat exemplu={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
