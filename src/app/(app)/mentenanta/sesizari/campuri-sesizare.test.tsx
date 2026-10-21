// src/app/(app)/mentenanta/sesizari/campuri-sesizare.test.tsx
//
// ANG-025 (QA 8 oct 2026): angajatul a tastat „e" în căutarea de echipament și
// n-a apărut NIMIC — pragul e de 2 caractere, iar sub el caseta tăcea. Iar cine
// căuta un calculator sau o imprimantă (care nu sunt în parcul de mentenanță)
// rămânea la „Niciun echipament", fără drum spre tichetele IT.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StareFormular } from "@/components/ui/formular";

import { CampuriSesizare } from "./campuri-sesizare";

const { cautaEchipament } = vi.hoisted(() => ({ cautaEchipament: vi.fn() }));

vi.mock("../actions", () => ({ cautaEchipament }));

const STARE: StareFormular<unknown> = {
  inCurs: false,
  erori: {},
  eroareGenerala: null,
  valoriTrimise: {},
  data: null,
};

function randeaza(hrefTichetNou: string | null): void {
  render(
    <CampuriSesizare
      stare={STARE}
      idc={(sufix) => `sesizare-${sufix}`}
      echipamentPrefill={null}
      prefillEsuat={false}
      radacinaSesizari="/portal/sesizari"
      hrefTichetNou={hrefTichetNou}
    />,
  );
}

async function tasteaza(text: string): Promise<void> {
  const camp = screen.getByRole("searchbox");
  await act(async () => {
    fireEvent.change(camp, { target: { value: text } });
  });
}

beforeEach(() => {
  cautaEchipament.mockReset();
  cautaEchipament.mockResolvedValue({ ok: true, data: [] });
});

describe("CampuriSesizare — căutarea de echipament", () => {
  it("la un singur caracter spune câte mai trebuie, fără să caute", async () => {
    randeaza(null);
    await tasteaza("e");
    expect(screen.getByText("Tastați cel puțin 2 caractere.")).toBeDefined();
    // Debounce-ul e de 300 ms; după el, tot nicio căutare.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(cautaEchipament).not.toHaveBeenCalled();
  });

  it("zero rezultate: citează termenul și trimite spre tichetele IT", async () => {
    randeaza("/portal/tichetele-mele/nou");
    await tasteaza("ab");
    await waitFor(() => {
      expect(screen.getByText(/Niciun echipament pentru „ab”/u)).toBeDefined();
    });
    expect(cautaEchipament).toHaveBeenCalledWith({ q: "ab" });
    expect(screen.queryByText("Tastați cel puțin 2 caractere.")).toBeNull();
    const link = screen.getByRole("link", { name: "deschideți un tichet IT" });
    expect(link.getAttribute("href")).toBe("/portal/tichetele-mele/nou");
  });

  it("fără drept pe tichete: mesajul de zero rezultate rămâne, linkul lipsește", async () => {
    randeaza(null);
    await tasteaza("ab");
    await waitFor(() => {
      expect(screen.getByText(/Niciun echipament pentru „ab”/u)).toBeDefined();
    });
    expect(screen.queryByRole("link", { name: "deschideți un tichet IT" })).toBeNull();
  });
});
