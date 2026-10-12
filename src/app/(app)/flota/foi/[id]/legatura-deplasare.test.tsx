// src/app/(app)/flota/foi/[id]/legatura-deplasare.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const legaDeplasarea = vi.fn();
vi.mock("../../actions-soferi", () => ({
  legaDeplasarea: (...a: unknown[]) => legaDeplasarea(...a),
}));

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/flota/foi/f1",
}));

import { golesteToasturi } from "@/components/ui/toast";

import { LegaturaDeplasare } from "./legatura-deplasare";

const FOAIE = "f1f1f1f1-1111-4111-8111-111111111111";
const DEPL = "d1d1d1d1-1111-4111-8111-111111111111";

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  golesteToasturi();
  refresh.mockReset();
  legaDeplasarea.mockReset();
  legaDeplasarea.mockResolvedValue({ ok: true, data: { id: FOAIE } });
});

describe("LegaturaDeplasare", () => {
  it("leagă foaia de deplasarea aleasă și reîmprospătează", async () => {
    render(
      <LegaturaDeplasare
        foaieId={FOAIE}
        legataId={null}
        optiuni={[{ id: DEPL, eticheta: "Audit Cluj · 12.10.2026 (aprobată)" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Deplasarea \(delegația\)/), {
      target: { value: DEPL },
    });
    await trimite();

    expect(legaDeplasarea).toHaveBeenCalledWith({ id: FOAIE, business_trip_id: DEPL });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("„Fără deplasare” trimite șirul gol (schema îl face `null`)", async () => {
    render(
      <LegaturaDeplasare
        foaieId={FOAIE}
        legataId={DEPL}
        optiuni={[{ id: DEPL, eticheta: "Audit Cluj" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Deplasarea \(delegația\)/), { target: { value: "" } });
    await trimite();
    expect(legaDeplasarea).toHaveBeenCalledWith({ id: FOAIE, business_trip_id: "" });
  });

  it("refuzul gărzii din bază apare sub selector, legat prin aria-describedby", async () => {
    const mesaj =
      "Deplasarea aleasă este a altui angajat. Foaia se leagă doar de o deplasare a șoferului ei.";
    legaDeplasarea.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "x",
        fieldErrors: { business_trip_id: [mesaj] },
        requestId: "t",
      },
    });
    render(
      <LegaturaDeplasare foaieId={FOAIE} legataId={null} optiuni={[{ id: DEPL, eticheta: "A" }]} />,
    );
    await trimite();

    const alerta = screen.getByRole("alert");
    expect(alerta.textContent).toBe(mesaj);
    const select = screen.getByLabelText(/Deplasarea \(delegația\)/);
    expect(select.getAttribute("aria-describedby")).toBe(alerta.id);
    expect(refresh).not.toHaveBeenCalled();
  });
});
