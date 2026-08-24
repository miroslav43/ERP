// src/domain/leave/contrast.test.ts

import { describe, expect, it } from "vitest";

import {
  celMaiBunContrast,
  cernealaPentruFundal,
  citesteHex,
  PRAG_TEXT_MIC,
  raportContrast,
} from "./contrast";

describe("citesteHex", () => {
  it("citește forma scurtă și pe cea lungă la aceeași culoare", () => {
    expect(citesteHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(citesteHex("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("întoarce null pentru orice nu e hex — coloana din bază e `text`, nu un tip verificat", () => {
    expect(citesteHex("rgb(255, 0, 0)")).toBeNull();
    expect(citesteHex("rebeccapurple")).toBeNull();
    expect(citesteHex("")).toBeNull();
    expect(citesteHex("#12345")).toBeNull();
  });
});

describe("raportContrast", () => {
  it("alb pe negru dă maximul de 21:1", () => {
    const raport = raportContrast({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 });
    expect(raport).toBeCloseTo(21, 5);
  });

  it("o culoare cu ea însăși dă 1:1", () => {
    expect(raportContrast({ r: 18, g: 52, b: 86 }, { r: 18, g: 52, b: 86 })).toBeCloseTo(1, 10);
  });
});

describe("cernealaPentruFundal", () => {
  it("pe navy alege cremul", () => {
    expect(cernealaPentruFundal("#1e3a5f")).toBe("crem");
  });

  it("pe galben alege cerneala închisă — exact cazul care făcea calendarul ilizibil", () => {
    // Cremul #faf7f0 pe galben pur dă 1,00:1: numele angajatului dispărea.
    expect(cernealaPentruFundal("#ffff00")).toBe("cerneala");
  });

  it("pentru o culoare necitibilă cade pe cerneala închisă, nu pe crem", () => {
    expect(cernealaPentruFundal("nu-e-o-culoare")).toBe("cerneala");
  });
});

describe("celMaiBunContrast", () => {
  it("galbenul trece pragul de text mic — dar numai cu cerneala potrivită", () => {
    expect(celMaiBunContrast("#ffff00")).toBeGreaterThan(PRAG_TEXT_MIC);
  });

  it("un gri de mijloc nu ține text cu niciuna dintre cele două cerneli", () => {
    expect(celMaiBunContrast("#767676")).toBeLessThan(PRAG_TEXT_MIC);
  });

  it("o culoare necitibilă e tratată ca «nu ține»", () => {
    expect(celMaiBunContrast("")).toBe(0);
  });

  /*
   * Pinul pe cerneala REALĂ a produsului.
   *
   * Pastila randează clasa `text-foreground`, deci raportul de pe ecran se
   * măsoară față de `--color-foreground` = #14213d. Cu o constantă doar
   * apropiată (un #1c1b18, mai închis), aceeași culoare ieșea 4,56 — „trece
   * AA” — în timp ce pe ecran era 4,23. Testul ăsta pică dacă cerneala se mai
   * desprinde vreodată de token, în loc să treacă pe tăcute.
   */
  it("un albastru de graniță pică pragul, fiindcă se măsoară față de cerneala din globals.css", () => {
    expect(celMaiBunContrast("#0088dd")).toBeCloseTo(4.23, 2);
    expect(celMaiBunContrast("#0088dd")).toBeLessThan(PRAG_TEXT_MIC);
  });
});
