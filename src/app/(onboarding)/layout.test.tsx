// src/app/(onboarding)/layout.test.tsx
//
// QA 8 oct 2026, ONB-021: administratorul blocat în asistent n-avea nici
// ieșire din cont, nici contact. Antetul zonei le dă pe amândouă, pe ORICE
// ecran din `(onboarding)`, nu doar pe cel de așteptare.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LayoutInrolare from "./layout";

// `@/app/(app)/actions` e `"use server"` și trage `server-only`; aici contează
// doar că butonul există și că formularul lui are o acțiune.
vi.mock("@/app/(app)/actions", () => ({ deconecteaza: vi.fn() }));
// Atinge `window["ga-disable-…"]` într-un efect; n-are legătură cu antetul.
vi.mock("@/components/layout/opreste-analiticele", () => ({ OpresteAnaliticele: () => null }));

describe("LayoutInrolare — antetul minimal (ONB-021)", () => {
  it("are butonul „Deconectare” și linkul de ajutor spre adresa de contact", () => {
    render(
      <LayoutInrolare>
        <p>conținutul paginii</p>
      </LayoutInrolare>,
    );
    expect(screen.getByRole("button", { name: /Deconectare/ })).toBeDefined();
    expect(screen.getByRole("link", { name: /ajutor/ }).getAttribute("href")).toBe(
      "mailto:contact@administrativo.ro",
    );
    expect(screen.getByText("conținutul paginii")).toBeDefined();
  });

  it("scurtătura „Sari la conținut” rămâne primul element focusabil, înaintea antetului", () => {
    const { container } = render(
      <LayoutInrolare>
        <p>x</p>
      </LayoutInrolare>,
    );
    const primulFocusabil = container.querySelector("a, button");
    expect(primulFocusabil?.textContent).toBe("Sari la conținut");
  });
});
