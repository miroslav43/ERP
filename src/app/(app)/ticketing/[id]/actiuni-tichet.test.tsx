// src/app/(app)/ticketing/[id]/actiuni-tichet.test.tsx
//
// `SchimbaStatus` cu etichetele solicitantului. Portalul îi oferă angajatului
// „Confirm rezolvarea” / „Redeschide tichetul” pe propriul tichet rezolvat
// (FLX-003); înainte nu avea niciun buton, iar eticheta stării („Închis”) pe un
// buton nu spunea nimănui ce face apăsarea.

import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ETICHETE_ACTIUNE_SOLICITANT } from "../etichete";
import { SchimbaStatus } from "./actiuni-tichet";
import { schimbaStatusul } from "../actions";

/*
  Aceleași două margini tăiate ca în `pontaj/celula-zi.test.tsx`: `../actions`
  e un modul `"use server"` care trage după el `server-only`, iar `useRouter`
  cere contextul App Router. Ce se verifică aici e ce se DESENEAZĂ și ce pleacă
  spre acțiune, nu ce face baza.
*/
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../actions", () => ({
  aplicaMacro: vi.fn(),
  asigneaza: vi.fn(),
  comenteaza: vi.fn(),
  decideTichet: vi.fn(),
  schimbaStatusul: vi.fn(),
  suprascriePrioritatea: vi.fn(),
}));

const TICHET = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.mocked(schimbaStatusul).mockReset();
  vi.mocked(schimbaStatusul).mockResolvedValue({ ok: true, data: { id: TICHET } } as never);
});

describe("SchimbaStatus — etichetele solicitantului", () => {
  it("cu `etichete` butoanele spun ce FACI, nu starea în care ajungi", () => {
    render(
      <SchimbaStatus
        ticketId={TICHET}
        optiuni={["inchis", "redeschis"]}
        etichete={ETICHETE_ACTIUNE_SOLICITANT}
      />,
    );
    expect(screen.getByRole("button", { name: "Confirm rezolvarea" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Redeschide tichetul" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Închis" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Redeschis" })).toBeNull();
  });

  it("fără `etichete` rămân etichetele stărilor — nimic nu se schimbă pentru echipă", () => {
    render(<SchimbaStatus ticketId={TICHET} optiuni={["inchis", "redeschis"]} />);
    expect(screen.getByRole("button", { name: "Închis" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Redeschis" })).toBeDefined();
  });

  it("o stare fără verb propriu cade pe eticheta stării", () => {
    render(
      <SchimbaStatus
        ticketId={TICHET}
        optiuni={["in_lucru"]}
        etichete={ETICHETE_ACTIUNE_SOLICITANT}
      />,
    );
    expect(screen.getByRole("button", { name: "În lucru" })).toBeDefined();
  });

  it("apăsarea pleacă spre acțiune cu tichetul și starea-țintă", async () => {
    render(
      <SchimbaStatus
        ticketId={TICHET}
        optiuni={["inchis", "redeschis"]}
        etichete={ETICHETE_ACTIUNE_SOLICITANT}
      />,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Confirm rezolvarea" }).click();
    });
    await waitFor(() => {
      expect(schimbaStatusul).toHaveBeenCalledWith({ ticket_id: TICHET, status: "inchis" });
    });
  });

  it("refuzul acțiunii ajunge pe ecran ca alertă, cu mesajul ei", async () => {
    vi.mocked(schimbaStatusul).mockResolvedValue({
      ok: false,
      error: { code: "CONFLICT", message: "Tichetul nu mai e în starea așteptată." },
    } as never);
    render(
      <SchimbaStatus
        ticketId={TICHET}
        optiuni={["redeschis"]}
        etichete={ETICHETE_ACTIUNE_SOLICITANT}
      />,
    );
    await act(async () => {
      screen.getByRole("button", { name: "Redeschide tichetul" }).click();
    });
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toBe("Tichetul nu mai e în starea așteptată.");
  });

  it("fără opțiuni nu randează nimic — nici introducerea", () => {
    const { container } = render(
      <SchimbaStatus
        ticketId={TICHET}
        optiuni={[]}
        intro="Echipa a marcat tichetul ca rezolvat."
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("`intro` apare deasupra butoanelor doar când e dat", () => {
    const { rerender } = render(
      <SchimbaStatus
        ticketId={TICHET}
        optiuni={["inchis", "redeschis"]}
        etichete={ETICHETE_ACTIUNE_SOLICITANT}
        intro="Echipa a marcat tichetul ca rezolvat. Dacă problema persistă, redeschideți-l."
      />,
    );
    expect(screen.getByText(/Echipa a marcat tichetul ca rezolvat/u)).toBeDefined();

    rerender(<SchimbaStatus ticketId={TICHET} optiuni={["inchis", "redeschis"]} />);
    expect(screen.queryByText(/Echipa a marcat tichetul ca rezolvat/u)).toBeNull();
  });
});
