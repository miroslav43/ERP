// src/app/(marketing)/_componente/biblioteca-ga.test.tsx
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stare = vi.hoisted(() => ({ cale: "/unelte/foaie-de-pontaj" }));

vi.mock("next/navigation", () => ({ usePathname: () => stare.cale }));
// `next/script` adaugă scriptul în `document.body` dintr-un efect; în test ne
// interesează DACĂ se cere, nu încărcarea în sine. Tiparul cu `await import`
// din factory e cel din `src/components/ui/comutator-vizualizare.test.tsx`.
vi.mock("next/script", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) =>
      createElement("script", { "data-test-src": props["src"] as string }),
  };
});

import { BibliotecaGa, peUnealta } from "./biblioteca-ga";
import { CHEIE_CONSIMTAMANT, EVENIMENT_CONSIMTAMANT } from "./consimtamant";

const ceruta = (c: HTMLElement) => c.querySelectorAll("script[data-test-src]").length;
const unCadru = () => new Promise((rezolva) => requestAnimationFrame(() => rezolva(null)));

beforeEach(() => {
  localStorage.clear();
  stare.cale = "/unelte/foaie-de-pontaj";
});

describe("BibliotecaGa", () => {
  it("pe o unealtă, fără alegere: gtag.js nu se cere", async () => {
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    await act(unCadru);
    expect(ceruta(container)).toBe(0);
  });

  it("pe o unealtă, după „Accept” în aceeași vizită: se cere o dată", async () => {
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    await act(unCadru);
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENIMENT_CONSIMTAMANT, { detail: "acceptat" }));
    });
    expect(ceruta(container)).toBe(1);
    expect(container.querySelector("script")?.getAttribute("data-test-src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-TEST",
    );
  });

  it("pe o unealtă, „Refuz” n-o cere", async () => {
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENIMENT_CONSIMTAMANT, { detail: "refuzat" }));
    });
    await act(unCadru);
    expect(ceruta(container)).toBe(0);
  });

  it("pe o unealtă, cu acceptul salvat: se cere după primul cadru", async () => {
    localStorage.setItem(CHEIE_CONSIMTAMANT, "acceptat");
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    await waitFor(() => expect(ceruta(container)).toBe(1));
  });

  it("în afara uneltelor: ca până acum, imediat, fără alegere", () => {
    stare.cale = "/preturi";
    const { container } = render(<BibliotecaGa id="G-TEST" />);
    expect(ceruta(container)).toBe(1);
  });

  it("peUnealta: hub-ul și copiii lui, nu și o adresă care doar începe la fel", () => {
    expect(peUnealta("/unelte")).toBe(true);
    expect(peUnealta("/unelte/cerere-demisie")).toBe(true);
    expect(peUnealta("/unelteleX")).toBe(false);
    expect(peUnealta("/")).toBe(false);
  });
});
