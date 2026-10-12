// src/app/(app)/flota/foi/[id]/actiuni-foaie.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* `../../actions` e `"use server"`; se înlocuiește cu spioni (vezi dialog-foaie-noua.test.tsx). */
const trimiteFoaie = vi.fn();
const retrageFoaie = vi.fn();
const redeschideFoaie = vi.fn();
const stergeFoaie = vi.fn();
const adaugaAlimentare = vi.fn();
vi.mock("../../actions", () => ({
  trimiteFoaie: (...a: unknown[]) => trimiteFoaie(...a),
  retrageFoaie: (...a: unknown[]) => retrageFoaie(...a),
  redeschideFoaie: (...a: unknown[]) => redeschideFoaie(...a),
  stergeFoaie: (...a: unknown[]) => stergeFoaie(...a),
  adaugaAlimentare: (...a: unknown[]) => adaugaAlimentare(...a),
}));

const reimprospateaza = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: reimprospateaza,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/flota/foi/f1",
}));

import { golesteToasturi } from "@/components/ui/toast";

import { ActiuniFoaie } from "./actiuni-foaie";

/**
 * Ce apără fișierul: ecranul urmează EXACT paritatea stării din 0197 §D1.
 * Pe o foaie trimisă nu mai există alimentare și nici trimitere — doar
 * retragerea; trimiterea nu mai cere sosirea (o dau cursele), iar refuzul bazei
 * la trimitere se arată întreg, fiindcă câmpul lui stă în caseta cursei.
 */

function asiguraDialogNativ(): void {
  const proto = globalThis.HTMLDialogElement?.prototype;
  if (proto === undefined) return;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function () {
      this.open = true;
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function () {
      this.open = false;
    };
  }
}
asiguraDialogNativ();

const ID = "f1f1f1f1-1111-4111-8111-111111111111";
const baza = {
  id: ID,
  plecareLa: "2026-10-05T05:00:00.000Z",
  sosireLa: "2026-10-05T14:00:00.000Z",
  bazaFoi: "/flota/foi",
} as const;

beforeEach(() => {
  golesteToasturi();
  for (const f of [trimiteFoaie, retrageFoaie, redeschideFoaie, stergeFoaie, adaugaAlimentare]) {
    f.mockReset();
    f.mockResolvedValue({ ok: true, data: { id: ID, anomalie: null } });
  }
  reimprospateaza.mockClear();
});

describe("ActiuniFoaie", () => {
  it("pe ciornă: trimiterea pleacă fără sosire, doar cu observațiile", async () => {
    render(<ActiuniFoaie {...baza} status="draft" areCurse />);
    expect(screen.queryByLabelText(/Sosire/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Observații/, { selector: "textarea" }), {
      target: { value: "Drum închis la Câmpina." },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trimite spre aprobare" }));
    });
    expect(trimiteFoaie).toHaveBeenCalledWith({ id: ID, observatii: "Drum închis la Câmpina." });
    expect(reimprospateaza).toHaveBeenCalled();
  });

  it("pe ciornă fără curse: spune ce lipsește și nu trimite nimic", async () => {
    render(<ActiuniFoaie {...baza} status="draft" areCurse={false} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trimite spre aprobare" }));
    });
    expect(trimiteFoaie).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/Adăugați cursele zilei/);
  });

  it("refuzul bazei la trimitere se arată întreg, nu „Corectați câmpurile marcate”", async () => {
    const mesaj =
      "Kilometrajul de plecare (9000 km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (10000 km).";
    trimiteFoaie.mockResolvedValue({
      ok: false,
      error: { code: "VALIDARE", message: mesaj, fieldErrors: { km_plecare: [mesaj] } },
    });
    render(<ActiuniFoaie {...baza} status="draft" areCurse />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Trimite spre aprobare" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(mesaj);
  });

  it("pe foaia trimisă: doar retragerea; fără alimentare, fără trimitere", async () => {
    render(<ActiuniFoaie {...baza} status="trimis" areCurse />);
    expect(screen.queryByRole("button", { name: "Trimite spre aprobare" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Adaugă alimentarea" })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retrage în ciornă" }));
    });
    expect(retrageFoaie).toHaveBeenCalledWith({ id: ID });
    expect(redeschideFoaie).not.toHaveBeenCalled();
  });

  it("pe foaia respinsă: redeschiderea, nu retragerea", async () => {
    render(<ActiuniFoaie {...baza} status="respins" areCurse />);
    expect(screen.queryByRole("button", { name: "Adaugă alimentarea" })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Redeschide foaia" }));
    });
    expect(redeschideFoaie).toHaveBeenCalledWith({ id: ID });
    expect(retrageFoaie).not.toHaveBeenCalled();
  });

  it("pe ciornă: alimentarea se poate adăuga", () => {
    render(<ActiuniFoaie {...baza} status="draft" areCurse />);
    expect(screen.getByRole("button", { name: "Adaugă alimentarea" })).toBeTruthy();
  });
});
