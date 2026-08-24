// src/components/ui/buton.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Buton, buton } from "./buton";

/**
 * Testele astea nu verifică „arată bine”. Verifică exact regulile pe care
 * `typecheck`, `lint` și `build` NU le pot vedea și care, în absența lor, s-au
 * încălcat de sute de ori în acest depozit.
 */

describe("Buton — starea dezactivată", () => {
  it("nu folosește opacitate", () => {
    // 90 de `disabled:opacity-50` și `disabled:opacity-60` existau în cod.
    // Amândouă pică WCAG: 3,22:1 și 4,34:1.
    render(<Buton disabled>Salvează</Buton>);
    const b = screen.getByRole("button", { name: "Salvează" }) as HTMLButtonElement;
    expect(b.className).not.toMatch(/disabled:opacity/);
    expect(b.className).toContain("disabled:bg-surface");
    expect(b.className).toContain("disabled:text-muted-foreground");
    expect(b.disabled).toBe(true);
  });

  it("e dezactivat și marcat ocupat cât timp lucrează", () => {
    render(
      <Buton varianta="primar" inCurs textInCurs="Se salvează…">
        Salvează
      </Buton>,
    );
    const b = screen.getByRole("button") as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
    // Textul se schimbă: „Se salvează…” spune că se întâmplă ceva, „Salvează” nu.
    expect(b.textContent).toContain("Se salvează…");
    expect(b.textContent).not.toContain("Salvează ");
  });

  it("nu marchează `aria-busy` când nu lucrează", () => {
    render(<Buton>Salvează</Buton>);
    expect(screen.getByRole("button").hasAttribute("aria-busy")).toBe(false);
  });
});

describe("Buton — variantele", () => {
  it("distructivul e conturat, niciodată plin", () => {
    // Varianta plină ar fi mai contrastantă la repaus, dar la hover ar trebui
    // DILUATĂ — iar diluarea peste crem deschide, adică dă semnal invers exact
    // la confirmarea finală. De aceea inversează.
    render(<Buton varianta="distructiv">Casează</Buton>);
    const c = screen.getByRole("button").className;
    expect(c).toContain("border-danger");
    expect(c).toContain("bg-background");
    expect(c).toContain("hover:bg-danger");
    expect(c).not.toMatch(/(^|\s)bg-danger(\s|$)/);
  });

  it("linkul nu are geometrie de buton", () => {
    render(<Buton varianta="link">Vezi toate</Buton>);
    const c = screen.getByRole("button").className;
    expect(c).toContain("underline");
    // `cn` rezolvă conflictul: baza pune h-9 și px-4, varianta le anulează.
    expect(c).not.toMatch(/(^|\s)h-9(\s|$)/);
    expect(c).not.toMatch(/(^|\s)px-4(\s|$)/);
  });

  it("primarul poartă cremul pe navy", () => {
    render(<Buton varianta="primar">Publică</Buton>);
    const c = screen.getByRole("button").className;
    expect(c).toContain("bg-primary");
    expect(c).toContain("text-primary-foreground");
    expect(c).toContain("hover:bg-primary-hover");
  });
});

describe("Buton — accesibilitate", () => {
  it("butonul doar-iconiță are nume accesibil", () => {
    render(
      <Buton marime="iconita" aria-label="Închide">
        ×
      </Buton>,
    );
    expect(screen.getByRole("button", { name: "Închide" })).toBeDefined();
  });

  it("nu-și scrie propriul inel de focus", () => {
    // Regula globală `:focus-visible` din globals.css acoperă tot. Existau 155
    // de suprascrieri locale, iar unele îl ANULAU prin `outline-none`.
    render(<Buton>Trimite</Buton>);
    const c = screen.getByRole("button").className;
    expect(c).not.toMatch(/focus-visible:/);
    expect(c).not.toMatch(/outline-none/);
  });

  it("ținta tactilă crește pe dispozitivele cu deget", () => {
    render(<Buton>Trimite</Buton>);
    expect(screen.getByRole("button").className).toContain("pointer-coarse:h-11");
  });

  it("e `type=button` implicit, ca să nu trimită din greșeală un formular", () => {
    render(<Buton>Anulează</Buton>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });
});

describe("buton() — pentru elementele care nu sunt <button>", () => {
  it("dă aceleași clase ca și componenta", () => {
    render(<Buton varianta="primar">X</Buton>);
    const dinComponenta = screen.getByRole("button").className;
    expect(buton({ varianta: "primar" })).toBe(dinComponenta);
  });

  it("varianta implicită e secundarul", () => {
    expect(buton()).toBe(buton({ varianta: "secundar", marime: "implicit" }));
  });
});
