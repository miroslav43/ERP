// src/app/(app)/ticketing/nou/formular-tichet.test.tsx
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/actions/types";

import { ETICHETE_TIP } from "../etichete";
import { FormularTichet } from "./formular-tichet";

// `usePathname` e cerut de semnalul de încărcare din `<Formular>`
// (`useSemnalPanaLaRuta`), nu de componentă.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ticketing/nou",
}));

const creeazaTichet = vi.fn();
vi.mock("../actions", () => ({
  creeazaTichet: (...argumente: unknown[]) => creeazaTichet(...argumente) as unknown,
}));

/**
 * Regula pe care o apără fișierul: **un refuz de validare nu golește
 * formularul.** QA a găsit contrariul pe ambele rute care randează componenta
 * (ANG-022 pe `/portal/tichetele-mele/nou`, MGR-014 pe `/ticketing/nou`): după
 * „Titlul poate avea cel mult 200 de caractere.” toate câmpurile erau goale,
 * licențele reveneau la 1, iar niciun câmp n-avea `aria-invalid`.
 */

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

function alegeTipul(tip: keyof typeof ETICHETE_TIP): void {
  act(() => {
    fireEvent.click(screen.getByText(ETICHETE_TIP[tip]).closest("button")!);
  });
}

function titlu(): HTMLInputElement {
  return screen.getByLabelText(/^Titlu/u) as HTMLInputElement;
}

async function trimite(): Promise<void> {
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
}

beforeEach(() => {
  creeazaTichet.mockReset();
});

describe("FormularTichet — ce rămâne după un refuz de validare", () => {
  it("cererea de echipament își păstrează câmpurile, iar eroarea stă pe câmpul ei", async () => {
    creeazaTichet.mockResolvedValue(
      refuz({ titlu: ["Titlul poate avea cel mult 200 de caractere."] }),
    );
    render(<FormularTichet obiecteAlocate={[]} modulCurent="" />);
    alegeTipul("hardware");

    const echipament = screen.getByLabelText(/^Ce echipament/u) as HTMLInputElement;
    const livrare = screen.getByLabelText(/^Unde se livrează/u) as HTMLSelectElement;
    const descriere = screen.getByLabelText(/^Detalii/u) as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(titlu(), { target: { value: "TEST_Titlu" } });
      fireEvent.change(echipament, { target: { value: "TEST_Tastatură" } });
      fireEvent.change(livrare, { target: { value: "domiciliu" } });
      fireEvent.change(descriere, { target: { value: "TEST_Detalii manager" } });
    });
    await trimite();

    await waitFor(() =>
      expect(screen.getByText("Titlul poate avea cel mult 200 de caractere.")).toBeDefined(),
    );
    expect(creeazaTichet).toHaveBeenCalledTimes(1);
    expect(creeazaTichet).toHaveBeenCalledWith(expect.objectContaining({ tip: "hardware" }));

    expect(titlu().value).toBe("TEST_Titlu");
    expect((screen.getByLabelText(/^Ce echipament/u) as HTMLInputElement).value).toBe(
      "TEST_Tastatură",
    );
    expect((screen.getByLabelText(/^Unde se livrează/u) as HTMLSelectElement).value).toBe(
      "domiciliu",
    );
    expect((screen.getByLabelText(/^Detalii/u) as HTMLTextAreaElement).value).toBe(
      "TEST_Detalii manager",
    );

    expect(titlu().getAttribute("aria-invalid")).toBe("true");
    const idEroare = titlu().getAttribute("aria-describedby");
    expect(idEroare).toBeTruthy();
    expect(document.getElementById(idEroare ?? "")?.textContent).toContain(
      "Titlul poate avea cel mult 200 de caractere.",
    );
  });

  it("cererea de software păstrează numărul de licențe refuzat, nu revine la 1", async () => {
    // ANG-022: „-3” devenea „1” după refuz, iar omul nu mai vedea ce greșise.
    creeazaTichet.mockResolvedValue(refuz({ numar_licente: ["Cereți cel puțin o licență."] }));
    render(<FormularTichet obiecteAlocate={[]} modulCurent="" />);
    alegeTipul("software");

    const licente = screen.getByLabelText(/^Număr de licențe/u) as HTMLInputElement;
    expect(licente.value).toBe("1");
    act(() => {
      fireEvent.change(licente, { target: { value: "-3" } });
    });
    await trimite();

    await waitFor(() => expect(screen.getByText("Cereți cel puțin o licență.")).toBeDefined());
    expect((screen.getByLabelText(/^Număr de licențe/u) as HTMLInputElement).value).toBe("-3");
  });

  it("după refuz, „Schimbă tipul” și revenirea la același tip păstrează ce s-a scris", async () => {
    // Fotografia `pastrate` se face din DOM; după reparație DOM-ul conține
    // valorile restaurate, deci cele două mecanisme se înlănțuie fără pierdere.
    creeazaTichet.mockResolvedValue(
      refuz({ titlu: ["Titlul poate avea cel mult 200 de caractere."] }),
    );
    render(<FormularTichet obiecteAlocate={[]} modulCurent="" />);
    alegeTipul("hardware");

    act(() => {
      fireEvent.change(titlu(), { target: { value: "TEST_Titlu" } });
      fireEvent.change(screen.getByLabelText(/^Ce echipament/u), {
        target: { value: "TEST_Tastatură" },
      });
      fireEvent.change(screen.getByLabelText(/^Unde se livrează/u), {
        target: { value: "domiciliu" },
      });
    });
    await trimite();
    await waitFor(() =>
      expect(screen.getByText("Titlul poate avea cel mult 200 de caractere.")).toBeDefined(),
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Schimbă tipul" }));
    });
    expect(screen.queryByLabelText(/^Titlu/u)).toBeNull();
    alegeTipul("hardware");

    expect(titlu().value).toBe("TEST_Titlu");
    expect((screen.getByLabelText(/^Ce echipament/u) as HTMLInputElement).value).toBe(
      "TEST_Tastatură",
    );
    expect((screen.getByLabelText(/^Unde se livrează/u) as HTMLSelectElement).value).toBe(
      "domiciliu",
    );
  });
});
