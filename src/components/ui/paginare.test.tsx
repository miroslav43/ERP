// src/components/ui/paginare.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Linkurile de paginare poartă un `SenzorLink`, care cheamă `useRouter()`
 * prin semnalul de încărcare. În afara aplicației nu există router montat,
 * deci i se dă unul inert: aici se verifică TEXTUL numărătorii, nu navigarea.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, prefetch: () => {} }),
  usePathname: () => "/angajati",
  useSearchParams: () => new URLSearchParams(),
}));

import { Paginare } from "./paginare";

function numaratoare(afisate: number, total: number | null): string {
  render(
    <Paginare
      afisate={afisate}
      total={total}
      cursorUrmator={null}
      construiesteHref={() => "/angajati"}
      limita={25}
    />,
  );
  // Textul numărătorii e primul paragraf din `<nav>`, spart în mai multe
  // noduri (cifrele sunt în `<span>`-uri monospațiate).
  const nav = screen.getByRole("navigation", { name: "Paginare" });
  return nav.querySelector("p")?.textContent ?? "";
}

describe("Paginare — numărătoarea", () => {
  it("6 din 6 rânduri — fără „de” sub 20 (QA ADM-008: „6 din 6 de rânduri”)", () => {
    expect(numaratoare(6, 6)).toBe("6 din 6 rânduri");
  });

  it("1 din 1 rând — singular", () => {
    expect(numaratoare(1, 1)).toBe("1 din 1 rând");
  });

  it("25 din 40 de rânduri — substantivul se acordă cu totalul", () => {
    expect(numaratoare(25, 40)).toBe("25 din 40 de rânduri");
  });

  it("fără total, se acordă cu cele afișate", () => {
    expect(numaratoare(3, null)).toBe("3 rânduri · ultima pagină");
  });
});
