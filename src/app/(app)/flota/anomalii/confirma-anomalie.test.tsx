// src/app/(app)/flota/anomalii/confirma-anomalie.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

/**
 * Aceeași clasă de defect ca ADM-022, nesemnalată de QA: explicația anomaliei
 * se pierdea la un refuz al acțiunii — `<form action>` brut, resetat de React
 * 19 după acțiune.
 */

const { confirmaAnomalie, refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  // Un singur obiect, ca în Next: `useRouter` citește contextul, stabil.
  return { confirmaAnomalie: vi.fn(), refresh, router: { refresh } };
});

vi.mock("../actions", () => ({ confirmaAnomalie }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/incarcare/use-incarcare", () => {
  const semnal = (): undefined => undefined;
  return { useSemnalPanaLaRuta: () => semnal };
});

const { ConfirmaAnomalie } = await import("./confirma-anomalie");

const NOTA = "Cursă necompletată pe 14 septembrie, 180 km până la Arad.";

function nota(): HTMLInputElement {
  const element = screen.getByLabelText("Explicația diferenței de kilometraj");
  if (!(element instanceof HTMLInputElement)) throw new Error("Câmpul „nota” lipsește.");
  return element;
}

beforeEach(() => {
  confirmaAnomalie.mockReset();
  refresh.mockReset();
});

describe("ConfirmaAnomalie — explicația rămâne scrisă după un refuz", () => {
  it("refuzul serverului se vede, iar nota rămâne în casetă", async () => {
    const refuz: ActionResult<never> = {
      ok: false,
      error: {
        code: "CONFLICT",
        message:
          "Confirmarea nu a fost înregistrată: anomalia a fost deja confirmată de altcineva.",
        fieldErrors: null,
        requestId: "test",
      },
    };
    confirmaAnomalie.mockResolvedValue(refuz);
    render(<ConfirmaAnomalie id="a1" />);
    act(() => {
      fireEvent.change(nota(), { target: { value: NOTA } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmă" }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Confirmarea nu a fost înregistrată: anomalia a fost deja confirmată de altcineva.",
        ),
      ).toBeDefined();
    });
    expect(confirmaAnomalie).toHaveBeenCalledWith({ id: "a1", nota: NOTA });
    expect(nota().value).toBe(NOTA);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("nota goală pleacă drept `null`, iar reușita reîmprospătează pagina", async () => {
    confirmaAnomalie.mockResolvedValue({ ok: true, data: { id: "a1" } });
    render(<ConfirmaAnomalie id="a1" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirmă" }));
    });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(confirmaAnomalie).toHaveBeenCalledWith({ id: "a1", nota: null });
  });
});
