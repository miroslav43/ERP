// src/components/incarcare/zona-incarcare.test.tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ZonaIncarcare } from "./zona-incarcare";
import { goleste, porneste } from "@/lib/incarcare/depozit";
import { DURATA_MINIMA_VOAL, PRAG_VOAL } from "@/lib/incarcare/praguri";

/**
 * Ce apără fișierul: cele două praguri, adică singurul lucru care desparte un
 * indicator util de unul enervant.
 *
 * Fără `PRAG_VOAL`, voalul apare la fiecare clic, inclusiv peste navigările
 * care se termină în 80 ms — și atunci el devine problema pe care ar trebui
 * s-o semnaleze. Fără `DURATA_MINIMA_VOAL`, o navigare de 410 ms produce o
 * clipire de 10 ms, care se citește ca defect grafic, nu ca stare.
 */

function avanseaza(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const voalulEVizibil = (): boolean => screen.queryByText(/Se încarcă/u) !== null;

describe("ZonaIncarcare", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    goleste();
  });
  afterEach(() => {
    goleste();
    vi.useRealTimers();
  });

  it("nu apare pentru o așteptare mai scurtă decât pragul", () => {
    render(<ZonaIncarcare />);
    let opreste = (): void => undefined;
    act(() => {
      opreste = porneste();
    });

    avanseaza(PRAG_VOAL - 50);
    expect(voalulEVizibil()).toBe(false);

    act(() => opreste());
    avanseaza(5000);
    // Navigarea s-a terminat înainte de prag: pe ecran n-a apărut niciodată nimic.
    expect(voalulEVizibil()).toBe(false);
  });

  it("apare după prag, cât timp așteptarea continuă", () => {
    render(<ZonaIncarcare />);
    act(() => {
      porneste("panoul");
    });

    avanseaza(PRAG_VOAL + 10);
    expect(voalulEVizibil()).toBe(true);
    expect(screen.getByText("Se încarcă panoul…")).toBeDefined();
  });

  it("rămâne pe ecran durata minimă, chiar dacă așteptarea s-a încheiat imediat", () => {
    render(<ZonaIncarcare />);
    let opreste = (): void => undefined;
    act(() => {
      opreste = porneste();
    });

    avanseaza(PRAG_VOAL + 10);
    expect(voalulEVizibil()).toBe(true);

    act(() => opreste());
    avanseaza(DURATA_MINIMA_VOAL - 100);
    expect(voalulEVizibil()).toBe(true);

    avanseaza(150);
    expect(voalulEVizibil()).toBe(false);
  });

  it("anunță starea asistiv, fără să captureze focusul", () => {
    const { container } = render(<ZonaIncarcare />);
    const invelis = container.firstElementChild;
    expect(invelis?.getAttribute("role")).toBe("status");
    expect(invelis?.getAttribute("aria-live")).toBe("polite");
    // Voalul nu e modal: navigarea în Next e întreruptibilă, iar o capcană de
    // focus ar transforma o așteptare într-o fundătură.
    expect(invelis?.getAttribute("aria-modal")).toBeNull();
  });
});
