// src/app/(app)/flota/aprobari/decizie-foaie.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

/**
 * Aceeași clasă de defect ca ADM-022, nesemnalată de QA: motivul respingerii
 * — un text lung, scris cu grijă pentru șofer — se pierdea la orice refuz al
 * acțiunii, fiindcă formularul era un `<form action>` brut pe care React 19 îl
 * resetează după acțiune.
 */

const { decideFoaie, refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  // Un singur obiect, ca în Next: `useRouter` citește contextul, stabil.
  return { decideFoaie: vi.fn(), refresh, router: { refresh } };
});

vi.mock("../actions", () => ({ decideFoaie }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/incarcare/use-incarcare", () => {
  const semnal = (): undefined => undefined;
  return { useSemnalPanaLaRuta: () => semnal };
});

const { DecizieFoaie } = await import("./decizie-foaie");

const MOTIV = "Lipsesc bonurile de la cele două alimentări din 3 octombrie.";

// Regex, nu șir: `Camp` adaugă „(obligatoriu)” pentru cititorul de ecran.
function motiv(): HTMLTextAreaElement {
  const element = screen.getByLabelText(/^Motivul respingerii/u);
  if (!(element instanceof HTMLTextAreaElement)) throw new Error("Câmpul „motiv” lipsește.");
  return element;
}

async function apasa(nume: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: nume }));
  });
}

beforeEach(() => {
  decideFoaie.mockReset();
  refresh.mockReset();
});

describe("DecizieFoaie — respingerea păstrează motivul scris", () => {
  it("refuzul serverului se vede, iar motivul rămâne în casetă", async () => {
    const refuz: ActionResult<never> = {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Decizia nu a fost înregistrată. Foaia nu vă aparține sau a fost deja decisă.",
        fieldErrors: null,
        requestId: "test",
      },
    };
    decideFoaie.mockResolvedValue(refuz);
    render(<DecizieFoaie id="f1" />);
    await apasa("Respinge");
    act(() => {
      fireEvent.change(motiv(), { target: { value: MOTIV } });
    });

    await apasa("Respinge");

    await waitFor(() => {
      expect(
        screen.getByText(
          "Decizia nu a fost înregistrată. Foaia nu vă aparține sau a fost deja decisă.",
        ),
      ).toBeDefined();
    });
    expect(decideFoaie).toHaveBeenCalledWith({
      id: "f1",
      decizie: "respins",
      motiv_respingere: MOTIV,
    });
    expect(motiv().value).toBe(MOTIV);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("fără motiv nu pleacă la server, iar mesajul stă lângă casetă", async () => {
    render(<DecizieFoaie id="f1" />);
    await apasa("Respinge");

    await apasa("Respinge");

    await waitFor(() => {
      expect(
        screen.getByText("Scrieți motivul: șoferul trebuie să știe ce anume să corecteze."),
      ).toBeDefined();
    });
    expect(decideFoaie).not.toHaveBeenCalled();
    expect(motiv().getAttribute("aria-invalid")).toBe("true");
  });

  it("după o respingere reușită, formularul se închide și pagina se reîmprospătează", async () => {
    decideFoaie.mockResolvedValue({ ok: true, data: { id: "f1" } });
    render(<DecizieFoaie id="f1" />);
    await apasa("Respinge");
    act(() => {
      fireEvent.change(motiv(), { target: { value: MOTIV } });
    });

    await apasa("Respinge");

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByLabelText(/^Motivul respingerii/u)).toBeNull();
    expect(screen.getByRole("button", { name: "Aprobă" })).toBeDefined();
  });

  it("aprobarea rămâne un buton: refuzul ei se vede fără formular", async () => {
    decideFoaie.mockResolvedValue({
      ok: false,
      error: {
        code: "VALIDARE",
        message: "Nu vă puteți aproba propria foaie de parcurs.",
        fieldErrors: null,
        requestId: "test",
      },
    } satisfies ActionResult<never>);
    render(<DecizieFoaie id="f1" />);

    await apasa("Aprobă");

    await waitFor(() => {
      expect(screen.getByText("Nu vă puteți aproba propria foaie de parcurs.")).toBeDefined();
    });
    expect(decideFoaie).toHaveBeenCalledWith({
      id: "f1",
      decizie: "aprobat",
      motiv_respingere: null,
    });
  });
});
