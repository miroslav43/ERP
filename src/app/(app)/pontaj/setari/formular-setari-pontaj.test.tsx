// src/app/(app)/pontaj/setari/formular-setari-pontaj.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

/**
 * Reclamația care a pornit fișierul: „am lăsat o casetă necompletată și n-am
 * primit o eroare clară".
 *
 * Erau trei defecte suprapuse, toate tăcute:
 *
 *  1. `z.coerce.number()` pe șirul gol dă 0, iar șapte dintre parametrii
 *     juridici ai ecranului au plafonul de jos chiar 0 — deci caseta goală se
 *     SALVA ca zero, fără niciun mesaj (`schemas/attendance.test.ts`);
 *  2. pentru restul, mesajul lui zod ajungea în `fieldErrors`, pe care
 *     formularul îl arunca: se afișa doar `error.message`, adică propoziția de
 *     rezervă „Datele introduse nu sunt valide.", pentru cincisprezece casete;
 *  3. niciun câmp nu era marcat ca obligatoriu.
 *
 * Testul ăsta îl ține închis pe (2) și pe (3) — la nivelul ECRANULUI, nu al
 * schemei. Acțiunea e mimată: ce se probează e drumul de la `ActionResult`
 * până la pixelul de lângă câmp.
 */

const salveazaSetariPontaj = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ salveazaSetariPontaj }));

// `Formular` cere zona de notificări și semnalul de navigare din harness-ul
// aplicației; în test contează doar erorile, deci amândouă se scurtcircuitează.
vi.mock("@/components/incarcare/use-incarcare", () => ({
  useSemnalPanaLaRuta: () => () => undefined,
}));

const { FormularSetariPontaj } = await import("./formular-setari-pontaj");

function refuz(fieldErrors: Record<string, readonly string[]>): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      // Exact ce trimite `create-action.ts` când toate problemele au un `path`:
      // `flattenError().formErrors` e gol, deci rămâne mesajul de rezervă.
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "test",
    },
  };
}

beforeEach(() => {
  salveazaSetariPontaj.mockReset();
});

describe("FormularSetariPontaj — erorile pe câmp", () => {
  it("pune mesajul serverului LÂNGĂ caseta vinovată, nu sub buton", async () => {
    salveazaSetariPontaj.mockResolvedValue(
      refuz({ repaus_zilnic_minim_ore: ["Completați repausul zilnic minim."] }),
    );

    render(<FormularSetariPontaj setariCurente={null} />);
    await userEvent.click(screen.getByRole("button", { name: /Salvează versiunea/u }));

    await waitFor(() => {
      expect(screen.getByText("Completați repausul zilnic minim.")).toBeDefined();
    });

    // Legătura care face mesajul citibil și pentru cititorul de ecran.
    const camp = screen.getByLabelText(/Repaus zilnic minim/u);
    expect(camp.getAttribute("aria-invalid")).toBe("true");
    expect(camp.getAttribute("aria-describedby")).toContain("eroare");
  });

  it("NU repetă propoziția generală când eroarea e deja pe un câmp", async () => {
    salveazaSetariPontaj.mockResolvedValue(
      refuz({ ore_pe_saptamana: ["Completați norma săptămânală."] }),
    );

    render(<FormularSetariPontaj setariCurente={null} />);
    await userEvent.click(screen.getByRole("button", { name: /Salvează versiunea/u }));

    await waitFor(() => {
      expect(screen.getByText("Completați norma săptămânală.")).toBeDefined();
    });
    expect(screen.queryByText("Datele introduse nu sunt valide.")).toBeNull();
  });

  it("arată mesajul general când eroarea nu aparține niciunui câmp", async () => {
    salveazaSetariPontaj.mockResolvedValue({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Există deja o versiune cu aceeași dată de intrare în vigoare.",
        fieldErrors: null,
        requestId: "test",
      },
    } satisfies ActionResult<never>);

    render(<FormularSetariPontaj setariCurente={null} />);
    await userEvent.click(screen.getByRole("button", { name: /Salvează versiunea/u }));

    await waitFor(() => {
      expect(
        screen.getByText("Există deja o versiune cu aceeași dată de intrare în vigoare."),
      ).toBeDefined();
    });
  });

  it("marchează obligativitatea acolo unde baza chiar o cere", () => {
    render(<FormularSetariPontaj setariCurente={null} />);

    // `Camp` scrie „(obligatoriu)" doar pentru cititorul de ecran, lângă `*`.
    for (const eticheta of [
      /În vigoare de la/u,
      /Ore pe zi/u,
      /Ore pe săptămână/u,
      /Repaus zilnic minim/u,
      /Pauză de masă/u,
    ]) {
      expect(screen.getByLabelText(eticheta).getAttribute("required")).not.toBeNull();
    }

    // Observațiile juridice NU sunt obligatorii: sunt o notă, nu un parametru.
    expect(screen.getByLabelText(/Observații juridice/u).getAttribute("required")).toBeNull();
  });

  it("păstrează ce s-a tastat după un refuz — altfel omul reia cincisprezece casete", async () => {
    salveazaSetariPontaj.mockResolvedValue(refuz({ valabil_de_la: ["Alegeți data."] }));

    render(<FormularSetariPontaj setariCurente={null} />);
    const norma = screen.getByLabelText(/Ore pe săptămână/u);
    await userEvent.clear(norma);
    await userEvent.type(norma, "40:00");
    await userEvent.click(screen.getByRole("button", { name: /Salvează versiunea/u }));

    await waitFor(() => {
      expect(screen.getByText("Alegeți data.")).toBeDefined();
    });
    expect((norma as HTMLInputElement).value).toBe("40:00");
  });
});
