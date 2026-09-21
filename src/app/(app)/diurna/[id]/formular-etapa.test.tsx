import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormularEtapa } from "./formular-etapa";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const adaugaEtapa = vi.fn();
vi.mock("../actions", () => ({
  adaugaEtapa: (...argumente: unknown[]) => adaugaEtapa(...argumente) as unknown,
}));

const RO = "11111111-1111-4111-8111-111111111111";
const DE = "22222222-2222-4222-8222-222222222222";
const AT = "33333333-3333-4333-8333-333333333333";
const TARI = [
  { id: RO, cod_alpha2: "RO", denumire: "România", moneda: "RON", este_ue: true },
  { id: DE, cod_alpha2: "DE", denumire: "Germania", moneda: "EUR", este_ue: true },
  { id: AT, cod_alpha2: "AT", denumire: "Austria", moneda: "EUR", este_ue: true },
];

function randeaza(pornire: string | null = RO, destinatie: string | null = DE) {
  return render(
    <FormularEtapa
      tripId="44444444-4444-4444-8444-444444444444"
      tari={TARI}
      taraPornireId={pornire}
      taraDestinatieId={destinatie}
      interval={{ plecare: "2026-09-28T15:00", sosire: "2026-10-01T21:00" }}
    />,
  );
}

describe("FormularEtapa", () => {
  it("pornește din țara firmei spre țara deplasării", () => {
    randeaza();
    expect((screen.getByLabelText("Din țara") as HTMLSelectElement).value).toBe(RO);
    expect((screen.getByLabelText("În țara") as HTMLSelectElement).value).toBe(DE);
  });

  it("„În țara” nu oferă țara de plecare: o etapă e o trecere de graniță", () => {
    randeaza(DE, DE);
    const inTara = screen.getByLabelText("În țara");
    expect(within(inTara).queryByRole("option", { name: "Germania" })).toBeNull();
    expect((inTara as HTMLSelectElement).value).toBe("");
  });

  it("trimisă incompletă: erorile stau sub câmpuri, nu pleacă nimic", () => {
    randeaza();
    fireEvent.click(screen.getByRole("button", { name: "Adaugă etapa" }));
    expect(screen.getByLabelText("Plecarea etapei").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Completați data și ora sosirii.")).toBeTruthy();
    expect(adaugaEtapa).not.toHaveBeenCalled();
  });

  it("etapa din afara deplasării: spune intervalul și înroșește câmpul", () => {
    randeaza();
    fireEvent.change(screen.getByLabelText("Plecarea etapei"), {
      target: { value: "2026-09-27T08:00" },
    });
    fireEvent.change(screen.getByLabelText("Sosirea etapei"), {
      target: { value: "2026-09-29T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adaugă etapa" }));
    expect(screen.getByLabelText("Plecarea etapei").getAttribute("aria-invalid")).toBe("true");
    expect(
      screen.getByText(/Deplasarea ține de la 28\.09\.2026, 15:00 până la 01\.10\.2026, 21:00/u),
    ).toBeTruthy();
    expect(screen.getByLabelText("Sosirea etapei").getAttribute("aria-invalid")).toBeNull();
    expect(adaugaEtapa).not.toHaveBeenCalled();
  });
});
