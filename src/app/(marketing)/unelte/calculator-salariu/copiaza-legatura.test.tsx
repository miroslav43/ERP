import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopiazaLegatura } from "./copiaza-legatura";

const ADRESA =
  "https://administrativo.ro/unelte/calculator-salariu?suma=5000&perioada=2026-2#rezultat";

function cuClipboard(valoare: unknown) {
  Object.defineProperty(navigator, "clipboard", { value: valoare, configurable: true });
}

describe("copierea legăturii", () => {
  afterEach(() => cuClipboard(undefined));

  it("arată legătura într-un câmp de citit, care merge și fără JavaScript", () => {
    render(<CopiazaLegatura adresa={ADRESA} />);
    const camp = screen.getByLabelText<HTMLInputElement>("Legătura spre acest calcul");
    expect(camp.value).toBe(ADRESA);
    expect(camp.readOnly).toBe(true);
    // 16 px: Safari pe iOS mărește pagina la atingerea unui câmp mai mic (91217eb).
    expect(camp.className).toContain("text-base");
  });

  it("copiază adresa și spune că a copiat-o", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    cuClipboard({ writeText });
    render(<CopiazaLegatura adresa={ADRESA} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiază legătura" }));
    });
    expect(writeText).toHaveBeenCalledWith(ADRESA);
    expect(screen.getByRole("button").textContent).toBe("Copiat");
  });

  it("fără clipboard (pagină http, browser vechi), cere copierea de mână și nu aruncă", async () => {
    cuClipboard(undefined);
    render(<CopiazaLegatura adresa={ADRESA} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiază legătura" }));
    });
    expect(
      screen.getByText("Browserul n-a permis copierea: selectează legătura și copiaz-o."),
    ).toBeTruthy();
  });
});
