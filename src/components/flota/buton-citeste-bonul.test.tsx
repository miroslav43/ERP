// src/components/flota/buton-citeste-bonul.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * „Citește bonul” (F12a): fără poză nu apare; refuzul acțiunii și bonul
 * ilizibil ajung într-un `role="alert"`; reușita predă formularului propunerea
 * și jetonul, iar avertismentele rămân la vedere. Acțiunea e mimată.
 */

const citesteBonul = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/flota/bon/actions", () => ({ citesteBonul }));

const { ButonCitesteBonul } = await import("./buton-citeste-bonul");

const FOAIE = "55555555-5555-4555-8555-555555555555";
const CALE = `org/trip_sheets/${FOAIE}/x-bon.jpg`;
const PROPUNERE = {
  alimentat_la: "2026-10-07T14:32",
  litri: 45.32,
  cost: 312.5,
  statie: "OMV",
  numar_bon: "0042",
  cui_statie: "14399840",
};

beforeEach(() => {
  citesteBonul.mockReset();
});

describe("ButonCitesteBonul", () => {
  it("fără `cale`, butonul lipsește", () => {
    render(<ButonCitesteBonul tripSheetId={FOAIE} cale={null} onPropunere={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Citește bonul/u })).toBeNull();
  });

  it('eroarea acțiunii ⇒ `role="alert"`, fără `onPropunere`', async () => {
    citesteBonul.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Citirea automată nu este disponibilă acum. Completați manual.",
        fieldErrors: null,
        requestId: "t",
      },
    });
    const onPropunere = vi.fn();
    render(<ButonCitesteBonul tripSheetId={FOAIE} cale={CALE} onPropunere={onPropunere} />);
    await userEvent.click(screen.getByRole("button", { name: /Citește bonul/u }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/nu este disponibilă/u);
    });
    expect(onPropunere).not.toHaveBeenCalled();
    expect(citesteBonul).toHaveBeenCalledWith({ trip_sheet_id: FOAIE, cale: CALE });
  });

  it('bonul ilizibil ⇒ motivul în `role="alert"`', async () => {
    citesteBonul.mockResolvedValue({
      ok: true,
      data: { propunere: null, motivGol: "Fotografia e neclară. Refaceți poza." },
    });
    const onPropunere = vi.fn();
    render(<ButonCitesteBonul tripSheetId={FOAIE} cale={CALE} onPropunere={onPropunere} />);
    await userEvent.click(screen.getByRole("button", { name: /Citește bonul/u }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/neclară/u);
    });
    expect(onPropunere).not.toHaveBeenCalled();
  });

  it("succes ⇒ `onPropunere` primește propunerea și jetonul; avertismentele se văd", async () => {
    citesteBonul.mockResolvedValue({
      ok: true,
      data: {
        propunere: PROPUNERE,
        avertismente: ["AdBlue-ul de pe bon nu s-a trecut."],
        jeton: "j.s",
      },
    });
    const onPropunere = vi.fn();
    render(<ButonCitesteBonul tripSheetId={FOAIE} cale={CALE} onPropunere={onPropunere} />);
    await userEvent.click(screen.getByRole("button", { name: /Citește bonul/u }));
    await waitFor(() => {
      expect(onPropunere).toHaveBeenCalledWith({
        propunere: PROPUNERE,
        avertismente: ["AdBlue-ul de pe bon nu s-a trecut."],
        jeton: "j.s",
      });
    });
    expect(screen.getByText("AdBlue-ul de pe bon nu s-a trecut.")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
