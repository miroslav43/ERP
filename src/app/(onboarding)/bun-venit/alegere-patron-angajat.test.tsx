// src/app/(onboarding)/bun-venit/alegere-patron-angajat.test.tsx
//
// Întrebarea „sunteți și angajat?" e pusă o singură dată, la finalul
// configurării firmei. Dacă textul ei ratează miza — că răspunsul decide dacă
// omul se poate ponta — devine încă un pas de sărit, iar patronul descoperă
// blocajul abia când nu se găsește în foaia de pontaj.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AlegerePatronAngajat } from "./alegere-patron-angajat";

describe("AlegerePatronAngajat", () => {
  it("spune ce decide răspunsul, nu doar pune întrebarea", () => {
    render(<AlegerePatronAngajat valoare={null} laSchimbare={vi.fn()} />);
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/ponta/u);
    // Contul administrează oricum — asta previne teama că un „nu" pierde acces.
    expect(text).toMatch(/administra/u);
  });

  it("nu prezintă „nu” ca pe un răspuns greșit", () => {
    render(<AlegerePatronAngajat valoare={null} laSchimbare={vi.fn()} />);
    const text = document.body.textContent ?? "";
    // Administratorul pe contract de mandat e o stare legitimă. Un text care ar
    // sugera altceva ar împinge oameni să-și creeze contracte false.
    expect(text).toMatch(/la fel de validă/u);
    expect(text).toMatch(/răzgândi/u);
  });

  it("nu începe cu niciun răspuns preselectat", () => {
    // O preselecție ar transforma întrebarea într-o presupunere, iar „da" pus
    // implicit ar duce oameni în înrolare fără să fi ales.
    render(<AlegerePatronAngajat valoare={null} laSchimbare={vi.fn()} />);
    for (const buton of screen.getAllByRole("button")) {
      expect(buton.className).not.toMatch(/border-accent/u);
    }
  });

  it("raportează alegerea, în ambele sensuri", async () => {
    const laSchimbare = vi.fn();
    const { userEvent } = await import("@testing-library/user-event").then((m) => ({
      userEvent: m.default,
    }));
    render(<AlegerePatronAngajat valoare={null} laSchimbare={laSchimbare} />);

    await userEvent.click(screen.getByText("Da, sunt și angajat"));
    expect(laSchimbare).toHaveBeenCalledWith(true);

    await userEvent.click(screen.getByText("Nu, doar administrez"));
    expect(laSchimbare).toHaveBeenCalledWith(false);
  });

  it("arată ce s-a ales", () => {
    render(<AlegerePatronAngajat valoare laSchimbare={vi.fn()} />);
    const alese = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("border-accent"));
    expect(alese).toHaveLength(1);
    expect(alese[0]?.textContent).toMatch(/Da, sunt și angajat/u);
  });
});
