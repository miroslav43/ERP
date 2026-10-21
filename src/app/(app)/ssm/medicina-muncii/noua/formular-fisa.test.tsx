// src/app/(app)/ssm/medicina-muncii/noua/formular-fisa.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

/**
 * ADM-019: pe fișa de aptitudine, după o eroare de validare (cost −10),
 * selectul „Angajat” revenea la „— alegeți angajatul —”, deși restul câmpurilor
 * rămâneau; următoarea trimitere fără realegere dădea „Invalid UUID”.
 *
 * Formularul era DEJA pe `<Formular>` + `valoriTrimise` — de asta restul
 * câmpurilor rămâneau. Golul e al `<select>`-ului: react-dom aplică
 * `defaultValue` pe un select DOAR la montare, iar `form.reset()` de după
 * acțiune îl readuce la opțiunea de la montare. Corecția stă într-un singur
 * loc, `src/components/ui/formular.tsx` (efectul care repune în selecturi
 * valorile trimise după un refuz); testul ăsta e ANCORA care verifică doar că
 * mecanismul ajunge în ecranul din constatare. Codul fișei nu se atinge.
 */

const { adaugaFisaAptitudine, refresh, push, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  const push = vi.fn();
  return {
    adaugaFisaAptitudine: vi.fn(),
    refresh,
    push,
    // Un singur obiect, ca în Next: `useRouter` citește contextul, stabil.
    router: { refresh, push },
  };
});

vi.mock("../../actions", () => ({ adaugaFisaAptitudine }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/incarcare/use-incarcare", () => {
  const semnal = (): undefined => undefined;
  return { useSemnalPanaLaRuta: () => semnal };
});

const { FormularFisa } = await import("./formular-fisa");

function refuz(fieldErrors: Record<string, readonly string[]>): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "test",
    },
  };
}

const ANGAJATI = [
  { id: "u1", full_name: "Ionescu Maria", marca: "1042" },
  { id: "u2", full_name: "Stănescu Andrei", marca: "1043" },
] as const;

beforeEach(() => {
  adaugaFisaAptitudine.mockReset();
  refresh.mockReset();
  push.mockReset();
});

describe("FormularFisa — după un refuz, angajatul ales rămâne ales", () => {
  it("ADM-019: refuz pe `cost` → mesajul lângă „Cost (lei)”, iar „Angajat” rămâne pe `u1`", async () => {
    adaugaFisaAptitudine.mockResolvedValue(refuz({ cost: ["Costul nu poate fi negativ."] }));
    render(<FormularFisa angajati={ANGAJATI} />);

    const angajat = screen.getByLabelText(/^Angajat/u);
    if (!(angajat instanceof HTMLSelectElement)) throw new Error("Selectul „Angajat” lipsește.");
    const cost = screen.getByLabelText("Cost (lei)");
    if (!(cost instanceof HTMLInputElement)) throw new Error("Câmpul „Cost (lei)” lipsește.");

    act(() => {
      fireEvent.change(angajat, { target: { value: "u1" } });
      fireEvent.change(cost, { target: { value: "-10" } });
    });
    expect(angajat.value).toBe("u1");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvează fișa" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Costul nu poate fi negativ.")).toBeDefined();
    });
    expect(cost.getAttribute("aria-invalid")).toBe("true");
    expect(adaugaFisaAptitudine).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: "u1", cost: -10 }),
    );

    // Ce rămâne pe ecran: și costul (input, ținea și înainte), și angajatul
    // (select — golul din constatare).
    expect(cost.value).toBe("-10");
    expect(angajat.value).toBe("u1");
    expect(push).not.toHaveBeenCalled();
  });
});
